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
from . import strategist, writer
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
        if not self.trace:  # every run file shows which v1.7 features were switched off, and the plan
            entry["features_off"] = flags_off()
            entry["plan"] = bool(self.negotiator and self.negotiator.plan)
        self.trace.append(entry)
        log.info("decision %s", entry)
