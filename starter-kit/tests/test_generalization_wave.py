import json
import shutil
from copy import deepcopy
from dataclasses import replace
from pathlib import Path

import pytest

from arena_kit.cost import total_cost
from arena_kit.supplier_gym.chooser import ReferenceChooser
from arena_kit.supplier_gym.policy import SupplierPolicy
from arena_kit.supplier_gym.sim import GymSim
from arena_kit.supplier_gym.suite import load_suite, validate_suite

SUITE = Path(__file__).parents[2] / "evaluations/supplier-generalization/wave-02"


def gyms():
    fixtures, _, _ = load_suite(SUITE)
    return {c["case_id"]: GymSim(c, p, ReferenceChooser()) for c, p in fixtures}


def test_suite_sealed_and_financially_valid_without_buyer_execution():
    result = validate_suite(SUITE)
    assert result["integrity"]["sealed"]
    assert len(result["cases"]) == 10
    assert sum(c["suppliers"] for c in result["cases"]) == 12
    assert result["buyer_runs"] == result["model_calls"] == 0


def test_mutating_frozen_profiles_or_removing_seal_is_rejected(tmp_path):
    target = tmp_path / "suite"
    shutil.copytree(SUITE, target)
    profile = target / "private/G01.json"
    profile.write_text(profile.read_text() + " ")
    with pytest.raises(ValueError, match="sealed suite changed"):
        load_suite(target)
    (target / "seal.json").unlink()
    with pytest.raises(ValueError, match="missing its seal"):
        load_suite(target)


def test_identity_and_order_pairs_change_only_declared_fields():
    fixtures, _, _ = load_suite(SUITE)
    cases = {c["case_id"]: (c, p) for c, p in fixtures}
    left, lp = deepcopy(cases["case:G04"])
    right, rp = deepcopy(cases["case:G05"])
    for c in (left, right):
        c.pop("case_id")
        c.pop("suppliers")
    assert left == right
    assert list(lp.values()) == list(rp.values())
    left, lp = deepcopy(cases["case:G08"])
    right, rp = deepcopy(cases["case:G09"])
    assert left["suppliers"] == list(reversed(right["suppliers"]))
    for c in (left, right):
        c.pop("case_id")
        c.pop("suppliers")
    assert left == right and lp == rp


def test_final_counteroffers_do_not_automatically_reach_financial_floor():
    sim = gyms()["case:G01"]
    p = next(iter(sim.policies.values()))
    actions = p.menu(p.profile.final_round, p.opening(), [])
    assert all(a.kind == "final" and a.terms["unit_price"] > p.floor(a.terms) for a in actions)
    affordable = {**p.opening(), "unit_price": p.floor(p.opening())}
    assert any(a.kind == "agree" for a in p.menu(p.profile.final_round, p.opening(), [affordable]))
    assert p.floor({"volume_per_year": 6000}) is None


def test_longer_commitment_can_cost_the_supplier_more():
    p = next(iter(gyms()["case:G03"].policies.values()))
    assert p.floor({"contract_months": 24}) > p.floor({"contract_months": 12})
    neutral = SupplierPolicy(p.context, replace(p.profile, commitment_penalty=0))
    assert neutral.floor({"contract_months": 24}) == neutral.floor({"contract_months": 12})


def test_headline_discounts_can_lose_on_full_buyer_cost():
    sim = gyms()["case:G02"]
    case, p = next(iter(sim.cases.values())), next(iter(sim.policies.values()))
    exact = {"volume_per_year": 5000, "payment_days": 60}
    excess = {"volume_per_year": 11000, "payment_days": 60}
    exact["unit_price"], excess["unit_price"] = p.floor(exact), p.floor(excess)
    assert excess["unit_price"] < exact["unit_price"]
    assert total_cost(case, excess, p.standard) > total_cost(case, exact, p.standard)
    sim = gyms()["case:G08"]
    case = next(iter(sim.cases.values()))
    cheap, dear = sim.policies.values()
    assert cheap.opening()["unit_price"] < dear.opening()["unit_price"]
    assert total_cost(case, cheap.opening(), cheap.standard) > total_cost(case, dear.opening(), dear.standard)


def test_partial_hedge_and_index_trap_have_opposite_economic_directions():
    for cid, clause_should_help in (("case:G06", True), ("case:G07", False)):
        sim = gyms()[cid]
        case, p = next(iter(sim.cases.values())), next(iter(sim.policies.values()))
        no_clause = {"payment_days": 60, "index_clause": None}
        indexed = {"payment_days": 60, "index_clause": p.context["term_options"]["index_clause"][1]}
        no_clause["unit_price"], indexed["unit_price"] = p.floor(no_clause), p.floor(indexed)
        helps = total_cost(case, indexed, p.standard) < total_cost(case, no_clause, p.standard)
        assert helps is clause_should_help


def test_fixture_manifest_contains_no_claim_of_buyer_results():
    manifest = json.loads((SUITE / "manifest.json").read_text())
    assert manifest["buyer_evaluations_at_construction"] == 0
