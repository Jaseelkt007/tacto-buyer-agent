"""Negotiation policy: what to offer, when to concede, when to accept. All in code.

Per supplier thread:
  setup   - standard terms (quote PDF), dossier, the term mix that is cheapest for us at equal value
            to the supplier, an anchor by category goal, the price ceiling where C reaches our limit
  each    - convert its standing sheet to "its price on our terms", then move a share of the gap
  close   - accept when it agrees, makes a final offer, comes within half a percent of our last
            offer, or (strategic goals) reaches the price that is cheapest for us all things counted;
            only ever a sheet that passes the accept check, else walk away
"""

import logging
import math
from dataclasses import dataclass, field

from ...cost import RELATIONSHIP_GOALS, closing_terms, complete_offer, must_haves_ok, supplier_value, total_cost
from ...docs import quote_terms, standard_terms
from ...play import latest, live_threads, moves_left, standing
from . import claims as cl
from . import economics as eco
from . import signals as sg
from .dossier import CASH_PREMIUM, Dossier, build

log = logging.getLogger("arena")

ANCHOR = {"leverage": 0.80, "routine": 0.84, "quality_first": 0.88, "secure_supply": 0.90, "stabilise": 0.92}
STEP, HOLD_STEP = 0.30, 0.10  # share of the gap we close per round; after a deep first drop, hold
DEEP_DROP = 0.06  # a first counter this far down signals a deep floor
CLOSE_GAP = 0.005  # accept when its price is within this of our last offer
FIRST_CLAIMS, LATER_CLAIMS, DATA_CLAIMS = 3, 1, 2
HEALTH_BAND = 0.98  # in strategic cases, a price this far below the health price is countered at it
STUCK_STEP = 0.45  # it said it cannot move without a move from us
PATIENT_SHIFT = 0.03  # anchor lower for slow, founder-run suppliers; higher for quick group replies
DONE = {"agreed", "final_offer"}  # final_offer is final: these suppliers walk if pushed again


@dataclass
class Side:
    sid: str
    dossier: Dossier
    standard: dict  # what closes for fields a sheet leaves out (quote PDF, standard section)
    reference: dict  # the supplier's own terms for valuing a deal: offered + standard + fixed
    mix: dict
    plan: list
    anchor: float
    ceiling: float
    best_for_us: float  # price at which C (incl. the relationship charge) is lowest
    bank: list
    ours: list = field(default_factory=list)
    theirs: list = field(default_factory=list)  # its price converted to our term mix
    used: set = field(default_factory=set)
    seen: int = 0
    replies: int = 0  # supplier e-mails read so far
    asks: set = field(default_factory=set)  # every ask so far
    last: sg.Reading = field(default_factory=sg.Reading)  # what its latest e-mail said
    rate_raised: bool = False

    def estimate(self):
        return self.dossier.estimate(self.reference)


class Negotiator:
    def __init__(self, case, package=None):
        self.case, self.package = case, package
        self.goal = case["buyer"].get("category_goal", "leverage")
        self.sides: dict[str, Side] = {}
        self.c_open = math.inf
        self.limit = math.inf

    # ---------- setup ----------
    def setup(self, threads):
        quotes = []
        for events in threads.values():
            _, terms = standing(events)
            quotes.append((terms, _standard(events)))
        self.c_open = eco.opening_cost(self.case, quotes)
        self.limit = eco.walk_away_limit(self.case, self.c_open)
        for sid, events in threads.items():
            self.sides[sid] = self.new_side(sid, events)
        # C_open and every later C with the same relationship estimate, so comparisons match
        with_estimate = [
            (standing(threads[sid])[1], side.standard, side.estimate()) for sid, side in self.sides.items()
        ]
        costs = [
            total_cost(self.case, t, std, est)
            for t, std, est in with_estimate
            if t.get("unit_price") is not None and must_haves_ok(self.case, t, std)
        ]
        self.c_open = min(costs, default=self.c_open)
        self.limit = eco.walk_away_limit(self.case, self.c_open)
        for side in self.sides.values():
            ceiling = eco.price_ceiling(self.case, side.mix, self.limit, side.standard, side.estimate())
            side.ceiling = ceiling or 0.0
        log.info("setup %s: C_open %.0f limit %.0f", self.case["case_id"], self.c_open, self.limit)

    def new_side(self, sid, events):
        case = self.case
        std = _standard(events)
        _, quote = standing(events)
        dossier = build(case, sid, self.package, quote.get("unit_price"))
        ref = _reference_terms(case, events)
        est = dossier.estimate(ref)
        delay = sg.read(events[0]).delay_days if events else None
        shift = 0.0
        if (delay or 0) >= 4 or dossier.owner_type == "founder":
            shift = -PATIENT_SHIFT  # small, slow shops have deep floors
        elif dossier.owner_type == "group" and delay is not None and delay <= 2:
            shift = PATIENT_SHIFT  # groups move little and call final offers early
        anchor_ratio = ANCHOR.get(self.goal, 0.85) + shift
        ratio = (1 + anchor_ratio) / 2  # where we expect to close, relative to its quote
        plan = []
        if quote.get("unit_price"):
            plan = eco.plan_terms(case, eco_fill(case, quote), std, est, deal_ratio=ratio)
        mix = dict(plan[0][1]) if plan else complete_offer(case, quote)
        mix.pop("unit_price", None)
        q_eq = _their_price(case, quote, mix, est, std)
        anchor = (q_eq or quote.get("unit_price") or 0) * anchor_ratio
        best = eco.cheapest_price(case, mix, std, est) if self.goal in RELATIONSHIP_GOALS else 0.0
        anchor = max(anchor, best)
        current = case["buyer"].get("current_unit_price")
        if case.get("type") == "price_increase" and current:
            anchor = min(anchor, current)
        ceiling = eco.price_ceiling(case, mix, self.limit, std, est)
        if ceiling is None:
            ceiling = 0.0
        bank = cl.build_bank(case, dossier, self.package, quote.get("unit_price"))
        log.info(
            "side %s: mix %s quote~%.2f anchor %.2f (shift %+.2f, delay %s) ceiling %s best %.2f full_cost %s (%s)"
            " rate %.3f claims %d",
            sid,
            mix,
            q_eq or 0,
            anchor,
            shift,
            delay,
            ceiling,
            best,
            dossier.full_cost,
            dossier.full_cost_source,
            dossier.interest_rate,
            len(bank),
        )
        return Side(sid, dossier, std, ref, mix, plan, round(anchor, 2), ceiling, best, bank)

    # ---------- per move ----------
    def decide(self, threads):
        if not self.sides:
            self.setup(threads)
        live = live_threads(threads)
        for sid in live:
            self.observe(self.sides[sid], threads[sid])

        # the best sheet any supplier stands on right now, if it passes the accept check
        offers = []
        for sid in live:
            side, events = self.sides[sid], threads[sid]
            sheet_id, terms = standing(events)
            if not sheet_id:
                continue
            ok, why = eco.accept_check(self.case, terms, side.standard, side.estimate(), self.c_open)
            if ok:
                offers.append((total_cost(self.case, terms, side.standard, side.estimate()), sid, sheet_id, why))
        offers.sort()
        best = offers[0] if offers else None

        ready = {sid: self.ready(self.sides[sid], threads[sid]) for sid in live}
        # close on the best standing sheet once its supplier is ready, or every thread is
        if best and (ready[best[1]] or all(ready.values())):
            return self.accept(best, ready[best[1]])
        finished = all(
            latest(threads[s]).get("status") == "final_offer" or moves_left(self.case, threads[s]) <= 0 for s in live
        )
        if not best and finished:
            return self.walk(live[0], "no standing sheet passes the accept check")

        # otherwise negotiate with the supplier that has waited longest (oldest reply first)
        talk = [s for s in live if not ready[s] and moves_left(self.case, threads[s]) > 0]
        if not talk:
            talk = [s for s in live if moves_left(self.case, threads[s]) > 0]
        if not talk:
            return self.accept(best, "no moves left") if best else self.walk(live[0], "no moves left")
        sid = min(talk, key=lambda s: self.sides[s].seen)
        return self.offer(self.sides[sid], threads, offers)

    def observe(self, side, events):
        their = [m for m in events if m.get("from") != "buyer"]
        if len(their) <= len(side.theirs):
            return
        for m in their[side.replies :]:
            side.last = sg.read(m)
            side.asks |= side.last.asks
        side.replies = len(their)
        side.seen = sum(len(s.theirs) for s in self.sides.values())  # arrival order across threads
        _, terms = standing(events)
        if terms.get("unit_price") is not None:
            side.dossier.bound_full_cost(terms["unit_price"])
            price = _their_price(self.case, terms, side.mix, side.estimate(), side.standard)
            side.theirs.append(price if price else terms["unit_price"])
        else:
            side.theirs.append(side.theirs[-1] if side.theirs else math.inf)
        self.react(side, events)

    def react(self, side, events):
        """Act on what its latest e-mail said and on any alternative sheets it sent."""
        case = self.case
        if "payment" in side.last.asks and not side.rate_raised and "payment_days" in case["negotiable"]:
            side.rate_raised = True
            if not side.dossier.cash_need:
                side.dossier.interest_rate += CASH_PREMIUM
            self.replan(side, events, "it asked for faster payment")
        if "hedged" in side.last.traits:
            side.bank = [c for c in side.bank if c.kind != "index_change"]
        sheets = latest(events).get("term_sheets") or []
        if len(sheets) > 1 and sheets[0]["terms"].get("unit_price") is not None:
            est, std = side.estimate(), side.standard
            standing_c = total_cost(case, sheets[0]["terms"], std, est)
            for ts in sheets[1:]:
                terms = ts.get("terms") or {}
                if terms.get("unit_price") is None or not must_haves_ok(case, terms, std):
                    continue
                if total_cost(case, terms, std, est) < standing_c - 1:
                    mix = {k: v for k, v in complete_offer(case, terms).items() if k != "unit_price"}
                    log.info(
                        "%s: its alternative %s costs us less - adopting its terms %s",
                        side.sid,
                        ts.get("term_sheet_id"),
                        mix,
                    )
                    side.mix = mix
                    side.theirs[-1] = terms["unit_price"]
                    standing_c = total_cost(case, terms, std, est)

    def replan(self, side, events, why):
        """Re-rank the term mixes with what we now know about the supplier."""
        _, terms = standing(events)
        if terms.get("unit_price") is None:
            return
        ratio = (side.anchor / side.theirs[0]) if side.theirs and side.theirs[0] else 0.9
        plan = eco.plan_terms(
            self.case, eco_fill(self.case, terms), side.standard, side.estimate(), deal_ratio=(1 + ratio) / 2
        )
        if plan:
            side.plan = plan
            new = {k: v for k, v in plan[0][1].items() if k != "unit_price"}
            if new != side.mix:
                log.info("%s: re-planned terms (%s): %s -> %s", side.sid, why, side.mix, new)
                side.mix = new
                side.theirs[-1] = (
                    _their_price(self.case, terms, side.mix, side.estimate(), side.standard) or side.theirs[-1]
                )

    def ready(self, side, events):
        """Is this supplier at the point where we should take its standing sheet?"""
        status = latest(events).get("status")
        below_health = (
            self.goal in RELATIONSHIP_GOALS
            and side.best_for_us
            and side.theirs
            and side.theirs[-1] < side.best_for_us * HEALTH_BAND
        )
        if status == "final_offer" or moves_left(self.case, events) <= 1:
            return status or "last move"
        if status == "agreed":
            return False if below_health else "agreed"  # below its health price: counter at that price
        if not side.ours or not side.theirs:
            return False
        if side.theirs[-1] <= side.ours[-1] * (1 + CLOSE_GAP):
            return "within half a percent of our offer"
        if self.goal in RELATIONSHIP_GOALS and side.best_for_us and side.theirs[-1] <= side.best_for_us:
            if below_health:
                return False
            return "at the price that is cheapest for us with the relationship charge"
        return False

    def next_price(self, side):
        theirs = side.theirs[-1]
        if (
            self.goal in RELATIONSHIP_GOALS
            and side.best_for_us
            and side.ours
            and theirs < side.best_for_us * HEALTH_BAND
        ):
            # it would go below a healthy margin, which C charges us for: offer the healthy price instead
            return round(min(side.best_for_us, side.ceiling or math.inf), 2)
        if not side.ours:
            price = min(side.anchor, theirs * 0.99)
        elif "price_frozen" in side.last.traits:
            price = theirs  # its price stands; we win on the terms of our mix instead
        elif "stuck" in side.last.traits:
            price = max(side.ours[-1] + STUCK_STEP * (theirs - side.ours[-1]), side.ours[-1])
        else:
            first_drop = (side.theirs[0] - side.theirs[1]) / side.theirs[0] if len(side.theirs) > 1 else 0
            step = HOLD_STEP if len(side.ours) == 1 and first_drop >= DEEP_DROP else STEP
            price = side.ours[-1] + step * (theirs - side.ours[-1])
            price = max(price, side.ours[-1])
        if side.ceiling:
            price = min(price, side.ceiling)
        price = min(price, theirs * 0.998)
        return round(max(price, 0.01), 2)

    def offer(self, side, threads, offers):
        case, std = self.case, side.standard
        events = threads[side.sid]
        price = self.next_price(side)
        main = complete_offer(case, {**side.mix, "unit_price": price})
        c_main = total_cost(case, main, std)  # iso-cost sheets: our cash cost only, no relationship estimate
        sheets = [main]
        if not side.ours:  # first offer: two more packages that cost us the same, to learn what it values
            for _, alt in side.plan[1:]:
                if len(sheets) == 3:
                    break
                mix = {k: v for k, v in alt.items() if k != "unit_price"}
                if mix == side.mix or any(_same_mix(mix, s) for s in sheets):
                    continue
                p = eco.equal_cost_price(case, mix, c_main, std)
                if p and p < math.inf and 0 < p:
                    sheet = complete_offer(case, {**mix, "unit_price": p})
                    if must_haves_ok(case, sheet, std):
                        sheets.append(sheet)
        else:  # later: also its own term mix at the same cost to us
            _, terms = standing(events)
            theirs = complete_offer(case, terms)
            mix = {k: v for k, v in theirs.items() if k != "unit_price"}
            if not _same_mix(mix, main):
                p = eco.equal_cost_price(case, mix, c_main, std)
                if p and p < math.inf and p > 0:
                    sheet = complete_offer(case, {**mix, "unit_price": p})
                    if must_haves_ok(case, sheet, std):
                        sheets.append(sheet)
        clause = self.clause_sheet(side, main, c_main)
        if clause and len(sheets) < 3:
            sheets.insert(1, clause)
        if self.goal in RELATIONSHIP_GOALS and side.best_for_us:  # never offer below its health point
            floor = side.best_for_us * 0.995
            sheets = [main] + [s for s in sheets[1:] if s["unit_price"] >= floor]
            clause = clause if clause in sheets else None
        claims = self.pick_claims(side, offers)
        side.ours.append(price)
        return {
            "supplier_id": side.sid,
            "sheets": sheets,
            "claims": claims,
            "answers": self.answers(side, main, sheets, clause),
            "why": {
                "price": price,
                "anchor": side.anchor,
                "ceiling": side.ceiling,
                "their_price_on_our_terms": round(side.theirs[-1], 2) if side.theirs else None,
                "c_main": round(c_main),
                "limit": round(self.limit) if self.limit < math.inf else None,
                "sheets": len(sheets),
                "claims": [c.kind for c in claims],
                "asks": sorted(side.last.asks),
                "traits": sorted(side.last.traits),
                "mix": side.mix,
            },
        }

    def clause_sheet(self, side, main, c_main):
        """It offered or asked for an index clause: one sheet with the clause that costs us least,
        at the same total cost to us as the main sheet."""
        case = self.case
        if "clause" not in side.asks or "index_clause" not in case["negotiable"] or main.get("index_clause"):
            return None
        options = [o for o in case.get("term_options", {}).get("index_clause", []) if o]
        if not options:
            return None
        best = max(options, key=lambda o: o.get("deadband_pct", 0))
        mix = {**{k: v for k, v in main.items() if k != "unit_price"}, "index_clause": best}
        p = eco.equal_cost_price(case, mix, c_main, side.standard)
        if not p or p == math.inf or p <= 0:
            return None
        sheet = complete_offer(case, {**mix, "unit_price": p})
        return sheet if must_haves_ok(case, sheet, side.standard) else None

    def answers(self, side, main, sheets, clause):
        """Sentences that answer what it asked for, in words."""
        case, out = self.case, []
        t = closing_terms(case, main, side.standard)
        if "volume" in side.last.asks:
            out.append(
                f"We can commit to {t['volume_per_year']:,} pieces per year over {t['contract_months']} months, "
                "as set out in the packages below."
            )
        reference_days = side.reference.get("payment_days")
        if (
            "payment" in side.last.asks
            and reference_days
            and any((s.get("payment_days") or 999) < reference_days for s in sheets)
        ):
            out.append("We have included faster payment, as you asked.")
        if clause:
            out.append("We are open to a price adjustment clause; one of the packages includes it.")
        if "price_frozen" in side.last.traits:
            out.append("We understand that your price is fixed for now, so we have looked at the terms instead.")
        return out

    def pick_claims(self, side, offers):
        n = FIRST_CLAIMS if not side.ours else (DATA_CLAIMS if "data" in side.last.asks else LATER_CLAIMS)
        out = []
        # RFQ: the cheapest rival offer is the strongest argument
        rivals = [(c, s, sh) for c, s, sh, _ in offers if s != side.sid]
        if rivals:
            _, rsid, rsheet = min(rivals)
            key = f"{side.sid}|{rsheet}"
            if key not in side.used:
                price = self._sheet_price(rsid, rsheet)
                if price:
                    out.append(cl.rival_claim(rsheet, price))
                    side.used.add(key)
        for c in side.bank:
            if len(out) >= n:
                break
            if c.key not in side.used and not any(c.key == o.key for o in out):
                out.append(c)
                side.used.add(c.key)
        return out[:n]

    def _sheet_price(self, sid, sheet_id):
        return self._prices.get(sheet_id) if hasattr(self, "_prices") else None

    def remember_prices(self, threads):
        self._prices = {}
        for events in threads.values():
            for m in events:
                for ts in m.get("term_sheets") or []:
                    if ts.get("term_sheet_id") and ts.get("terms", {}).get("unit_price") is not None:
                        self._prices[ts["term_sheet_id"]] = ts["terms"]["unit_price"]

    def accept(self, best, why):
        _, sid, sheet_id, check = best
        return {"supplier_id": sid, "action": {"type": "accept", "term_sheet_id": sheet_id}, "why": f"{why}; {check}"}

    def walk(self, sid, why):
        return {"supplier_id": sid, "action": {"type": "walk_away"}, "why": why}


def eco_fill(case, terms):
    """A quote's terms with every negotiable field present (gaps from the buyer's plan)."""
    return complete_offer(case, terms) | {"unit_price": terms.get("unit_price")}


def _standard(events):
    try:
        return standard_terms(events)
    except Exception:  # an odd quote line must not lose the supplier
        log.exception("could not read standard terms")
        return {}


def _reference_terms(case, events):
    """The supplier's own terms, complete: its opening offer, its standard terms, the terms fixed by
    the enquiry, then the buyer's plan for any gap. The baseline its cash value is measured against."""
    parsed = {}
    for msg in events:
        for att in msg.get("attachments") or []:
            if att.get("name", "").startswith("quote") and att.get("text"):
                try:
                    parsed = quote_terms(att["text"])
                except Exception:
                    log.exception("could not read the quote")
                break
        if parsed:
            break
    _, opening = standing(events[:1]) if events else (None, {})
    stated = {**opening, **parsed.get("stated", {})}
    ref = closing_terms(case, {**stated, "unit_price": None}, {**parsed.get("standard", {}), **parsed.get("fixed", {})})
    ref.pop("unit_price", None)
    return ref


def _their_price(case, terms, mix, est, std):
    """Its standing offer, converted to the price that would be worth the same to it on our mix."""
    if terms.get("unit_price") is None:
        return None
    try:
        value = supplier_value(case, {**terms}, est)
        p = eco.price_for_value(case, {**mix}, est, value)
        return p if p and p > 0 else terms["unit_price"]
    except Exception:
        log.exception("price conversion failed")
        return terms["unit_price"]


def _same_mix(a, b):
    keys = (set(a) | set(b)) - {"unit_price"}
    return all(a.get(k) == b.get(k) for k in keys)
