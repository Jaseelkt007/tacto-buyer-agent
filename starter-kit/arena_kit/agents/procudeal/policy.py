"""Negotiation policy: what to offer, when to concede, when to accept. All in code.

Per supplier thread:
  setup   - standard terms (quote PDF), dossier, the term mix that is cheapest for us at equal value
            to the supplier, an anchor by category goal, the price ceiling where C reaches our limit
  each    - convert its standing sheet to "its price on our terms", then move a share of the gap,
            with one fresh argument (lever) per round
  close   - accept when it agrees, makes a final offer, comes within half a percent of our last
            offer with no lever left, or (strategic goals) reaches the price that is cheapest for us
            all things counted; only ever a sheet that passes the accept check, else walk away

v1.7 behaviour changes sit behind `FEATURES` (switch off with PROCUDEAL_OFF="name,name").
"""

import logging
import math
import os
import re
import time
from dataclasses import dataclass, field

from ...cost import RELATIONSHIP_GOALS, closing_terms, complete_offer, must_haves_ok, total_cost
from ...play import latest, live_threads, moves_left, standing
from . import claims as cl
from . import economics as eco
from . import quote as qt
from . import signals as sg
from .dossier import CASH_PREMIUM, Dossier, build

log = logging.getLogger("arena")

# v1.7 feature flags. Every behaviour change can be switched off for an ablation run, e.g.
# PROCUDEAL_OFF="single_sheet,rich_value", and a default-off one on with PROCUDEAL_ON="patience"
# (read once at import). Bug fixes are not flagged.
FEATURES = {
    "lever_schedule": True,  # A: 3 claims of different kinds first, then one new kind per round
    "single_sheet": True,  # B: one main sheet, at most one need-trade sheet
    "strict_accept": True,  # C: "within 0.5 %" closes only when no fresh lever is left
    "proactive_clause": True,  # D: index clause on the supplier's asserted cost driver
    "friendly_ties": True,  # E: on a C tie, the supplier-friendly mix (longest contract first)
    "patience": False,  # F: patience budget, persona anchor floors - off since v1.7c (token steps, higher finals)
    "silence": True,  # G: our sheet stands while it clarifies internally
    "rich_value": True,  # H: ppm, overtime, volume and skonto in the supplier value
    "keepalive": True,  # bug 6: RFQ keepalive for a ready thread
    "call_note_lever": False,  # A: the call / meeting note claim - off since v1.7c (it drew requests for proof)
    "case_plan": False,  # zone 1: play with the case strategist's plan - contractual trades, levers, blocked traps
    "plan_stance": False,  # zone 1: the plan's stance moves the opening anchor (hurt P03 / P11 / P10 when soft)
    "plan_paragraph": False,  # zone 1: the plan's opening paragraph (promised terms code never sent: P02, P08)
    "plan_priced_trades": False,  # zone 1: non-contractual opening trades from the plan (24 months hurt P03 / P08)
    "quote_cap": True,  # v1.8: the opening quote caps the full cost; later prices do not
    "measured_rate": True,  # v1.8: its cost of money from its own sheets that differ only in payment days
    "health_refresh": True,  # v1.8: health price and ceiling recomputed whenever the estimate changes
    "protection_trade": True,  # v1.9: clause at our health price when the supplier gains by it (relationship goals)
    "ask_breakdown": False,  # v2.1: the first e-mail asks for its cost breakdown (brief: an open supplier sends one)
    "tactician": False,  # v2.0 hybrid: one model call per move picks among code-priced options (single supplier)
    "tactician_text": False,  # v2.0 hybrid: the tactician's figure-free paragraph goes into the e-mail
}


def _names(text, var):
    names = {name.strip() for name in (text or "").split(",") if name.strip()}
    if unknown := names - FEATURES.keys():
        log.warning("%s: unknown flags ignored: %s", var, ", ".join(sorted(unknown)))
    return names


def parse_off(text, on_text=""):
    """{flag: on}: the defaults, with the flags named in `on_text` on and those in `text` off
    (comma-separated; unknown names are ignored)."""
    off, extra = _names(text, "PROCUDEAL_OFF"), _names(on_text, "PROCUDEAL_ON")
    return {name: (default or name in extra) and name not in off for name, default in FEATURES.items()}


FLAGS = parse_off(os.environ.get("PROCUDEAL_OFF", ""), os.environ.get("PROCUDEAL_ON", ""))


def on(name):
    return FLAGS.get(name, False)


def flags_off():
    return sorted(name for name, value in FLAGS.items() if not value)


ANCHOR = {"leverage": 0.80, "routine": 0.84, "quality_first": 0.88, "secure_supply": 0.90, "stabilise": 0.92}
STEP, HOLD_STEP = 0.30, 0.10  # share of the gap we close per round; after a deep first drop, hold
DEEP_DROP = 0.06  # a first counter this far down signals a deep floor
CLOSE_GAP = 0.005  # accept when its price is within this of our last offer
STRICT_MOVES = 2  # strict_accept: "within 0.5 %" closes with a lever left once this few moves remain
FIRST_CLAIMS, LATER_CLAIMS, DATA_CLAIMS = 3, 1, 2
RATE_RANGE = (0.001, 0.30)  # measured_rate: a plausible yearly cost of money, else the sheets mean something else
DEAD_RESULTS = {"contradicted", "irrelevant"}  # lever_schedule: a kind that came back so is dropped for the case
DROP_GAP = 0.10  # RFQ: a bidder this far above the leader in C gets no more rounds
AUCTION_EDGE = 0.02  # RFQ reverse auction: a call asks the runner-up to beat the leader's C by this
AUCTION_MIN_GAIN = 0.005  # keep calling while the best C improves at least this much
AUCTION_CALLS = 4  # at most this many calls
HEALTH_BAND = 0.98  # in strategic cases, a price this far below the health price is countered at it
STUCK_STEP = 0.45  # it said it cannot move without a move from us
PATIENT_SHIFT = 0.03  # anchor lower for slow, founder-run suppliers; higher for quick group replies
DONE = {"agreed", "final_offer"}  # final_offer is final: these suppliers walk if pushed again
# case_plan: the opening anchor by the plan's stance (never the term mix). "hard" is only a nudge: the leverage
# anchor is already at the deep end, and a deeper one drew an earlier final offer (sandbox D02)
STANCE_SHIFT = {"soft": 0.03, "normal": 0.0, "hard": -0.01}
TRADE_GAIN = 1.0  # single_sheet: a need-trade sheet must cost us at least this much less (EUR)
KEEPALIVE_S = 35  # keepalive: a ready RFQ thread that has waited this long gets a sheetless note ...
KEEPALIVE_MARGIN, KEEPALIVE_MAX = 10, 3  # ... or sooner, if the slowest reply so far would make it late
MOVE_LIMIT_S = 60  # the arena's clock per message
KEEPALIVE_TEXT = "Thank you. Could you confirm how long your offer remains valid?"
HOLD_TEXT = "Thank you. We look forward to your answer; our proposal below stands."
# patience (practice evidence, round numbers): share of the opening gap we may concede in total
PATIENCE = {"normal": 1.0, "relationship": 0.3, "capacity_full": 0.16, "near_cost": 0.14}
NEAR_COST = 0.98  # own-plant should-cost at least this share of its quote: it sells near its cost
ANCHOR_FLOOR = {"capacity_full": 0.93, "near_cost": 0.97}  # anchor at least this share of its price
WANTS_WORK_SHIFT = 0.02  # a supplier looking for work: anchor this much lower
# rich_value: what a sheet costs or brings the supplier beyond the kit's items (shares of the price)
OVERTIME_FULL, OVERTIME = 0.005, 0.001  # per day faster than its own lead time (capacity full / not)
VOLUME_PLUS = 0.02  # per 100 % more volume than it quoted, when it looks for work
ID = re.compile(r"\b[a-z]+:[\w@#.\-]*[\w#]")  # a data ID in our own e-mail (resume)


@dataclass
class Side:
    sid: str
    dossier: Dossier
    standard: dict  # what closes for fields a sheet leaves out (quote PDF, standard section)
    reference: dict  # the supplier's own terms for valuing a deal: offered + standard + fixed
    mix: dict = field(default_factory=dict)
    plan: list = field(default_factory=list)
    anchor: float = 0.0
    ceiling: float = 0.0
    best_for_us: float = 0.0  # price at which C (incl. the relationship charge) is lowest
    bank: list = field(default_factory=list)
    ours: list = field(default_factory=list)
    theirs: list = field(default_factory=list)  # its price converted to our term mix
    used: set = field(default_factory=set)
    seen: int = 0
    replies: int = 0  # supplier e-mails read so far
    asks: set = field(default_factory=set)  # every ask so far
    last: sg.Reading = field(default_factory=sg.Reading)  # what its latest e-mail said
    rate_raised: bool = False
    dropped: bool = False  # RFQ: cannot win, no more rounds
    rich: bool = False  # rich_value: its scorecard ppm in the estimate
    extras: object = None  # fn(terms, deal) -> EUR per unit it gains beyond the kit's items
    clause: dict | None = None  # proactive_clause: the clause option on its asserted driver
    driver: sg.Driver | None = None  # the driver it asserted for that clause
    clause_said: bool = False
    kinds_used: set = field(default_factory=set)  # lever_schedule: claim kinds it has heard
    sent_claims: list = field(default_factory=list)  # the claims of our last message, for its claim_results
    claim_log: tuple = ((), frozenset(), frozenset())  # keys, kinds, refs the next move adds
    pending: dict | None = None  # our last move until its reply arrives (rolled back on a late send)
    last_main: dict | None = None  # the main sheet we sent last
    trades: set = field(default_factory=set)  # single_sheet: need trades sent, (field, value)
    reply_at: float = 0.0  # wall clock of its latest reply (keepalive)
    done: tuple | None = None  # (sheet id, status) of its latest agreed / final sheet
    budget_share: float | None = None  # patience: share of the opening gap we may concede
    budget: float | None = None  # patience: EUR per unit we may concede in total
    holds: int = 0  # silence: holds in a row
    paragraph: str = ""  # case_plan: the strategist's figure-free paragraph for the first e-mail
    keepalives: int = 0
    clause_adopted: bool = False  # proactive_clause: our clause is the one it demanded
    protected: bool = False  # protection_trade: our sheet carries the clause it gains by, at our health price
    rival_cited: dict = field(default_factory=dict)  # lever_schedule: rival sid -> price we cited to it

    def estimate(self):
        est = self.dossier.estimate(self.reference, rich=self.rich)
        if self.extras:
            est["extras"] = self.extras
        return est


class Negotiator:
    def __init__(self, case, package=None, plan=None):
        self.case, self.package = case, package
        self.plan = plan if on("case_plan") and plan else None  # zone 1: the strategist's plan
        self.goal = case["buyer"].get("category_goal", "leverage")
        self.sides: dict[str, Side] = {}
        self.c_open = math.inf
        self.limit = math.inf
        self.rfq = False
        self.board = {}  # sid -> (C, sheet_id, terms) of each standing sheet that keeps the must-haves
        self.leader = None
        self.last_call = None  # (runner-up sid, its replies when we called, best C then)
        self.calls = 0  # reverse-auction calls made
        self.acceptable = set()  # suppliers whose standing sheet passes the accept check
        self.decided_at, self.slowest = None, 0.0  # wall clock of the last decision; longest gap between two
        self.dead_kinds = set()  # lever_schedule: claim kinds the arena found contradicted or irrelevant
        self.used_refs = set()  # lever_schedule: an ID counts once per case (rival offers aside)

    # ---------- setup ----------
    def setup(self, threads):
        quotes = []
        for events in threads.values():
            _, terms = standing(events[:1])  # the opening quote, also when a case is resumed
            quotes.append((terms, qt.standard_terms(self.case, events)))
        self.c_open = eco.opening_cost(self.case, quotes)
        self.limit = eco.walk_away_limit(self.case, self.c_open)
        sides = {sid: self.new_side(sid, events) for sid, events in threads.items()}
        # C_open and every later C with the same relationship estimate, so comparisons match
        with_estimate = [(standing(threads[sid][:1])[1], side.standard, side.estimate()) for sid, side in sides.items()]
        costs = [
            eco.cost(self.case, t, std, est)
            for t, std, est in with_estimate
            if t.get("unit_price") is not None and must_haves_ok(self.case, t, std)
        ]
        self.c_open = min(costs, default=self.c_open)
        self.limit = eco.walk_away_limit(self.case, self.c_open)
        for side in sides.values():
            ceiling = eco.price_ceiling(self.case, side.mix, self.limit, side.standard, side.estimate())
            side.ceiling = ceiling or 0.0
        self.sides = sides  # all or none: a failed setup is simply tried again on the next move
        log.info(
            "setup %s: C_open %.0f limit %.0f, features off: %s",
            self.case["case_id"],
            self.c_open,
            self.limit,
            ", ".join(flags_off()) or "none",
        )
        if any(m.get("from") == "buyer" for events in threads.values() for m in events):
            self.restore(threads)

    def new_side(self, sid, events):
        case = self.case
        std = qt.standard_terms(case, events)
        _, quote = standing(events[:1]) if events else (None, {})
        dossier = build(case, sid, self.package, quote.get("unit_price"), rich=on("rich_value"))
        if on("quote_cap"):
            dossier.cap_by_quote(quote.get("unit_price"), case["buyer"].get("sustainable_margin_pct"))
        side = Side(sid, dossier, std, _reference_terms(case, events), rich=on("rich_value"))
        if on("measured_rate") and events:
            self.measure_rate(side, events[0])  # a quote with sheets for other payment days
        first = sg.read(events[0]) if events else sg.Reading()
        if on("proactive_clause") and events and not quote.get("index_clause"):
            side.clause, side.driver = self.clause_trade(side, events[0], first, quote)
        if on("rich_value") or side.clause:
            side.extras = self.extras_fn(side)
        est = side.estimate()
        delay = first.delay_days
        shift = 0.0
        if (delay or 0) >= 4 or dossier.owner_type == "founder":
            shift = -PATIENT_SHIFT  # small, slow shops have deep floors
        elif dossier.owner_type == "group" and delay is not None and delay <= 2:
            shift = PATIENT_SHIFT  # groups move little and call final offers early
        persona = self.persona(side, quote) if on("patience") else []
        if "wants_work" in persona:
            shift -= WANTS_WORK_SHIFT
        anchor_ratio = ANCHOR.get(self.goal, 0.85) + shift
        for p in persona:
            anchor_ratio = max(anchor_ratio, ANCHOR_FLOOR.get(p, 0.0))
        ratio = (1 + anchor_ratio) / 2  # where we expect to close, relative to its quote
        if quote.get("unit_price"):
            side.plan = eco.plan_terms(
                case,
                eco_fill(case, quote),
                std,
                est,
                deal_ratio=ratio,
                friendly=on("friendly_ties"),
                options={"index_clause": [side.clause]} if side.clause else None,
            )
        if side.clause and quote.get("unit_price") and not side.plan:  # no allowed mix carries the clause
            side.clause = side.driver = None
            side.plan = eco.plan_terms(
                case, eco_fill(case, quote), std, est, deal_ratio=ratio, friendly=on("friendly_ties")
            )
        mix = dict(side.plan[0][1]) if side.plan else complete_offer(case, quote)
        mix.pop("unit_price", None)
        side.mix = mix
        sp = (self.plan or {}).get("suppliers", {}).get(sid)
        if sp:
            side.mix = mix = self.plan_mix(side, mix, sp, quote, est, ratio)
        q_eq = _their_price(case, quote, mix, est, std)
        stance = STANCE_SHIFT.get((self.plan or {}).get("stance"), 0.0) if on("plan_stance") else 0.0
        anchor = (q_eq or quote.get("unit_price") or 0) * (anchor_ratio + stance)
        best = eco.cheapest_price(case, mix, std, est) if self.goal in RELATIONSHIP_GOALS else 0.0
        anchor = max(anchor, best)
        current = case["buyer"].get("current_unit_price")
        if case.get("type") == "price_increase" and current:
            anchor = min(anchor, current)
        ceiling = eco.price_ceiling(case, mix, self.limit, std, est)
        trade = self.protection_trade(side, events, quote) if on("protection_trade") else None
        if trade:
            mix, anchor, side.clause, side.driver = trade
            side.mix, est, side.protected = mix, side.estimate(), True
            best, ceiling = anchor, eco.price_ceiling(case, mix, self.limit, std, est)
        side.anchor, side.ceiling, side.best_for_us = round(anchor, 2), ceiling or 0.0, best
        if on("patience"):  # the budget itself is set from the first gap, after our first offer
            share = min([PATIENCE["normal"]] + [PATIENCE[p] for p in persona if p in PATIENCE])
            if self.goal in RELATIONSHIP_GOALS:
                share = min(share, PATIENCE["relationship"])
            side.budget_share = share
        side.bank = cl.build_bank(case, dossier, self.package, quote.get("unit_price"))
        if not on("lever_schedule"):  # the order-history and call-note levers came with the schedule
            side.bank = [c for c in side.bank if c.kind not in cl.SCHEDULE_KINDS]
        if not on("call_note_lever"):  # a note cited without data drew requests for proof (v1.7c)
            side.bank = [c for c in side.bank if c.kind != "call_note"]
        if sp:
            side.bank = plan_bank(side.bank, sp)
            side.paragraph = (sp.get("opening_paragraph") or "") if on("plan_paragraph") else ""
        log.info(
            "side %s: mix %s quote~%.2f anchor %.2f (shift %+.2f, delay %s, persona %s) ceiling %s best %.2f"
            " full_cost %s (%s) rate %.3f clause %s budget %s claims %d",
            sid,
            mix,
            q_eq or 0,
            side.anchor,
            shift,
            delay,
            persona,
            ceiling,
            best,
            dossier.full_cost,
            dossier.full_cost_source,
            dossier.interest_rate,
            side.clause,
            side.budget,
            len(side.bank),
        )
        return side

    def plan_mix(self, side, mix, sp, quote, est, ratio):
        """case_plan: an opening trade from the plan replaces our planned option when it keeps the
        must-haves and (contractual: the contract already grants it) costs us no more at the same price,
        or (any other trade) costs us no more once the supplier prices it in: our C at each mix's
        equal-value price x the deal ratio, within the friendly tie band."""
        case, std = self.case, side.standard

        def at_value(m):
            p = _their_price(case, quote, m, est, std) or quote.get("unit_price")
            return complete_offer(case, {**m, "unit_price": round(p * ratio, 2)}) if p else None

        for t in sp.get("trades") or []:
            if t.get("when") != "opening" or mix.get(t["field"]) == t["value"]:
                continue
            if not t.get("contractual") and not on("plan_priced_trades"):
                continue
            new = {**mix, t["field"]: t["value"]}
            before, after = at_value(mix), at_value(new)
            if not before or not after or not must_haves_ok(case, after, std):
                continue
            if t.get("contractual"):  # no price needed: compare at the same price
                after = complete_offer(case, {**new, "unit_price": before["unit_price"]})
            c0, c1 = eco.cost(case, before, std, est), eco.cost(case, after, std, est)
            if c1 <= c0 + max(eco.TIE_EUR, eco.TIE_SHARE * c0):
                log.info("%s: plan trade %s=%s adopted (%s)", side.sid, t["field"], t["value"], t.get("why"))
                mix = new
            else:
                log.info(
                    "%s: plan trade %s=%s costs us %.0f more - not adopted", side.sid, t["field"], t["value"], c1 - c0
                )
        return mix

    def persona(self, side, quote):
        """patience: what kind of supplier this is, from the dossier (v1.7)."""
        d, out = side.dossier, []
        if d.capacity_full:
            out.append("capacity_full")
        price = quote.get("unit_price")
        if d.full_cost and price and "its plant" in d.full_cost_source and d.full_cost >= NEAR_COST * price:
            out.append("near_cost")
        if d.wants_work:
            out.append("wants_work")
        return out

    def clause_trade(self, side, message, reading, quote):
        """proactive_clause: the clause option on a cost driver the supplier asserts, when the clause
        protects it more than it costs us. Widest deadband on that series; none if it is hedged.
        Not in strategic goals: there the price is held at its health price (the relationship charge
        counts cash, not security), so the protection buys us nothing and the index risk still costs."""
        case = self.case
        if "index_clause" not in case["negotiable"] or side.dossier.hedged or "hedged" in reading.traits:
            return None, None
        if self.goal in RELATIONSHIP_GOALS:
            return None, None
        base = complete_offer(case, quote)
        options = [
            o
            for o in case.get("term_options", {}).get("index_clause") or []
            if o and must_haves_ok(case, {**base, "index_clause": o}, side.standard)
        ]
        best = None
        for driver in sg.drivers(message):
            on_series = [o for o in options if o.get("series") == driver.series]
            if not on_series:
                continue
            option = max(on_series, key=lambda o: o.get("deadband_pct", 0))
            worth, costs = eco.clause_value_rate(option, driver), eco.clause_cost_rate(case, option)
            if worth > costs and (best is None or worth - costs > best[0]):
                best = (worth - costs, option, driver)
        if best is None:
            return None, None
        log.info("%s: index clause %s on its asserted driver (net %.3f of the price)", side.sid, best[1], best[0])
        return best[1], best[2]

    def protection_trade(self, side, events, quote):
        """protection_trade (v1.9): relationship goals, an index clause on a cost driver the supplier states
        in its quote, at our health price - when that sheet is worth more to it than its own quote (its
        cash value plus the protection beyond the deadband on the exposure it states, the method that
        matched suppliers' own deadband pricing). A deal there is likely, and our C is lowest there.
        The case's own numbers only, no fitted value. (mix, price, clause, driver) or None."""
        case = self.case
        if (
            self.goal not in RELATIONSHIP_GOALS
            or "index_clause" not in case["negotiable"]
            or quote.get("index_clause")
            or not quote.get("unit_price")
            or side.dossier.hedged
            or not events
        ):
            return None
        drivers = {d.series: d for d in sg.drivers(events[0])}
        allowed = case.get("term_options", {}).get("index_clause") or []
        options = [o for o in allowed if o and o.get("series") in drivers]
        std, own_sheet, best, saved = side.standard, eco_fill(case, quote), None, side.driver
        try:
            for clause in options:
                side.driver = drivers[clause["series"]]
                est = side.estimate()
                own = eco.value(case, own_sheet, est)  # its quote carries no clause: no protection
                for mix in eco.term_mixes(case, complete_offer(case, quote), {"index_clause": [clause]}):
                    terms = {k: v for k, v in mix.items() if k != "unit_price"}
                    if not must_haves_ok(case, complete_offer(case, {**terms, "unit_price": 1.0}), std):
                        continue
                    health = eco.cheapest_price(case, terms, std, est)
                    if eco.value(case, {**terms, "unit_price": health}, est) < own:
                        continue  # worth less to it than its own quote: no deal at our best price
                    c = eco.cost_at(case, terms, health, std, est)
                    if c < self.limit and (best is None or c < best[0]):
                        best = (c, terms, health, clause, side.driver)
        finally:
            side.driver = saved
        if best is None:
            return None
        c, terms, health, clause, driver = best
        log.info("%s: protection trade - clause %s at our health price %.2f (C %.0f)", side.sid, clause, health, c)
        return terms, health, clause, driver

    def extras_fn(self, side):
        """What a sheet costs or brings this supplier beyond the kit's items, EUR per unit."""

        def extras(t, deal):
            price, out = t["unit_price"], 0.0
            if on("rich_value"):
                own_lead, lead = side.reference.get("lead_time_days"), t.get("lead_time_days")
                if own_lead and lead is not None and lead < own_lead:  # overtime for a faster delivery
                    per_day = OVERTIME_FULL if side.dossier.capacity_full else OVERTIME
                    out -= price * per_day * (own_lead - lead)
                own_volume, volume = side.reference.get("volume_per_year"), t.get("volume_per_year")
                if side.dossier.wants_work and own_volume and volume and volume > own_volume:
                    out += price * VOLUME_PLUS * (volume / own_volume - 1)  # fills idle capacity
            clause = t.get("index_clause")
            if deal and side.driver and clause and clause.get("series") == side.driver.series:
                out += price * eco.clause_value_rate(clause, side.driver)  # protection, not cash
            return out

        return extras

    def restore(self, threads):
        """The runner restarted mid-case: rebuild each side from the thread - our prices, its prices
        (replaying what we read), the claims we already made."""
        case = self.case
        for sid, events in threads.items():
            side, texts = self.sides[sid], []
            for i, m in enumerate(events):
                if m.get("from") == "buyer":
                    sheets = m.get("term_sheets") or []
                    terms = (sheets[0].get("terms") if sheets else None) or {}
                    if terms.get("unit_price") is not None:
                        side.ours.append(terms["unit_price"])
                        side.last_main = complete_offer(case, terms)
                    texts.append(f"{m.get('body') or ''} {' '.join(m.get('refs') or [])}")
                else:
                    self.observe(side, events[: i + 1])
            cited = set(ID.findall(" ".join(texts)))
            for c in side.bank:
                if c.refs and set(c.refs) <= cited:
                    side.used.add(c.key)
                    side.kinds_used.add(c.kind)
                    self.used_refs |= set(c.refs)
            side.used |= {f"{sid}|{ref}" for ref in cited if ref.startswith("offer:")}
            log.info("%s: resumed with our prices %s, theirs %s", sid, side.ours, [round(p, 2) for p in side.theirs])

    # ---------- per move ----------
    def decide(self, threads):
        now = time.time()
        if self.decided_at:  # one message and its reply lie between two decisions
            self.slowest = max(self.slowest, min(now - self.decided_at, MOVE_LIMIT_S))
        self.decided_at = now
        if not self.sides or any(sid not in self.sides for sid in threads):
            self.sides = {}
            self.setup(threads)
        live = live_threads(threads)
        for sid in live:
            self.settle(self.sides[sid], threads[sid])
        for sid in live:
            self.observe(self.sides[sid], threads[sid])

        self.rfq = len(live) > 1
        self.board = {}
        for sid in live:
            side = self.sides[sid]
            sheet_id, terms = standing(threads[sid])
            if sheet_id and terms.get("unit_price") is not None and must_haves_ok(self.case, terms, side.standard):
                self.board[sid] = (eco.cost(self.case, terms, side.standard, side.estimate()), sheet_id, terms)
        leader = min(self.board, key=lambda s: self.board[s][0]) if self.board else None
        self.leader = leader

        # the best sheet any supplier stands on right now, if it passes the accept check
        offers = []
        for sid in live:
            side, events = self.sides[sid], threads[sid]
            sheet_id, terms = standing(events)
            if not sheet_id:
                continue
            ok, why = eco.accept_check(self.case, terms, side.standard, side.estimate(), self.c_open)
            if ok:
                offers.append((eco.cost(self.case, terms, side.standard, side.estimate()), sid, sheet_id, why))
        offers.sort()
        best = offers[0] if offers else None
        self.acceptable = {sid for _, sid, _, _ in offers}

        ready = {sid: self.ready(self.sides[sid], threads[sid]) for sid in live}
        if self.rfq:
            move = self.rfq_close(threads, live, ready, best, leader)
            if move:
                return move
            for sid in live:  # bidders that cannot catch the leader get no more rounds
                side = self.sides[sid]
                if (
                    leader
                    and sid != leader
                    and sid in self.board
                    and len(side.theirs) >= 2
                    and self.board[sid][0] > self.board[leader][0] * (1 + DROP_GAP)
                    and not side.dropped
                ):
                    side.dropped = True
                    log.info(
                        "%s: %.0f is >%d%% above the leader's C - no more rounds",
                        sid,
                        self.board[sid][0],
                        DROP_GAP * 100,
                    )
        # close on the best standing sheet once its supplier is ready, or every thread is
        if best and (ready[best[1]] or all(ready.values())):
            return self.accept(best, ready[best[1]])
        finished = all(
            self.status(self.sides[s], threads[s]) == "final_offer" or moves_left(self.case, threads[s]) <= 0
            for s in live
        )
        if not best and finished:
            return self.walk(live[0], "no standing sheet passes the accept check")

        # otherwise negotiate with the supplier that has waited longest (oldest reply first);
        # a supplier at final_offer never gets another price (it walks when pushed)
        can = [
            s
            for s in live
            if moves_left(self.case, threads[s]) > 0 and self.status(self.sides[s], threads[s]) != "final_offer"
        ]
        talk = [s for s in can if not ready[s] and not self.sides[s].dropped]
        if not talk:
            talk = [s for s in can if not ready[s]]
        if not talk:
            talk = can
        if not talk:
            return self.accept(best, "no moves left") if best else self.walk(live[0], "no moves left")
        sid = min(talk, key=lambda s: self.sides[s].seen)
        return self.keepalive(threads, live, ready, sid) or self.offer(self.sides[sid], threads, offers, leader)

    def settle(self, side, events):
        """Our last move to this supplier: kept once it answered; rolled back when the arena answered
        instead (a late send never reached it - our previous offer was repeated)."""
        p, side.pending = side.pending, None
        if not p or not events or events[-1].get("from") != "arena":
            return
        if p["price"] is not None and side.ours and side.ours[-1] == p["price"]:
            side.ours.pop()
        side.used -= set(p["keys"])
        side.kinds_used -= set(p["kinds"])
        self.used_refs -= set(p["refs"])
        side.trades -= set(p["trades"])
        side.last_main = p["main"]
        side.sent_claims = []
        side.holds, side.clause_said, side.rival_cited = p["holds"], p["clause_said"], p["rival_cited"]
        if self.last_call and self.last_call[0] == side.sid:  # an auction call that never arrived
            self.last_call = None
        log.info(
            "%s: our last message came too late - rolled back price %s and claims %s", side.sid, p["price"], p["keys"]
        )

    def status(self, side, events):
        """Its latest status; with keepalive, a sheet it agreed to (or made final) stays so after a
        sheetless reply that leaves the same sheet standing."""
        status = latest(events).get("status")
        if status not in DONE and on("keepalive") and side.done:
            _, terms = standing(events)  # every reply carries a new offer ID: compare the terms
            if terms and terms == side.done[2]:
                return side.done[1]
        return status

    def keepalive(self, threads, live, ready, target):
        """RFQ: a ready thread we could accept gets a sheetless note (its offer stands) once it has
        waited KEEPALIVE_S - or sooner, when the slowest reply so far would make it late."""
        if not (on("keepalive") and self.rfq):
            return None
        now = time.time()
        wait = max(1.0, min(KEEPALIVE_S, MOVE_LIMIT_S - self.slowest - KEEPALIVE_MARGIN))
        waiting = [
            s
            for s in live
            if s != target
            and ready.get(s)
            and s in self.acceptable
            and now - self.sides[s].reply_at > wait
            and moves_left(self.case, threads[s]) > 1
            and self.sides[s].keepalives < KEEPALIVE_MAX
        ]
        if not waiting:
            return None
        sid = min(waiting, key=lambda s: self.sides[s].reply_at)
        side = self.sides[sid]
        side.keepalives += 1
        self.sent(side, None)
        return {
            "supplier_id": sid,
            "note": True,
            "sheets": [],
            "claims": [],
            "answers": [KEEPALIVE_TEXT],
            "why": {"keepalive": f"ready ({ready[sid]}), waited {now - side.reply_at:.0f}s"},
        }

    def rfq_close(self, threads, live, ready, best, leader):
        """Reverse auction: once the leader is ready, the best runner-up is asked to beat it; while
        the best C keeps improving, the new runner-up is asked next. Agreed offers stand, so nobody
        is at risk; a bidder at final_offer is never pushed. Then we take the best sheet in C."""
        if not best or leader is None or best[1] != leader:
            return None
        if self.last_call:  # a call is out: wait for its reply, then judge it
            runner, replies, c_before = self.last_call
            if runner in live and self.sides[runner].replies <= replies:
                return None
            self.last_call = None
            self.calls += 1
            if best[0] >= c_before * (1 - AUCTION_MIN_GAIN) or self.calls >= AUCTION_CALLS:
                return self.accept(best, f"best after {self.calls} auction call(s)")
        elif not ready.get(leader):
            return None
        runners = [
            s
            for s in live
            if s != leader
            and moves_left(self.case, threads[s]) > 0
            and s in self.board
            and not self.sides[s].dropped
            and self.status(self.sides[s], threads[s]) != "final_offer"
        ]
        move = None
        if runners:
            runner = min(runners, key=lambda s: self.board[s][0])
            keep = self.keepalive(threads, live, ready, runner)
            if keep:
                return keep
            move = self.last_call_offer(self.sides[runner], threads, leader)
            if move:
                self.last_call = (runner, self.sides[runner].replies, best[0])
        if move is None and self.calls:
            return self.accept(best, f"best after {self.calls} auction call(s), no runner-up left")
        return move

    def last_call_offer(self, side, threads, leader):
        case, std = self.case, side.standard
        target = self.board[leader][0] * (1 - AUCTION_EDGE)
        price = eco.equal_cost_price(case, side.mix, target, std)
        if not price or price == math.inf or price <= 0:
            return None
        if side.theirs:
            price = min(price, side.theirs[-1] * 0.998)
        price = round(price, 2)
        main = complete_offer(case, {**side.mix, "unit_price": price})
        if main["unit_price"] <= 0 or not must_haves_ok(case, main, std):
            return None
        claims = self.pick_claims(side, [], leader, rival_only=True)
        self.sent(side, price, main)
        return {
            "supplier_id": side.sid,
            "sheets": [main],
            "claims": claims,
            "answers": [
                "Another supplier has agreed to terms that cost us less overall. If you can meet the package "
                "below, please send it now; otherwise we will proceed with the other offer."
            ],
            "why": {"price": price, "last_call": True, "leader": leader, "leader_c": round(self.board[leader][0])},
        }

    def observe(self, side, events):
        their = [m for m in events if m.get("from") != "buyer"]
        if len(their) <= side.replies:
            return
        for m in their[side.replies :]:
            side.last = sg.read(m)
            side.asks |= side.last.asks
            self.read_results(side, m)
        side.replies = len(their)
        side.reply_at = time.time()
        side.seen = sum(len(s.theirs) for s in self.sides.values())  # arrival order across threads
        sheet_id, terms = standing(events)
        if sheet_id and latest(events).get("status") in DONE:
            side.done = (sheet_id, latest(events)["status"], dict(terms))
        before = (side.dossier.full_cost, side.dossier.interest_rate)
        if terms.get("unit_price") is not None and not on("quote_cap"):
            side.dossier.bound_full_cost(terms["unit_price"])
        if on("measured_rate") and self.measure_rate(side, latest(events)):
            side.rate_raised = True  # its own price for time replaces any premium
        if terms.get("unit_price") is not None:
            price = _their_price(self.case, terms, side.mix, side.estimate(), side.standard)
            side.theirs.append(price if price else terms["unit_price"])
        else:
            side.theirs.append(side.theirs[-1] if side.theirs else math.inf)
        changed = (side.dossier.full_cost, side.dossier.interest_rate) != before
        if changed and on("measured_rate") and side.dossier.rate_measured:
            self.replan(side, events, "its own sheets show its cost of money")
        self.react(side, events)
        if changed and on("health_refresh"):
            self.set_mix(side, side.mix)  # health price and ceiling follow the new estimate

    def measure_rate(self, side, message):
        """measured_rate (v1.8): its cost of money from two of its own sheets in one message that differ
        only in payment days. True when it changed the estimate."""
        sheets = [ts.get("terms") or {} for ts in message.get("term_sheets") or []]
        for alt in sheets[1:]:
            rate = eco.implied_rate(self.case, sheets[0], alt, side.reference)
            if rate is None or not RATE_RANGE[0] <= rate <= RATE_RANGE[1]:
                continue
            old = side.dossier.interest_rate
            side.dossier.interest_rate, side.dossier.rate_measured = rate, True
            if abs(rate - old) > 1e-5:
                log.info("%s: its sheets put its rate at %.2f %% (was %.2f %%)", side.sid, 100 * rate, 100 * old)
                return True
            return False
        return False

    def read_results(self, side, message):
        """lever_schedule: a claim kind the arena found contradicted or irrelevant is not used again."""
        results, sent = message.get("claim_results") or [], side.sent_claims
        side.sent_claims = []
        if not on("lever_schedule") or not results or len(results) != len(sent):
            return  # without a one-to-one match we cannot tell which argument it judged
        for r in results:
            i = r.get("index")
            if isinstance(i, int) and 0 <= i < len(sent) and r.get("result") in DEAD_RESULTS:
                kind = sent[i].kind
                if kind != "rival_offer" and kind not in self.dead_kinds:
                    log.info("%s: %s came back %s - no more %s claims", side.sid, sent[i].key, r["result"], kind)
                    self.dead_kinds.add(kind)

    def react(self, side, events):
        """Act on what its latest e-mail said and on any alternative sheets it sent."""
        case = self.case
        if "payment" in side.last.asks and not side.rate_raised and "payment_days" in case["negotiable"]:
            side.rate_raised = True
            if not side.dossier.cash_need and not side.dossier.rate_measured:
                side.dossier.interest_rate += CASH_PREMIUM
            self.replan(side, events, "it asked for faster payment")
        if "hedged" in side.last.traits:
            side.bank = [c for c in side.bank if c.kind != "index_change"]
            if side.clause:  # its material is bought forward: the clause protects it little
                side.clause = side.driver = None
                self.replan(side, events, "it is hedged")
        if on("proactive_clause"):
            self.adopt_clause(side, events)
        sheets = latest(events).get("term_sheets") or []
        if len(sheets) > 1 and sheets[0]["terms"].get("unit_price") is not None:
            est, std = side.estimate(), side.standard
            standing_c = eco.cost(case, sheets[0]["terms"], std, est)
            for ts in sheets[1:]:
                terms = ts.get("terms") or {}
                if terms.get("unit_price") is None or not must_haves_ok(case, terms, std):
                    continue
                if side.clause_adopted and terms.get("index_clause") != side.mix.get("index_clause"):
                    continue  # proactive_clause: it demanded its clause - we keep it and talk price
                if eco.cost(case, terms, std, est) < standing_c - 1:
                    mix = {k: v for k, v in complete_offer(case, terms).items() if k != "unit_price"}
                    log.info(
                        "%s: its alternative %s costs us less - adopting its terms %s",
                        side.sid,
                        ts.get("term_sheet_id"),
                        mix,
                    )
                    self.set_mix(side, mix)
                    side.theirs[-1] = terms["unit_price"]
                    standing_c = eco.cost(case, terms, std, est)

    def adopt_clause(self, side, events):
        """proactive_clause: it demands an index clause - take its option into our mix and negotiate
        the base price, instead of sending another deadband."""
        case = self.case
        if "clause" not in side.last.asks or "index_clause" not in case["negotiable"]:
            return
        options = [o for o in case.get("term_options", {}).get("index_clause") or [] if o]
        sheets = latest(events).get("term_sheets") or []
        wanted = next(
            (ts["terms"]["index_clause"] for ts in sheets if (ts.get("terms") or {}).get("index_clause") in options),
            None,
        )
        if not wanted or side.mix.get("index_clause") == wanted:
            return
        mix = {**side.mix, "index_clause": wanted}
        if not must_haves_ok(case, complete_offer(case, {**mix, "unit_price": 1.0}), side.standard):
            return
        log.info("%s: it demands a clause - adopting %s", side.sid, wanted)
        side.clause, side.clause_adopted = wanted, True  # the plan keeps it from now on
        if side.driver and side.driver.series != wanted.get("series"):
            side.driver = None
        self.set_mix(side, mix)
        _, terms = standing(events)
        if side.theirs and terms.get("unit_price") is not None:
            side.theirs[-1] = _their_price(case, terms, side.mix, side.estimate(), side.standard) or side.theirs[-1]

    def set_mix(self, side, mix):
        """A new term mix: the price ceiling and the relationship optimum follow it."""
        side.mix = mix
        est = side.estimate()
        side.ceiling = eco.price_ceiling(self.case, mix, self.limit, side.standard, est) or 0.0
        if self.goal in RELATIONSHIP_GOALS:
            side.best_for_us = eco.cheapest_price(self.case, mix, side.standard, est)

    def replan(self, side, events, why):
        """Re-rank the term mixes with what we now know about the supplier."""
        _, terms = standing(events)
        if terms.get("unit_price") is None:
            return
        ratio = (side.anchor / side.theirs[0]) if side.theirs and side.theirs[0] else 0.9
        plan = eco.plan_terms(
            self.case,
            eco_fill(self.case, terms),
            side.standard,
            side.estimate(),
            deal_ratio=(1 + ratio) / 2,
            friendly=on("friendly_ties"),
            options={"index_clause": [side.clause]} if side.clause else None,
        )
        if plan:
            side.plan = plan
            new = {k: v for k, v in plan[0][1].items() if k != "unit_price"}
            if new != side.mix:
                log.info("%s: re-planned terms (%s): %s -> %s", side.sid, why, side.mix, new)
                self.set_mix(side, new)
                side.theirs[-1] = (
                    _their_price(self.case, terms, side.mix, side.estimate(), side.standard) or side.theirs[-1]
                )

    def ready(self, side, events):
        """Is this supplier at the point where we should take its standing sheet?"""
        status = self.status(side, events)
        below_health = (
            self.goal in RELATIONSHIP_GOALS
            and side.best_for_us
            and side.theirs
            and side.theirs[-1] < side.best_for_us * HEALTH_BAND
        )
        left = moves_left(self.case, events)
        if status == "final_offer" or left <= 1:
            return status or "last move"
        if status == "agreed":
            return False if below_health else "agreed"  # below its health price: counter at that price
        if not side.ours or not side.theirs:
            return False
        # proactive_clause: its price on our mix counts the clause's protection; a sheet without our
        # clause is only comparable once it says agreed or final
        if side.driver and not _has_clause(standing(events)[1], side.driver.series):
            return False
        if on("strict_accept") and side.theirs[-1] <= side.ours[-1]:
            return "at or below our offer"
        if side.theirs[-1] <= side.ours[-1] * (1 + CLOSE_GAP):
            if not (on("strict_accept") and left > STRICT_MOVES and self.fresh_lever(side)):
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
            price = self.patience_cap(side, price)
        else:
            first_drop = (side.theirs[0] - side.theirs[1]) / side.theirs[0] if len(side.theirs) > 1 else 0
            last_drop = (side.theirs[-2] - side.theirs[-1]) / side.theirs[-2] if len(side.theirs) > 1 else 0
            deep = (len(side.ours) == 1 and first_drop >= DEEP_DROP) or (self.rfq and last_drop >= DEEP_DROP)
            step = HOLD_STEP if deep else STEP
            price = side.ours[-1] + step * (theirs - side.ours[-1])
            price = max(price, side.ours[-1])
            price = self.patience_cap(side, price)
        if side.ceiling:
            price = min(price, side.ceiling)
        price = min(price, theirs * 0.998)
        if on("strict_accept") and side.ours:  # never step back below our own last offer
            price = max(price, min(side.ours[-1], side.ceiling or math.inf))
        if side.protected and side.best_for_us:
            # protection_trade: with the clause it would take less than our health price, and below it
            # the relationship charge outgrows the saving - our health price is the lowest we offer
            price = max(price, min(side.best_for_us, side.ceiling or math.inf))
        return round(max(price, 0.01), 2)

    def patience_cap(self, side, price):
        """patience: our concessions in total stay within the budget; each step takes at most half
        of what is left of it."""
        if not on("patience") or side.budget_share is None or not side.ours or not side.theirs:
            return price
        if side.budget is None:  # the opening gap: its first price on our mix less our first offer
            side.budget = round(side.budget_share * max(0.0, side.theirs[0] - side.ours[0]), 4)
        room = max(0.0, side.budget - (side.ours[-1] - side.ours[0]))
        return min(price, side.ours[-1] + room / 2)

    def offer(self, side, threads, offers, leader=None):
        case, std = self.case, side.standard
        events = threads[side.sid]
        first = not side.ours
        if on("silence") and "clarify" in side.last.traits and side.last_main and side.ours and not side.holds:
            return self.hold(side)
        side.holds = 0
        price = self.next_price(side)
        main = complete_offer(case, {**side.mix, "unit_price": price})
        c_main = total_cost(case, main, std)  # iso-cost sheets: our cash cost only, no relationship estimate
        sheets, clause, trade = [main], None, None
        if on("single_sheet"):
            found = self.need_trade(side, main)
            if found:
                sheets.append(found[0])
                trade = found[1]
        else:
            sheets, clause = self.menu(side, events, main, c_main, leader)
        claims = self.pick_claims(side, offers, leader)
        self.sent(side, price, main, [(trade["field"], trade["value"])] if trade else [])
        return {
            "supplier_id": side.sid,
            "sheets": sheets,
            "claims": claims,
            "trade": trade["why"] if trade else None,
            "paragraph": side.paragraph if first else "",
            "ask_breakdown": first and on("ask_breakdown"),
            # single_sheet: "open to faster payment, as shown" only when a sheet shows it
            "cash_line": not on("single_sheet")
            or any((s.get("payment_days") or 999) < (side.reference.get("payment_days") or 0) for s in sheets),
            "answers": self.answers(side, main, sheets, clause) + self.leader_terms_line(side, leader, claims),
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
                "budget": side.budget,
                "trade": trade,
            },
        }

    def menu(self, side, events, main, c_main, leader):
        """v1.6c (single_sheet off): the main sheet plus packages that cost us the same."""
        case, std = self.case, side.standard
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
        if self.rfq and leader and leader != side.sid and len(sheets) < 3:  # compete on the whole package
            lead_mix = {k: v for k, v in complete_offer(case, self.board[leader][2]).items() if k != "unit_price"}
            if not any(_same_mix(lead_mix, s) for s in sheets):
                p = eco.equal_cost_price(case, lead_mix, c_main, std)
                if p and p < math.inf and p > 0:
                    sheet = complete_offer(case, {**lead_mix, "unit_price": p})
                    if must_haves_ok(case, sheet, std):
                        sheets.insert(1, sheet)
                        sheets = sheets[:3]
        clause = self.clause_sheet(side, main, c_main)
        if clause and len(sheets) < 3:
            sheets.insert(1, clause)
        else:
            clause = None  # not sent: say nothing about it
        if self.goal in RELATIONSHIP_GOALS and side.best_for_us:  # never offer below its health point
            floor = side.best_for_us * 0.995
            sheets = [main] + [s for s in sheets[1:] if s["unit_price"] >= floor]
            clause = clause if clause in sheets else None
        return sheets, clause

    def need_trade(self, side, main):
        """single_sheet: one sheet that changes one field for what it asked for or needs, worth the
        same to it as the main sheet and cheaper for us by more than TRADE_GAIN. Each trade once."""
        case, std, b = self.case, side.standard, self.case["buyer"]
        d, wanted = side.dossier, []
        if "payment" in side.asks or d.cash_need:
            wanted.append(("payment_days", -1, "your wish for faster payment"))
        if "volume" in side.asks or d.wants_work:
            wanted.append(("volume_per_year", 1, "your wish for a firm volume"))
        if d.capacity_full:
            wanted += [("lead_time_days", 1, "your capacity"), ("contract_months", 1, "your capacity planning")]
        est = side.estimate()
        target, c_main = eco.value(case, main, est), eco.cost(case, main, std, est)
        floor = side.best_for_us * 0.995 if self.goal in RELATIONSHIP_GOALS and side.best_for_us else 0.0
        found = []
        for name, direction, why in wanted:
            if name not in case["negotiable"] or main.get(name) is None:
                continue
            for value in case.get("term_options", {}).get(name) or []:
                if not isinstance(value, int | float) or (value - main[name]) * direction <= 0:
                    continue
                if (name == "volume_per_year" and value > b["need_per_year"]) or (
                    name == "lead_time_days" and value > b["need_lead_time_days"]
                ):
                    continue
                if (name, value) in side.trades:
                    continue
                terms = {**main, name: value}
                p = eco.price_for_value(case, terms, est, target)
                if not p or not math.isfinite(p) or p <= 0:
                    continue
                sheet = complete_offer(case, {**terms, "unit_price": round(p, 2)})
                if sheet["unit_price"] <= 0 or sheet["unit_price"] < floor or not must_haves_ok(case, sheet, std):
                    continue
                c = eco.cost(case, sheet, std, est)
                if c < c_main - TRADE_GAIN:
                    found.append((c, name, value, why, sheet))
        if not found:
            return None
        c, name, value, why, sheet = min(found, key=lambda x: x[0])
        side.trades.add((name, value))
        return sheet, {"field": name, "value": value, "why": why, "saves": round(c_main - c)}

    def hold(self, side):
        """silence: it is clarifying internally - our last main sheet stands, unchanged, no claims."""
        main = side.last_main
        side.claim_log, side.sent_claims = ((), frozenset(), frozenset()), []
        self.sent(side, main["unit_price"], main)
        side.holds += 1  # once in a row: if it still clarifies after that, we move again
        return {
            "supplier_id": side.sid,
            "sheets": [main],
            "claims": [],
            "hold": True,
            "answers": [HOLD_TEXT],
            "why": {"price": main["unit_price"], "hold": "it clarifies internally - our proposal stands"},
        }

    def replace_move(self, side, move):
        """tactician (v2.0): its move goes out instead of the engine's. Undo the engine's pending record
        and record this one, so prices, claims, the term mix and a later rollback match what was sent."""
        p, side.pending = side.pending, None
        if p:
            if p["price"] is not None and side.ours and side.ours[-1] == p["price"]:
                side.ours.pop()
            side.used -= set(p["keys"])
            side.kinds_used -= set(p["kinds"])
            self.used_refs -= set(p["refs"])
            side.trades -= set(p["trades"])
            side.last_main = p["main"]
            side.holds, side.clause_said, side.rival_cited = p["holds"], p["clause_said"], p["rival_cited"]
        if move.get("action"):
            return  # an accept ends the case: nothing pending
        claims = move.get("claims") or []
        own = [c for c in claims if c.kind != "rival_offer"]
        keys = tuple(c.key for c in claims)
        kinds = frozenset(c.kind for c in own) - side.kinds_used
        refs = frozenset(r for c in own for r in c.refs) - self.used_refs
        side.used |= set(keys)
        side.kinds_used |= kinds
        self.used_refs |= refs
        side.claim_log, side.sent_claims = (keys, kinds, refs), list(claims)
        main = move["sheets"][0]
        mix = {k: v for k, v in main.items() if k != "unit_price"}
        if mix != side.mix:
            self.set_mix(side, mix)  # the engine's next move (the fallback) continues on these terms
        if move.get("hold"):
            side.holds += 1
        self.sent(side, main["unit_price"], main)

    def sent(self, side, price, main=None, trades=()):
        """Record a move as pending until the supplier answers (see `settle`)."""
        keys, kinds, refs = side.claim_log
        side.claim_log = ((), frozenset(), frozenset())
        side.pending = {
            "price": price,
            "keys": tuple(keys),
            "kinds": frozenset(kinds),
            "refs": frozenset(refs),
            "trades": frozenset(trades),
            "main": side.last_main,
            "holds": side.holds,
            "clause_said": side.clause_said,
            "rival_cited": dict(side.rival_cited),
        }
        if price is not None:
            side.ours.append(price)
        if main is not None:
            side.last_main = main

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

    def leader_terms_line(self, side, leader, claims):
        """The leader's better non-price terms, in words (no figures, so nothing to contradict)."""
        if not leader or leader == side.sid or not any(c.kind == "rival_offer" for c in claims):
            return []
        lead = closing_terms(self.case, self.board[leader][2], self.sides[leader].standard)
        own = closing_terms(self.case, standing_terms(self, side), side.standard)
        better = []
        if lead.get("lead_time_days") and own.get("lead_time_days") and lead["lead_time_days"] < own["lead_time_days"]:
            better.append("a shorter lead time")
        if lead.get("payment_days") and own.get("payment_days") and lead["payment_days"] > own["payment_days"]:
            better.append("longer payment terms")
        return [f"That offer also comes with {' and '.join(better)}."] if better else []

    def answers(self, side, main, sheets, clause):
        """Sentences that answer what it asked for, in words."""
        case, out = self.case, []
        t = closing_terms(case, main, side.standard)
        where = "in our proposal below" if on("single_sheet") and len(sheets) == 1 else "in the packages below"
        if "volume" in side.last.asks:
            out.append(
                f"We can commit to {t['volume_per_year']:,} pieces per year over {t['contract_months']} months, "
                f"as set out {where}."
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
        elif on("proactive_clause") and main.get("index_clause") and not side.clause_said:
            side.clause_said = True
            if side.clause_adopted:
                out.append("Our proposal includes the price adjustment clause you asked for.")
            else:
                out.append("Our proposal includes a price adjustment clause on the cost driver you named.")
        if "price_frozen" in side.last.traits:
            out.append("We understand that your price is fixed for now, so we have looked at the terms instead.")
        return out

    def rival(self, side, leader):
        """(key, claim) of the rival offer to cite to this supplier now, or None: the leader's offer,
        or to the leader itself the runner-up's lower price; each offer once per supplier."""
        rival = leader if leader and leader != side.sid and leader in self.board else None
        if rival is None and side.sid in self.board:  # the leader itself: the runner-up's lower price
            own_price = self.board[side.sid][2].get("unit_price") or 0
            cheaper = [
                s for s in self.board if s != side.sid and (self.board[s][2].get("unit_price") or 1e18) < own_price
            ]
            rival = min(cheaper, key=lambda s: self.board[s][2]["unit_price"]) if cheaper else None
        if rival:
            _, rsheet, rterms = self.board[rival]
            key, price = f"{side.sid}|{rsheet}", rterms.get("unit_price")
            if on("lever_schedule") and side.rival_cited.get(rival) == price:
                return None  # the same price under a new offer ID is not a new argument
            if key not in side.used and price is not None:
                return key, cl.rival_claim(rsheet, price), rival
        return None

    def lever_ok(self, side, claim, taken):
        """Can this claim go into the next message? lever_schedule: a kind it has not heard, not
        dropped for the case, no ID already cited in this case."""
        if claim.key in side.used or any(claim.key == o.key for o in taken):
            return False
        if on("lever_schedule"):
            if (
                claim.kind in side.kinds_used
                or claim.kind in self.dead_kinds
                or any(claim.kind == o.kind for o in taken)
            ):
                return False
            refs = set(claim.refs)
            if refs & self.used_refs or any(refs & set(o.refs) for o in taken):
                return False
        return True

    def fresh_lever(self, side):
        """strict_accept: is there still an argument we have not used with this supplier?"""
        return self.rival(side, self.leader) is not None or any(self.lever_ok(side, c, []) for c in side.bank)

    def pick_claims(self, side, offers, leader=None, rival_only=False):
        n = FIRST_CLAIMS if not side.ours else (DATA_CLAIMS if "data" in side.last.asks else LATER_CLAIMS)
        out, keys = [], []
        # RFQ: the rival bid that is best in total cost is the strongest argument; cite each new offer
        rival = self.rival(side, leader)
        if rival:
            key, claim, rival_sid = rival
            out.append(claim)
            side.used.add(key)
            keys.append(key)
            side.rival_cited[rival_sid] = claim.figures["unit_price"]
        if not rival_only:
            for c in side.bank:
                if len(out) >= n:
                    break
                if self.lever_ok(side, c, out):
                    out.append(c)
                    side.used.add(c.key)
                    keys.append(c.key)
        kinds, refs = frozenset(), frozenset()
        if on("lever_schedule"):
            own = [c for c in out if c.kind != "rival_offer"]
            kinds = frozenset(c.kind for c in own) - side.kinds_used
            refs = frozenset(r for c in own for r in c.refs) - self.used_refs
            side.kinds_used |= kinds
            self.used_refs |= refs
        side.claim_log = (tuple(keys), kinds, refs)
        side.sent_claims = list(out)
        return out

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


def standing_terms(negotiator, side):
    entry = negotiator.board.get(side.sid)
    return entry[2] if entry else {}


def eco_fill(case, terms):
    """A quote's terms with every negotiable field present (gaps from the buyer's plan)."""
    return complete_offer(case, terms) | {"unit_price": terms.get("unit_price")}


def _reference_terms(case, events):
    """The supplier's own terms, complete: its opening offer, its standard terms, the terms fixed by
    the enquiry, then the buyer's plan for any gap. The baseline its cash value is measured against."""
    parsed = qt.first_quote(case, events)
    _, opening = standing(events[:1]) if events else (None, {})
    stated = {**opening, **parsed.get("stated", {})}
    ref = closing_terms(case, {**stated, "unit_price": None}, {**parsed.get("standard", {}), **parsed.get("fixed", {})})
    ref.pop("unit_price", None)
    return qt.sane(case, ref)


def _their_price(case, terms, mix, est, std):
    """Its standing offer, converted to the price that would be worth the same to it on our mix."""
    if terms.get("unit_price") is None:
        return None
    try:
        worth = eco.value(case, {**terms}, est)
        p = eco.price_for_value(case, {**mix}, est, worth)
        return p if p and p > 0 else terms["unit_price"]
    except Exception:
        log.exception("price conversion failed")
        return terms["unit_price"]


def plan_bank(bank, sp):
    """case_plan: the plan's levers first (the library's verified sentences, in the plan's order: opening,
    later, then the rest of our bank, then those for a challenge); blocked arguments and repeats removed."""
    blocked = {r for b in sp.get("blocked") or [] for r in b.get("refs") or []}
    planned = {"opening": [], "later": [], "if_challenged": []}
    for i, lv in enumerate(sp.get("levers") or []):
        arg = lv.get("argument") or {}
        if not arg.get("checkable") or arg.get("side") != "for_us" or not arg.get("sentence") or not arg.get("refs"):
            continue
        claim = cl.Claim(arg["kind"], arg["sentence"], list(arg["refs"]), 100 - i, dict(arg.get("figures") or {}))
        planned.get(lv.get("when"), planned["later"]).append(claim)
    used = {r for group in planned.values() for c in group for r in c.refs}
    rest = [c for c in bank if not set(c.refs) & (used | blocked)]
    return planned["opening"] + planned["later"] + rest + planned["if_challenged"]


def _has_clause(terms, series):
    clause = (terms or {}).get("index_clause")
    return bool(clause) and clause.get("series") == series


def _same_mix(a, b):
    keys = (set(a) | set(b)) - {"unit_price"}
    return all(a.get(k) == b.get(k) for k in keys)
