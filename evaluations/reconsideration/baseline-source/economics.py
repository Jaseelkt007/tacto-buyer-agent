"""Economics: every binding number the agent sends or accepts comes from here, never from the model.

Built on the kit's published cost function (`arena_kit.cost`). A "supplier estimate" is the dict
`supplier_value` and `relationship_cost` take: {"standard", "interest_rate", "full_cost", ...}.
Without an estimate the relationship charge (stabilise / secure_supply) is left out, so pass one
whenever the dossier has it.

v1.7: an estimate may also carry `"extras": fn(terms, deal) -> EUR per unit` - what one sheet costs
or brings the supplier beyond the kit's items (overtime for a faster delivery, idle capacity a
larger volume fills; with `deal`, also the protection an index clause on its asserted driver gives
it). `cost` and `value` resolve it per sheet. The arena's relationship charge counts cash only, so
`cost` never includes the clause protection.
"""

import itertools
import math

from ...cost import RELATIONSHIP_GOALS, closing_terms, complete_offer, must_haves_ok, supplier_value, total_cost

GOLDEN = (math.sqrt(5) - 1) / 2
MAX_COMBOS = 2000
TIE_EUR, TIE_SHARE = 1.0, 0.001  # friendly tie-break: mixes within max(EUR 1, 0.1 % of C) of the cheapest


def _for_sheet(case, supplier, terms, deal):
    """The kit's estimate for one sheet: our per-sheet extras resolved into its `extra`."""
    if not supplier or not callable(supplier.get("extras")):
        return supplier
    std = {**supplier.get("standard", {}), **case.get("fixed_terms", {})}
    t = closing_terms(case, terms, std)
    out = {k: v for k, v in supplier.items() if k != "extras"}
    out["extra"] = supplier.get("extra", 0.0) + (supplier["extras"](t, deal) if t.get("unit_price") is not None else 0)
    return out


def cost(case, terms, standard=None, supplier=None):
    """C (`total_cost`) with the supplier's per-sheet cash extras in its relationship estimate."""
    return total_cost(case, terms, standard, _for_sheet(case, supplier, terms, deal=False))


def value(case, terms, supplier, deal=True):
    """What the sheet is worth to the supplier per unit (`supplier_value`) with its per-sheet extras;
    `deal`: with the clause protection too (how it judges an offer, not what the arena charges)."""
    return supplier_value(case, terms, _for_sheet(case, supplier, terms, deal))


def alternative_cost(case):
    """C of what we get without a deal (the case's alternative); infinite when there is none."""
    alt = case["buyer"].get("alternative") or {}
    terms = alt.get("terms") or {}
    if alt.get("kind") in (None, "none") or terms.get("unit_price") is None:
        return math.inf
    return total_cost(case, terms)


def walk_away_limit(case, c_open=math.inf):
    """The C a deal must stay below: the alternative, and the opening quote (a deal dearer than the
    best opening quote scores 0, the same as no deal without an alternative)."""
    return min(alternative_cost(case), c_open)


def opening_cost(case, quotes):
    """C_open as the arena computes it: the cheapest opening quote that keeps the must-haves.
    `quotes`: [(terms, standard_terms)] - one per supplier."""
    costs = [
        total_cost(case, t, std) for t, std in quotes if t.get("unit_price") is not None and must_haves_ok(case, t, std)
    ]
    return min(costs, default=math.inf)


def cost_at(case, terms, price, standard=None, supplier=None):
    return cost(case, {**terms, "unit_price": price}, standard, supplier)


def accept_check(case, terms, standard=None, supplier=None, c_open=math.inf):
    """(ok, reason) for accepting a standing term sheet: a price, every must-have, C below the
    alternative and the opening quote. `standard` fills what the sheet leaves out."""
    if terms.get("unit_price") is None:
        return False, "no price on the sheet"
    if not must_haves_ok(case, terms, standard):
        return False, "breaks a must-have"
    c, limit = cost(case, terms, standard, supplier), walk_away_limit(case, c_open)
    if c >= limit:
        return False, f"C {c:,.0f} does not beat the limit {limit:,.0f}"
    return True, f"C {c:,.0f} below the limit {limit:,.0f}"


def cheapest_price(case, terms, standard=None, supplier=None, lo=0.01, hi=None, tol=0.005):
    """The unit price that minimises C for these terms. Without a relationship charge C rises with
    price, so that is `lo`; with one (stabilise / secure_supply and a supplier estimate) squeezing
    the supplier costs, so C is lowest somewhere above its full cost (golden-section search)."""
    if case["buyer"].get("category_goal") not in RELATIONSHIP_GOALS or not supplier:
        return lo
    hi = hi or _price_scale(case, terms) * 3
    a, b = lo, hi
    while b - a > tol:
        c1, c2 = b - GOLDEN * (b - a), a + GOLDEN * (b - a)
        if cost_at(case, terms, c1, standard, supplier) <= cost_at(case, terms, c2, standard, supplier):
            b = c2
        else:
            a = c1
    return round((a + b) / 2, 2)


def price_ceiling(case, terms, limit_c, standard=None, supplier=None, tol=0.005):
    """The highest unit price at which these terms still cost less than `limit_c` (e.g. the
    alternative), or None if no price does. C rises with price above `cheapest_price`."""
    lo = cheapest_price(case, terms, standard, supplier)
    if cost_at(case, terms, lo, standard, supplier) >= limit_c:
        return None
    if math.isinf(limit_c):
        return math.inf
    hi = max(lo * 2, _price_scale(case, terms))
    while cost_at(case, terms, hi, standard, supplier) < limit_c:
        hi *= 2
    while hi - lo > tol:
        mid = (lo + hi) / 2
        if cost_at(case, terms, mid, standard, supplier) < limit_c:
            lo = mid
        else:
            hi = mid
    return math.floor(lo * 100) / 100


def price_for_value(case, terms, supplier, target):
    """The unit price at which `terms` are worth `target` per unit to the supplier (its cash value at
    its standard terms). The value is linear in the price (extras are shares of it), so two points
    solve it."""
    v0 = value(case, {**terms, "unit_price": 0.0}, supplier)
    v1 = value(case, {**terms, "unit_price": 1.0}, supplier)
    if v1 == v0:
        return None
    return (target - v0) / (v1 - v0)


def implied_rate(case, main, alt, standard, lo=0.0, hi=0.5, tol=1e-6):
    """measured_rate (v1.8): the cost of money at which two of its own sheets that differ only in
    payment days are worth the same to it (`supplier_value`) - its own price for time. None when
    the sheets differ in anything else, or no rate in [lo, hi] makes them equal."""
    fields = (set(main) | set(alt)) - {"unit_price"}
    if main.get("unit_price") is None or alt.get("unit_price") is None:
        return None
    if {f for f in fields if main.get(f) != alt.get(f)} != {"payment_days"}:
        return None

    def gap(rate):
        est = {"standard": standard, "interest_rate": rate}
        return supplier_value(case, main, est) - supplier_value(case, alt, est)

    a, b = lo, hi
    if gap(a) * gap(b) > 0:
        return None
    while b - a > tol:
        mid = (a + b) / 2
        if gap(a) * gap(mid) <= 0:
            b = mid
        else:
            a = mid
    return round((a + b) / 2, 5)


def term_mixes(case, base, options=None):
    """Every allowed mix of the negotiable non-price fields (from `term_options`), on top of `base`.
    `options` overrides the allowed values of some fields (e.g. one index clause)."""
    allowed = {**case.get("term_options", {}), **(options or {})}
    fields = [f for f in case["negotiable"] if f != "unit_price" and allowed.get(f)]
    values = [allowed[f] for f in fields]
    for combo in itertools.islice(itertools.product(*values), MAX_COMBOS):
        yield {**base, **dict(zip(fields, combo, strict=True))}


def menu(case, standing, standard, supplier, band=None):
    """H1.3 (v1.8): every allowed term mix, priced - context for a judgment, no choice made here.
    Per mix (`terms`):
      equal_value_price  the price worth as much to the supplier as its standing sheet in cash
                         (`supplier_value`; blind to what it sees in non-cash terms such as a clause)
      c_at_equal         our C there
      health_price       relationship goals: the price at which our C is lowest; `band` = (low, high)
                         full cost adds `health_range`, the health price at both ends
      c_at_health        our C there
    Sorted by the lower of the two C. `supplier` is our estimate (`full_cost`, `interest_rate`)."""
    target = value(case, standing, supplier)
    relation = case["buyer"].get("category_goal") in RELATIONSHIP_GOALS and supplier.get("full_cost")
    rows = []
    for mix in term_mixes(case, complete_offer(case, standing)):
        terms = {k: v for k, v in mix.items() if k != "unit_price"}
        if not must_haves_ok(case, complete_offer(case, {**terms, "unit_price": 1.0}), standard):
            continue
        row = {"terms": terms, "equal_value_price": None, "c_at_equal": None}
        price = price_for_value(case, terms, supplier, target)
        if price and price > 0:
            row["equal_value_price"] = round(price, 2)
            row["c_at_equal"] = round(cost_at(case, terms, price, standard, supplier))
        if relation:
            health = cheapest_price(case, terms, standard, supplier)
            row["health_price"], row["c_at_health"] = health, round(cost_at(case, terms, health, standard, supplier))
            if band:
                row["health_range"] = tuple(
                    cheapest_price(case, terms, standard, {**supplier, "full_cost": fc}) for fc in band
                )
        rows.append(row)
    rows.sort(key=lambda r: min(c for c in (r["c_at_equal"], r.get("c_at_health")) if c is not None))
    return rows


def friendly_key(case, sheet):
    """Sort key for mixes of (nearly) equal C, the side a supplier prefers first (v1.7): the longest
    commitment, the highest volume up to our need, the longest lead time within our need."""
    b = case["buyer"]
    months = sheet.get("contract_months") or 0
    volume = sheet.get("volume_per_year") or 0
    lead = sheet.get("lead_time_days") or 0
    return (
        -months,
        -(volume if volume <= b["need_per_year"] else -volume),
        -(lead if lead <= b["need_lead_time_days"] else -lead),
    )


def plan_terms(case, quote, standard, supplier, our_supplier=None, deal_ratio=1.0, friendly=False, options=None):
    """For every allowed term mix: the price worth exactly as much to the supplier as its `quote`,
    and our C at that price. Returns [(C, sheet)] cheapest first, must-haves kept. The cheapest is
    the mix the supplier should accept at no loss to itself while costing us least: what we offer
    on the terms that are cheap for it and dear for us. `our_supplier` prices the relationship
    charge into our C (defaults to `supplier`). `deal_ratio` values each mix at the price level we
    expect to close at (a share of the equal-value price), not at the quote: whether a longer contract
    beats buying the rest at the fallback price depends on that level. `friendly` (v1.7): among mixes
    within max(EUR 1, 0.1 % of C) of the cheapest, the supplier-friendly one first (`friendly_key`).
    `options`: allowed values per field instead of the case's `term_options`."""
    target = value(case, quote, supplier)
    base = complete_offer(case, quote)
    out = []
    for mix in term_mixes(case, base, options):
        price = price_for_value(case, mix, supplier, target)
        if price is None or price <= 0:
            continue
        sheet = complete_offer(case, {**mix, "unit_price": price})
        if not must_haves_ok(case, sheet, standard):
            continue
        at_deal = {**sheet, "unit_price": round(price * deal_ratio, 2)}
        out.append((cost(case, at_deal, standard, our_supplier or supplier), sheet))
    # On (nearly) equal C, ask for as little as possible: every change to its own terms gets priced in.
    own = {**supplier.get("standard", {}), **{k: v for k, v in quote.items() if v is not None}}
    changes = lambda sheet: sum(1 for k, v in sheet.items() if k != "unit_price" and k in own and own[k] != v)  # noqa: E731
    if not friendly or not out:
        out.sort(key=lambda x: (round(x[0]), changes(x[1])))
        return out
    cheapest = min(c for c, _ in out)
    tie = cheapest + max(TIE_EUR, TIE_SHARE * abs(cheapest))
    # the supplier-friendly mix first; on the same commitment, the v1.6b order (C to the euro, fewest changes)
    ties = sorted((x for x in out if x[0] <= tie), key=lambda x: (friendly_key(case, x[1]), round(x[0]), changes(x[1])))
    rest = sorted((x for x in out if x[0] > tie), key=lambda x: (round(x[0]), changes(x[1])))
    return ties + rest


def clause_cost_rate(case, clause):
    """What an index clause costs us per EUR of price bought at the new price: the expected index
    move beyond the deadband and the risk we carry (the `cost_breakdown` formula, per unit)."""
    b = case["buyer"]
    path = b.get("index_paths", {}).get(clause["series"], 0.0)
    moved = max(0.0, abs(path) - clause["deadband_pct"] / 100) * math.copysign(1, path)
    return clause["material_share"] * (moved + b.get("index_risk_pct", 0) / 100)


def clause_value_rate(clause, driver):
    """What an index clause on its asserted driver is worth to the supplier per EUR of price: the
    protection beyond the deadband on its stated share, at most its stated rise on that share."""
    share = min(driver.share_pct / 100, clause["material_share"])
    protected = max(0.0, driver.rise_pct - clause["deadband_pct"]) / 100
    return min(share * protected, driver.share_pct / 100 * driver.rise_pct / 100)


def equal_cost_price(case, terms, c_target, standard=None, supplier=None):
    """The unit price at which `terms` cost us exactly `c_target`: for alternative term sheets that
    cost us the same, so the supplier's choice shows what it values."""
    return price_ceiling(case, terms, c_target + 0.01, standard, supplier)


def _price_scale(case, terms):
    b = case["buyer"]
    return max(terms.get("unit_price") or 0, b.get("current_unit_price") or 0, b.get("fallback_unit_price") or 0, 1.0)
