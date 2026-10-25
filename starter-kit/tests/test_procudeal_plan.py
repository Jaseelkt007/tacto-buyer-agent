"""Zone 1: the case plan - validation against the case file and the bridge into the engine (no model)."""

import copy

import pytest

from arena_kit.agents.procudeal import policy as po
from arena_kit.agents.procudeal import strategist as st
from tests.test_procudeal_v17 import CASE as BASE
from tests.test_procudeal_v17 import SID, claim, supplier_msg

CASE = {**BASE, "suppliers": [SID], "parts": ["part:T1"]}

ARG = {
    "arg_id": "should_cost:T1:aaaa",
    "kind": "should_cost",
    "part": None,
    "refs": ["cost:T1"],
    "figures": {"unit_cost": 40.0},
    "sentence": "Our cost model puts it at EUR 40.00 (cost:T1).",
    "checkable": True,
    "side": "for_us",
    "note": "",
}
TRAP = {
    **ARG,
    "arg_id": "index_change:T1:bbbb",
    "kind": "index_change",
    "refs": ["idx:A@2025-09", "idx:A@2026-09"],
    "sentence": "A rose (idx:A@2025-09, idx:A@2026-09).",
    "side": "for_them",
}


@pytest.fixture
def flags(monkeypatch):
    monkeypatch.setattr(po, "FLAGS", {**dict.fromkeys(po.FEATURES, True), "patience": False})  # all plan parts on
    return po.FLAGS


def raw_plan(**over):
    entry = {
        "supplier_id": SID,
        "role": "main",
        "levers": [{"arg_id": ARG["arg_id"], "when": "opening", "why": "x"}],
        "blocked": [TRAP["arg_id"]],
        "trades": [{"field": "contract_months", "option": 2, "when": "opening", "contractual": False, "why": "y"}],
        "opening_paragraph": "We value the long partnership with your team and want a fair agreement.",
        "tone": "warm",
        "watch_for": [],
    }
    entry.update(over)
    return {"key_points": ["k"], "stance": "soft", "stance_why": "w", "suppliers": [entry], "risks": []}


def test_validation_keeps_only_what_code_can_stand_behind():
    args = {SID: [ARG, TRAP]}
    plan = st.validate(raw_plan(), CASE, args)
    sp = plan["suppliers"][SID]
    assert [lv["arg_id"] for lv in sp["levers"]] == [ARG["arg_id"]] and sp["levers"][0]["argument"] == ARG
    assert sp["blocked"] == [{"arg_id": TRAP["arg_id"], "kind": "index_change", "refs": TRAP["refs"]}]
    assert sp["trades"][0]["value"] == 36 and plan["stance"] == "soft"
    bad = raw_plan(
        levers=[{"arg_id": "made_up", "when": "opening", "why": ""}],
        trades=[
            {"field": "contract_months", "option": 9, "when": "opening", "contractual": False, "why": ""},
            {"field": "incoterm", "option": 0, "when": "opening", "contractual": False, "why": ""},
        ],
    )
    bad["suppliers"].append({**bad["suppliers"][0], "supplier_id": "sup:NOT_IN_CASE"})
    plan = st.validate(bad, CASE, args)
    assert plan["suppliers"][SID]["levers"] == [] and plan["suppliers"][SID]["trades"] == []
    assert list(plan["suppliers"]) == [SID] and len(plan["dropped"]) == 4


def test_paragraph_loses_only_the_sentences_with_figures_or_leaks():
    kept, cut = st.clean_paragraph("Thank you for the motor M5. We value your openness. We have no alternative.")
    assert kept == "" and "M5" in cut  # what is left is too short to send
    kept, cut = st.clean_paragraph("We value the long partnership with your team. Your 2022 gesture is not forgotten.")
    assert kept == "We value the long partnership with your team." and "2022" in cut


def test_plan_bank_puts_levers_first_and_removes_traps():
    sp = st.validate(raw_plan(), CASE, {SID: [ARG, TRAP]})["suppliers"][SID]
    bank = [claim("index_change", "idx:A@2026-09", 9), claim("volume_change", "fc:T1@2026-09", 4)]
    out = po.plan_bank(bank, sp)
    assert [c.kind for c in out] == ["should_cost", "volume_change"]  # the trap's IDs are gone


def test_plan_moves_the_engine_only_within_bounds(flags):
    plan = st.validate(raw_plan(), CASE, {SID: [ARG, TRAP]})
    threads = {SID: [supplier_msg(44.0, payment_days=30, contract_months=12)]}
    base, planned = po.Negotiator(CASE), po.Negotiator(CASE, plan=plan)
    base.setup(threads)
    planned.setup(threads)
    b, p = base.sides[SID], planned.sides[SID]
    assert p.anchor == pytest.approx(
        b.anchor * (po.ANCHOR["leverage"] + po.STANCE_SHIFT["soft"]) / po.ANCHOR["leverage"], rel=0.02
    )
    assert p.mix["contract_months"] == 36 and p.paragraph.startswith("We value the long partnership")
    flags["case_plan"] = False
    off = po.Negotiator(CASE, plan=plan)
    off.setup(threads)
    assert off.plan is None and off.sides[SID].anchor == b.anchor


def test_priced_trade_is_refused_when_it_costs_us_more(flags):
    c = copy.deepcopy(CASE)
    short = {"field": "contract_months", "option": 0, "when": "opening", "contractual": False, "why": "it wants less"}
    plan = st.validate(raw_plan(trades=[short]), c, {SID: [ARG]})
    n = po.Negotiator(c, plan=plan)
    n.setup({SID: [supplier_msg(44.0, payment_days=60, contract_months=24)]})
    assert n.sides[SID].mix["contract_months"] != 12  # a 12-month contract leaves half the need uncovered


def test_narrow_plan_by_default_keeps_only_facts(monkeypatch):
    monkeypatch.setattr(po, "FLAGS", {**po.FEATURES, "case_plan": True})  # the defaults, plan on
    plan = st.validate(raw_plan(), CASE, {SID: [ARG, TRAP]})
    threads = {SID: [supplier_msg(44.0, payment_days=30, contract_months=12)]}
    base, planned = po.Negotiator(CASE), po.Negotiator(CASE, plan=plan)
    base.setup(threads)
    planned.setup(threads)
    b, p = base.sides[SID], planned.sides[SID]
    assert p.anchor == b.anchor and p.paragraph == "" and p.mix == b.mix  # no stance, no words, no priced trade
    assert p.bank[0].kind == "should_cost"  # the plan's lever order still applies
