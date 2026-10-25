"""Existing email API with independent supplier policies and private audit sidecars."""

import json
import math
from contextlib import contextmanager
from copy import deepcopy

import httpx

from ..client import ArenaClient
from ..cost import closing_terms, cost_breakdown, must_haves_ok, score, total_cost
from ..sim import Fail, Sim, create_app, pdf
from .policy import Profile, SupplierPolicy, finite_tree


class GymSim(Sim):
    def __init__(self, case, profiles, chooser, facts=None):
        if case["buyer"]["category_goal"] != "leverage":
            raise ValueError("this suite does not model supplier-health scoring")
        super().__init__({case["case_id"]: deepcopy(case)}, facts=facts, no_clock=True)
        self.chooser, self.policies, self.audit = chooser, {}, []
        for sid in case["suppliers"]:
            spec = profiles[sid]
            context = {k: deepcopy(case[k]) for k in ("parts", "negotiable", "term_options", "fixed_terms")}
            context.update(supplier_id=sid, standard=deepcopy(spec["standard"]))
            self.policies[sid] = SupplierPolicy(context, Profile(**spec["economics"]))

    def _policy(self, thread):
        return self.policies[f"sup:{thread['key']}"]

    def open(self, team, case_id):
        return deepcopy(super().open(team, case_id))

    def _mail(self, s, th, status, stated, text, files=()):
        policy = self._policy(th)
        if th["n"] == 0:
            # Intercept before Sim emits anything: its buyer-derived opening is discarded.
            opening = policy.opening()
            th.update(standard=deepcopy(policy.standard), opening=opening["unit_price"])
            stated, text = {"unit_price": opening["unit_price"]}, policy.profile.opening_email
        if status != "walked_away" and not policy.feasible(stated):
            raise ValueError("supplier attempted an infeasible published offer")
        offer_id = f"offer:{th['key']}-{th['round']}"
        if offer_id in s["offers"] and s["offers"][offer_id] != stated:
            raise ValueError("an existing offer ID cannot change its terms")
        return deepcopy(super()._mail(s, th, status, deepcopy(stated), text, files))

    def _check(self, case, terms, th):
        try:
            finite_tree(terms)
            price = terms.get("unit_price")
            if isinstance(price, bool) or not isinstance(price, int | float) or not math.isfinite(price):
                raise ValueError("price must be finite and numeric")
            self._policy(th).complete(terms)
        except (ValueError, TypeError, KeyError) as exc:
            raise Fail(422, "invalid numeric or contractual term") from exc
        return deepcopy(super()._check(case, terms, th))

    def _answer(self, s, th, msg, sheets):
        policy = self._policy(th)
        standing = {f: th["stated"].get(f, th["standard"].get(f)) for f in policy.fields}
        actions = policy.menu(th["round"], standing, sheets, final=th["status"] == "final_offer")
        history = [
            {k: deepcopy(m[k]) for k in ("from", "body", "term_sheets", "refs") if k in m} for m in th["messages"]
        ]
        chosen, audit = self.chooser.choose(policy.supplier_view(), history, actions)
        if chosen not in actions:
            raise ValueError("chooser returned an action outside the feasible menu")
        self.audit.append(
            {"supplier_id": f"sup:{th['key']}", "round": th["round"], "actions": [a.view() for a in actions], **audit}
        )
        status = {"agree": "agreed", "counter": "open", "final": "final_offer", "hold": "open", "walk": "walked_away"}[
            chosen.kind
        ]
        if chosen.kind == "walk":
            th["closed"] = "walked_away"
        terms = chosen.terms if chosen.kind != "walk" else standing
        reply = self._mail(s, th, status, terms, chosen.public_reason, ["quote.pdf"] if chosen.kind != "walk" else [])
        th["last_at"] = self.clock()
        # No inherited ID-exists => verified logic, and no invented cost breakdowns.
        return reply

    def attachment(self, team, sid, att):
        s = self.session(team, sid)
        if att not in s["files"]:
            raise Fail(404, "no such attachment")
        kind, stated, standard = s["files"][att]

        def printable(terms):
            out = deepcopy(terms)
            if clause := out.get("index_clause"):
                out["index_clause"] = (
                    f"{clause['series']}, {clause['material_share'] * 100:.0f}% material, "
                    f"deadband {clause['deadband_pct']} %, base {clause['base_month']}"
                )
            return out

        sections = [
            ("Offered terms", printable(stated)),
            ("Our standard terms (apply to everything not stated above)", printable(standard)),
            ("Terms fixed by your enquiry", printable(s["case"]["fixed_terms"])),
        ]
        if kind.startswith("order"):
            sections = [("Agreed terms", printable({**standard, **s["case"]["fixed_terms"], **stated}))]
        return pdf("Synthetic supplier quote", sections), "application/pdf"

    def benchmark(self, case):
        candidates = []
        for sid, policy in self.policies.items():
            for combination in policy.combinations():
                floor = policy.floor(combination)
                if floor is None:
                    continue
                terms = {**combination, "unit_price": floor}
                if must_haves_ok(case, terms, policy.standard):
                    candidates.append((total_cost(case, terms, policy.standard), sid, terms))
        return min(candidates, key=lambda item: item[0]) if candidates else None

    def _end(self, s, reason, sup):
        case = s["case"]
        best = self.benchmark(case)
        opening = min(total_cost(case, p.opening(), p.standard) for p in self.policies.values())
        alt_terms = case["buyer"].get("alternative", {}).get("terms", {})
        alt = total_cost(case, alt_terms) if alt_terms.get("unit_price") else None
        benchmarks = [value for value in (best[0] if best else None, alt) if value is not None]
        c_best = min(benchmarks) if benchmarks else None
        result = {
            "ended": True,
            "deal": False,
            "supplier_id": None,
            "offer_id": None,
            "terms": None,
            "c_open": opening,
            "c_deal": None,
            "c_alt": alt,
            "c_best": c_best,
            "score": 0.0,
            "must_haves_ok": None,
            "cost_breakdown": None,
            "trace": [],
            "evaluation": "synthetic economics; not a leaderboard estimate",
        }
        if sup:
            th, policy = s["threads"][sup], self.policies[sup]
            terms = closing_terms(case, th["stated"], th["standard"])
            if not policy.feasible(terms):
                raise ValueError("accepted deal violates supplier financial limits")
            result.update(
                deal=True,
                supplier_id=sup,
                offer_id=th["offer_id"],
                terms=terms,
                c_deal=total_cost(case, terms),
                must_haves_ok=must_haves_ok(case, terms),
                cost_breakdown=cost_breakdown(case, terms),
            )
        realized = result["c_deal"] if sup else alt
        if c_best is not None and (not sup or result["must_haves_ok"]):
            result["score"] = score(opening, realized, c_best)
        s.update(status="ended", end_reason=reason, result=result)
        for th in s["threads"].values():
            th["closed"] = th["closed"] or reason

    @contextmanager
    def local_client(self):
        from fastapi.testclient import TestClient

        self.teams["local-gym"] = "Local practice"
        with TestClient(create_app(self)) as server:

            def request(req):
                # No URL, key or transport from the user's arena environment is consulted.
                if req.url.host != "supplier-gym.invalid":
                    raise ValueError("local transport refuses external hosts")
                response = server.request(
                    req.method, req.url.raw_path.decode(), headers=dict(req.headers), content=req.content
                )
                return httpx.Response(response.status_code, headers=dict(response.headers), content=response.content)

            client = ArenaClient(
                base_url="http://supplier-gym.invalid", api_key="local-gym", transport=httpx.MockTransport(request)
            )
            try:
                yield client
            finally:
                client.http.close()

    def public_transcript(self):
        return json.loads(
            json.dumps(
                {s["id"]: {sid: th["messages"] for sid, th in s["threads"].items()} for s in self.sessions.values()},
                allow_nan=False,
            )
        )
