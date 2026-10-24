"""ProcuDeal buyer agent.

Design rule: code owns every binding number (prices, terms, claims, accept or walk away); the
language model only writes the words. The engine is built up module by module; until a module
exists, decisions are delegated to the kit's LLM agent so the whole pipeline (CLI, benchmark runs,
replays) works end to end.

Every decision is recorded in `self.trace` with the reason behind it, for run analysis and replays.
"""

import logging
import time

from ...play import latest, standing
from ..llm import LLMAgent

log = logging.getLogger("arena")


class ProcuDealAgent:
    name = "procudeal"

    def __init__(self, complete, package=None):
        self.package = package
        self.delegate = LLMAgent(complete, package)
        self.trace = []

    def decide(self, case, threads):
        t0 = time.monotonic()
        decision = self.delegate.decide(case, threads)
        self.record(case, threads, decision, time.monotonic() - t0, source="kit-llm")
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
            "seconds": round(seconds, 2),
            "source": source,
            **why,
        }
        self.trace.append(entry)
        log.info("decision %s", entry)
