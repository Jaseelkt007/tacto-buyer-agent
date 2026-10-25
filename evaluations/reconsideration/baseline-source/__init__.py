"""ProcuDeal buyer agent.

Design rule: code owns every binding number (prices, terms, claims, accept or walk away); the
language model only writes words. `policy.Negotiator` decides, `writer` wraps the decision in an
e-mail. If the engine fails on a move, the kit's LLM agent (with its own guards) takes that move,
so a bug never costs the case.

Every decision is recorded in `self.trace` with the reason behind it, for run analysis and replays.
"""

import logging
import time

from ...play import latest, standing
from ..llm import LLMAgent
from . import context, strategist, tactician, writer
from .policy import Negotiator, flags_off, on

log = logging.getLogger("arena")


class ProcuDealAgent:
    name = "procudeal"

    def __init__(self, complete, package=None):
        self.package = package
        self.delegate = LLMAgent(complete, package)
        self.negotiator = None
        self.trace = []
        self.plan, self.plan_case, self.prepare_seconds = None, None, None

    def prepare(self, case):
        """Zone 1, before the session opens (no supplier clock runs yet): the strategist's plan for
        this case. Never raises: without a plan the engine plays as it always did."""
        self.plan, self.plan_case = None, case.get("case_id")
        if on("grounded_dossier"):
            from .research import grounded

            for sid in case.get("suppliers") or []:
                grounded.load(self.package, sid)
        if not on("case_plan"):
            return None
        t0 = time.monotonic()
        try:
            self.plan = strategist.make_plan(case, self.package)
        except Exception:  # a failed plan must not cost the case
            log.exception("case plan failed - the engine plays without one")
        self.prepare_seconds = round(time.monotonic() - t0, 1)
        log.info("%s: plan in %.1fs (%s)", case.get("case_id"), self.prepare_seconds, "ok" if self.plan else "none")
        return self.plan

    def decide(self, case, threads):
        t0 = time.monotonic()
        if self.negotiator is None or self.negotiator.case["case_id"] != case["case_id"]:
            plan = self.plan if self.plan_case == case["case_id"] else None
            self.negotiator = Negotiator(case, self.package, plan)
        try:
            self.negotiator.remember_prices(threads)
            move = self.negotiator.decide(threads)
            if on("tactician") and self.hybrid_applies(move, threads):
                move = self.hybrid(threads, move)
            if move.get("action"):
                decision = {"supplier_id": move["supplier_id"], "message": {"action": move["action"]}}
                why = {"why": move["why"]}
            elif move.get("note"):  # no term sheet: its standing offer stays
                message = writer.note_email(case, threads[move["supplier_id"]], move)
                decision = {"supplier_id": move["supplier_id"], "message": message}
                why = move["why"]
            else:
                side = self.negotiator.sides[move["supplier_id"]]
                message = writer.offer_email(case, threads[move["supplier_id"]], move, side)
                decision = {"supplier_id": move["supplier_id"], "message": message}
                why = move["why"]
            source = "engine"
        except Exception as e:  # never lose the case to a bug: the kit's guarded LLM agent moves instead
            log.exception("engine failed - delegating this move")
            decision, why, source = self.delegate.decide(case, threads), {"error": repr(e)}, "kit-llm"
        self.record(case, threads, decision, time.monotonic() - t0, source, **why)
        return decision

    def hybrid_applies(self, move, threads):
        """tactician: single-supplier cases, on offers and accepts (walk-aways and notes stay the engine's)."""
        neg = self.negotiator
        kind = (move.get("action") or {}).get("type")
        if on("measured_trades") and kind == "accept":
            return False
        events = threads.get(move.get("supplier_id")) or []
        if events and latest(events).get("status") in ("agreed", "final_offer"):
            return False  # it has agreed or called its final offer: the engine closes (phase 3, P18)
        return not neg.rfq and len(neg.sides) == 1 and not move.get("note") and (move.get("sheets") or kind == "accept")

    def hybrid(self, threads, move):
        """v2.0: the tactician picks among the options code priced; the engine's move is the fallback and
        goes out on any invalid, refused or late answer. Never raises."""
        neg, t0 = self.negotiator, time.monotonic()
        try:
            packet = context.build(neg, threads, move)
        except Exception:
            log.exception("hybrid packet failed - the engine's move goes out")
            return move
        answer, secs, err = tactician.ask(packet)
        new, check = tactician.to_move(neg, packet, answer, move)
        info = {
            "seconds": round(secs, 1),
            "check": check,
            "error": err,
            "choice": {k: (answer or {}).get(k) for k in ("action", "option", "claims", "reason")},
        }
        choice = info["choice"]
        log.info("%s: tactician %s %s in %.1fs (%s)", packet["sid"], choice["action"], choice["option"], secs, check)
        if new is move:
            why = move.get("why")
            if isinstance(why, dict):
                why["hybrid"] = {**info, "used": False}
            return move
        neg.replace_move(neg.sides[packet["sid"]], new)
        if not on("tactician_text"):
            new.pop("paragraph", None)
        why = new.get("why") if isinstance(new.get("why"), dict) else {}
        new["why"] = {**why, "hybrid": {**info, "used": True, "packet_seconds": round(time.monotonic() - t0 - secs, 2)}}
        return new

    def record(self, case, threads, decision, seconds, source, **why):
        """One trace entry per decision: what we sent, what we answered, how long it took, why."""
        sid, msg = decision["supplier_id"], decision["message"]
        events = threads.get(sid, [])
        their_id, their_terms = standing(events) if events else (None, {})
        entry = {
            "round": sum(m.get("from") == "buyer" for m in events),
            "supplier_id": sid,
            "their_status": latest(events).get("status") if events else None,
            "their_offer": their_id,
            "their_terms": their_terms,
            "action": (msg.get("action") or {}).get("type", "send"),
            "our_sheets": [ts.get("terms", ts) for ts in msg.get("term_sheets") or []],
            "seconds": round(seconds, 3),
            "source": source,
            **why,
        }
        docs = [
            {"name": a.get("name"), "text": (a.get("text") or "")[:4000]}
            for m in events
            if m.get("from") != "buyer"
            for a in m.get("attachments") or []
            if "breakdown" in (a.get("name") or "").lower()
        ]
        if docs and not any(e.get("breakdown") for e in self.trace if e.get("supplier_id") == sid):
            entry["breakdown"] = docs  # its cost breakdown, once per thread, for analysis
        if not self.trace:  # every run file shows which v1.7 features were switched off, and the plan
            entry["features_off"] = flags_off()
            entry["plan"] = bool(self.negotiator and self.negotiator.plan)
        self.trace.append(entry)
        log.info("decision %s", entry)
