"""Measure complete buyer decisions in evaluation runners, excluding supplier HTTP waiting."""

import time


class TimedBuyer:
    def __init__(self, agent):
        self.agent = agent
        self.decision_timings = []

    def __getattr__(self, name):
        return getattr(self.agent, name)

    def decide(self, case, threads):
        started = time.monotonic()
        decision, error = None, None
        try:
            decision = self.agent.decide(case, threads)
            return decision
        except Exception as exc:
            error = type(exc).__name__
            raise
        finally:
            self.decision_timings.append({
                "seconds": round(time.monotonic() - started, 6),
                "supplier_id": decision["supplier_id"] if decision else None,
                "action": decision["message"].get("action", {}).get("type", "send") if decision else None,
                "error": error,
            })
