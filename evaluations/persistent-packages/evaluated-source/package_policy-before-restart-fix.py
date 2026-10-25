"""Experimental persistent negotiation of a repeatedly quoted supplier package."""

import math
from copy import deepcopy
from dataclasses import asdict

from ...play import latest, moves_left
from . import economics as eco
from .policy import STEP
from .reconsideration import SupplierPackage, nonprice, package_terms


def quoted_packages(neg, sid, events):
    message = latest(events)
    if message.get("from") in {"buyer", "arena"} or not message.get("message_id"):
        return []
    found = []
    for sheet in message.get("term_sheets") or []:
        if not sheet.get("term_sheet_id"):
            continue
        ref = SupplierPackage(sid, message["message_id"], sheet["term_sheet_id"])
        try:
            terms = package_terms(ref, neg.case, {sid: events}, neg.sides[sid].standard)
        except (ValueError, TypeError):
            continue
        found.append((ref, terms))
    return found


class PersistentPackages:
    """Own package state per supplier; code prices it from observable, comparable offers."""

    def __init__(self):
        self.active = {}
        self.pending = {}
        self.negotiator = None

    def before_decide(self, neg, threads):
        if self.negotiator is not neg:
            self.active, self.pending, self.negotiator = {}, {}, neg
        for sid, (mix, active, count) in list(self.pending.items()):
            if len(threads.get(sid, [])) <= count or threads[sid][-1].get("from") == "buyer":
                continue
            if threads[sid][-1].get("from") == "arena":
                neg.set_mix(neg.sides[sid], mix)
                if active is None:
                    self.active.pop(sid, None)
                else:
                    self.active[sid] = active
            self.pending.pop(sid)

    def __call__(self, neg, threads, move):
        if move.get("action") or move.get("note") or move.get("hold") or not move.get("sheets"):
            return move
        sid = move["supplier_id"]
        events, side = threads[sid], neg.sides[sid]
        if latest(events).get("status") in {"agreed", "final_offer"} or moves_left(neg.case, events) <= 1:
            return move
        supplier_indexes = [i for i, m in enumerate(events) if m.get("from") not in {"buyer", "arena"}]
        if len(supplier_indexes) < 2 or not any(m.get("from") == "buyer" for m in events):
            return move
        current = quoted_packages(neg, sid, events)
        previous = quoted_packages(neg, sid, events[: supplier_indexes[-2] + 1])
        candidates = []
        for ref, terms in current:
            mix = nonprice(terms)
            sent = [m["term_sheets"][0]["terms"] for m in events if m.get("from") == "buyer" and m.get("term_sheets")]
            continuing = bool(sent and nonprice(sent[-1]) == mix and any(nonprice(s) != mix for s in sent[:-1]))
            matched = next(((r, t) for r, t in previous if nonprice(t) == mix), None)
            if continuing:
                last_price = sent[-1]["unit_price"]
                if terms["unit_price"] <= last_price:
                    continue  # ordinary acceptance policy owns this situation
                price = last_price + STEP * (terms["unit_price"] - last_price)
                reason = "continue on the last actually sent package"
            else:
                if mix == nonprice(move["sheets"][0]) or matched is None:
                    continue
                concession = matched[1]["unit_price"] - terms["unit_price"]
                if concession <= 0:
                    continue
                price = terms["unit_price"] - concession
                reason = "repeat the observed concession on the same supplier package"
            ceiling = eco.price_ceiling(neg.case, mix, neg.limit, side.standard, side.estimate())
            if ceiling is None or not math.isfinite(ceiling):
                continue
            health = eco.cheapest_price(neg.case, mix, side.standard, side.estimate())
            price = min(max(price, health), ceiling, terms["unit_price"])
            if continuing and price < last_price:
                continue  # never lower our last bid on unchanged terms
            candidate = {**mix, "unit_price": round(price, 2)}
            ok, _ = eco.accept_check(neg.case, candidate, side.standard, side.estimate(), neg.c_open)
            if not ok or not math.isfinite(price) or price <= 0:
                continue
            cost = eco.cost(neg.case, candidate, side.standard, side.estimate())
            candidates.append(
                (
                    cost,
                    candidate,
                    {
                        "used": True,
                        "continuing": bool(continuing),
                        "reason": reason,
                        "reference": asdict(ref),
                        "previous_reference": asdict(matched[0]) if matched else None,
                        "quoted_price": terms["unit_price"],
                        "estimated_cost": cost,
                        "cost_limit": neg.limit,
                        "original_sheets": deepcopy(move["sheets"]),
                    },
                )
            )
        if not candidates:
            return move
        _, terms, info = min(candidates, key=lambda c: c[0])
        if move["sheets"] == [terms]:
            return move
        why = move.get("why")
        why = dict(why) if isinstance(why, dict) else {"original_reason": why}
        result = {
            **move,
            "sheets": [terms],
            "trade": None,
            "answers": [],
            "cash_line": terms.get("payment_days", math.inf) < side.reference.get("payment_days", 0),
            "why": {**why, "persistent_package": info},
        }
        self.pending[sid] = (deepcopy(side.mix), deepcopy(self.active.get(sid)), len(events))
        neg.replace_move(side, result)
        self.active[sid] = nonprice(terms)
        return result
