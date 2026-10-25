"""Supplier-quoted term tradeoffs. Never infer a discount from a qualitative need."""

from itertools import permutations

from ...cost import closing_terms


def changed(case, baseline, candidate, standard):
    before = closing_terms(case, baseline, standard)
    after = closing_terms(case, candidate, standard)
    return [field for field in before.keys() | after.keys()
            if field != "unit_price" and before.get(field) != after.get(field)]


def quoted_price(case, baseline, candidate, standard, events):
    """Carry E0's price level across an otherwise identical pair of supplier-quoted packages.

    A quote ratio is an observed requested trade, not proof of the supplier's hidden utility or
    acceptance of our lower price. Never combine different times or extrapolate across other terms.
    """
    before = closing_terms(case, baseline, standard)
    after = closing_terms(case, candidate, standard)
    if len(changed(case, before, after, standard)) != 1:
        return None
    keys = (before.keys() | after.keys()) - {"unit_price"}
    for event in reversed(events):
        if event.get("from") == "buyer":
            continue
        sheets = event.get("term_sheets") or []
        for a, b in permutations(sheets, 2):
            at = closing_terms(case, a.get("terms") or {}, standard)
            bt = closing_terms(case, b.get("terms") or {}, standard)
            if not all(at.get(k) == before.get(k) and bt.get(k) == after.get(k) for k in keys):
                continue
            if not at.get("unit_price") or not bt.get("unit_price") or min(at["unit_price"], bt["unit_price"]) <= 0:
                continue
            price = round(baseline["unit_price"] * bt["unit_price"] / at["unit_price"], 2)
            return price, f"quoted trade {a.get('term_sheet_id')} → {b.get('term_sheet_id')}; acceptance unknown"
        # Use the latest supplier message only: old trade quotes can be withdrawn or repriced.
        return None
    return None
