"""ProcuDeal economics: pinned to the brief's worked example (section 6) and to the case rules."""

import copy
import math

import pytest

from arena_kit.agents.procudeal import economics as eco
from arena_kit.cost import supplier_value, total_cost

# The brief's example: need 4,000 a year for 2 years, interest 8 %, reference 60 days, fallback
# EUR 46.00 + 3 % (leverage). The foundry opens at EUR 43.20 for 24 months at 30 days.
CASE = {
    "case_id": "case:T1",
    "negotiable": ["unit_price", "payment_days", "contract_months"],
    "fixed_terms": {
        "volume_per_year": 4000,
        "lead_time_days": 42,
        "incoterm": "DAP",
        "index_clause": None,
        "tooling_eur": 0,
        "ppm_commitment": 0,
    },
    "term_options": {"payment_days": [30, 60, 90], "contract_months": [12, 24]},
    "buyer": {
        "need_per_year": 4000,
        "horizon_years": 2,
        "current_unit_price": 43.20,
        "fallback_unit_price": 46.00,
        "interest_rate": 0.08,
        "reference_payment_days": 60,
        "need_lead_time_days": 42,
        "category_goal": "leverage",
        "fallback_risk_pct": 3,
        "freight_eur_per_unit": {"EXW": 1.90, "FCA": 1.20, "DAP": 0.0},
        "must_haves": [],
        "alternative": {"kind": "none", "ref": None, "terms": {}},
    },
}
OPEN = {"unit_price": 43.20, "payment_days": 30, "contract_months": 24}


def case(**buyer):
    c = copy.deepcopy(CASE)
    c["buyer"].update(buyer)
    return c


def test_brief_worked_example():
    assert total_cost(CASE, OPEN) == pytest.approx(347_904)
    assert total_cost(CASE, {**OPEN, "unit_price": 41.60, "payment_days": 60}) == pytest.approx(332_800)
    assert total_cost(CASE, {**OPEN, "unit_price": 40.80, "payment_days": 90}) == pytest.approx(324_224)


def test_coverage_trap_shorter_contract_costs_more_than_opening():
    short = {"unit_price": 41.60, "payment_days": 60, "contract_months": 12}
    assert total_cost(CASE, short) == pytest.approx(355_920)
    ok, reason = eco.accept_check(CASE, short, c_open=347_904)
    assert not ok and "limit" in reason


def test_alternative_and_accept_check():
    assert eco.alternative_cost(CASE) == math.inf
    c = case(alternative={"kind": "quote", "ref": "quote:X", "terms": {**OPEN, "unit_price": 44.0, "payment_days": 60}})
    assert eco.alternative_cost(c) == pytest.approx(352_000)
    assert eco.accept_check(c, {**OPEN, "unit_price": 41.60, "payment_days": 60})[0]
    assert not eco.accept_check(c, {**OPEN, "unit_price": 45.00, "payment_days": 60})[0]
    assert not eco.accept_check(c, {"payment_days": 60})[0]


def test_must_have_breach_is_never_accepted():
    c = case(must_haves=[{"field": "lead_time_days", "op": "<=", "value": 42}])
    c["fixed_terms"].pop("lead_time_days")
    ok, reason = eco.accept_check(c, {**OPEN, "unit_price": 30.0, "lead_time_days": 56})
    assert not ok and reason == "breaks a must-have"


def test_opening_cost_skips_quotes_that_break_must_haves():
    c = case(must_haves=[{"field": "lead_time_days", "op": "<=", "value": 42}])
    c["fixed_terms"].pop("lead_time_days")
    cheap_but_slow = ({**OPEN, "unit_price": 40.0, "lead_time_days": 56}, {})
    dear_but_ok = ({**OPEN, "lead_time_days": 42}, {})
    assert eco.opening_cost(c, [cheap_but_slow, dear_but_ok]) == pytest.approx(347_904)


def test_price_ceiling_matches_closed_form():
    terms = {"payment_days": 60, "contract_months": 24}
    assert eco.price_ceiling(CASE, terms, 347_904) == pytest.approx(43.48, abs=0.01)
    # 90 days saves 30 days of interest: 8000 * p * (1 - 0.08 * 30 / 360) < 347,904
    assert eco.price_ceiling(CASE, {**terms, "payment_days": 90}, 347_904) == pytest.approx(43.77, abs=0.01)
    assert eco.price_ceiling(CASE, {**terms, "contract_months": 12}, 100_000) is None


def test_price_for_value_round_trip():
    supplier = {"standard": {"payment_days": 30, "incoterm": "DAP"}, "interest_rate": 0.12}
    target = supplier_value(CASE, OPEN, supplier)
    terms = {"payment_days": 90, "contract_months": 24}
    p = eco.price_for_value(CASE, terms, supplier, target)
    assert supplier_value(CASE, {**terms, "unit_price": p}, supplier) == pytest.approx(target)
    assert p > OPEN["unit_price"]  # paying it later must be paid for


def test_plan_terms_trades_what_is_cheap_for_us_and_dear_for_the_supplier():
    # Cash costs the supplier 12 %, us 8 %: paying early is worth more to it than it costs us,
    # and the full 24 months avoids buying half the need at the fallback price.
    supplier = {"standard": {"payment_days": 60, "incoterm": "DAP"}, "interest_rate": 0.12}
    quote = {"unit_price": 43.20, "payment_days": 60, "contract_months": 24}
    plan = eco.plan_terms(CASE, quote, {}, supplier)
    best_c, best = plan[0]
    assert best["payment_days"] == 30 and best["contract_months"] == 24
    assert best_c < total_cost(CASE, quote)
    assert [c for c, _ in plan] == sorted(c for c, _ in plan)


def test_relationship_goal_does_not_squeeze_below_a_healthy_margin():
    c = case(category_goal="stabilise", sustainable_margin_pct=5, relationship_eur_per_point=15_000)
    supplier = {"standard": {"payment_days": 60, "incoterm": "DAP"}, "interest_rate": 0.08, "full_cost": 40.0}
    terms = {"payment_days": 60, "contract_months": 24}
    p = eco.cheapest_price(c, terms, supplier=supplier)
    assert 41.0 < p < 42.1
    here = eco.cost_at(c, terms, p, supplier=supplier)
    assert here <= eco.cost_at(c, terms, p - 0.5, supplier=supplier)
    assert here <= eco.cost_at(c, terms, p + 0.5, supplier=supplier)
    # without an estimate the charge is unknown, so the cheapest price is simply the lowest
    assert eco.cheapest_price(c, terms) == 0.01


def test_equal_cost_price_gives_iso_cost_sheets():
    c_target = total_cost(CASE, {**OPEN, "unit_price": 41.60, "payment_days": 60})
    p90 = eco.equal_cost_price(CASE, {"payment_days": 90, "contract_months": 24}, c_target)
    assert total_cost(CASE, {"unit_price": p90, "payment_days": 90, "contract_months": 24}) == pytest.approx(
        c_target, abs=100
    )
    assert p90 > 41.60
