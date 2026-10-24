"""Economics: every binding number the agent sends or accepts comes from here, never from the model.

Built on the kit's published cost function (`arena_kit.cost`). A "supplier estimate" is the dict
`supplier_value` and `relationship_cost` take: {"standard", "interest_rate", "full_cost", ...}.
Without an estimate the relationship charge (stabilise / secure_supply) is left out, so pass one
whenever the dossier has it.
"""

import itertools
import math

from ...cost import RELATIONSHIP_GOALS, complete_offer, must_haves_ok, supplier_value, total_cost

GOLDEN = (math.sqrt(5) - 1) / 2
MAX_COMBOS = 2000


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
    return total_cost(case, {**terms, "unit_price": price}, standard, supplier)


def accept_check(case, terms, standard=None, supplier=None, c_open=math.inf):
    """(ok, reason) for accepting a standing term sheet: a price, every must-have, C below the
    alternative and the opening quote. `standard` fills what the sheet leaves out."""
    if terms.get("unit_price") is None:
        return False, "no price on the sheet"
    if not must_haves_ok(case, terms, standard):
        return False, "breaks a must-have"
    c, limit = total_cost(case, terms, standard, supplier), walk_away_limit(case, c_open)
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


def price_for_value(case, terms, supplier, value):
    """The unit price at which `terms` are worth `value` per unit to the supplier (its cash value at
    its standard terms). `supplier_value` is linear in the price, so two points solve it."""
    v0 = supplier_value(case, {**terms, "unit_price": 0.0}, supplier)
    v1 = supplier_value(case, {**terms, "unit_price": 1.0}, supplier)
    if v1 == v0:
        return None
    return (value - v0) / (v1 - v0)


def term_mixes(case, base):
    """Every allowed mix of the negotiable non-price fields (from `term_options`), on top of `base`."""
    fields = [f for f in case["negotiable"] if f != "unit_price" and case.get("term_options", {}).get(f)]
    options = [case["term_options"][f] for f in fields]
    for combo in itertools.islice(itertools.product(*options), MAX_COMBOS):
        yield {**base, **dict(zip(fields, combo, strict=True))}


def plan_terms(case, quote, standard, supplier, our_supplier=None, deal_ratio=1.0):
    """For every allowed term mix: the price worth exactly as much to the supplier as its `quote`,
    and our C at that price. Returns [(C, sheet)] cheapest first, must-haves kept. The cheapest is
    the mix the supplier should accept at no loss to itself while costing us least: what we offer
    on the terms that are cheap for it and dear for us. `our_supplier` prices the relationship
    charge into our C (defaults to `supplier`). `deal_ratio` values each mix at the price level we
    expect to close at (a share of the equal-value price), not at the quote: whether a longer contract
    beats buying the rest at the fallback price depends on that level."""
    target = supplier_value(case, quote, supplier)
    base = complete_offer(case, quote)
    out = []
    for mix in term_mixes(case, base):
        price = price_for_value(case, mix, supplier, target)
        if price is None or price <= 0:
            continue
        sheet = complete_offer(case, {**mix, "unit_price": price})
        if not must_haves_ok(case, sheet, standard):
            continue
        at_deal = {**sheet, "unit_price": round(price * deal_ratio, 2)}
        out.append((total_cost(case, at_deal, standard, our_supplier or supplier), sheet))
    out.sort(key=lambda x: x[0])
    return out


def equal_cost_price(case, terms, c_target, standard=None, supplier=None):
    """The unit price at which `terms` cost us exactly `c_target`: for alternative term sheets that
    cost us the same, so the supplier's choice shows what it values."""
    return price_ceiling(case, terms, c_target + 0.01, standard, supplier)


def _price_scale(case, terms):
    b = case["buyer"]
    return max(terms.get("unit_price") or 0, b.get("current_unit_price") or 0, b.get("fallback_unit_price") or 0, 1.0)
