import asyncio
import json
import time
from copy import deepcopy
from types import SimpleNamespace

import httpx
import pytest
from test_procudeal_v17 import CASE, SID, supplier_msg

from arena_kit.agents.procudeal import ProcuDealAgent, policy
from arena_kit.agents.procudeal import economics as eco
from arena_kit.agents.procudeal.reconsideration import (
    Reconsideration,
    SupplierPackage,
    alternatives,
    ask_gate,
    gate_body,
    invoke_gate,
    nonprice,
    package_terms,
)


@pytest.fixture(autouse=True)
def defaults(monkeypatch):
    monkeypatch.setattr(policy, "FLAGS", policy.parse_off("", ""))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")


def example():
    case = deepcopy(CASE)
    side = SimpleNamespace(standard={"payment_days": 45, "contract_months": 24}, estimate=lambda: None)
    neg = SimpleNamespace(case=case, sides={SID: side}, c_open=400000)
    supplier = supplier_msg(44, payment_days=30, contract_months=24)
    supplier["message_id"] = "msg:current"
    old = {"from": "buyer", "term_sheets": [{"terms": {"unit_price": 40, "payment_days": 90, "contract_months": 36}}]}
    threads = {SID: [old, supplier]}
    move = {
        "supplier_id": SID,
        "sheets": [{"unit_price": 41, "payment_days": 90, "contract_months": 36}],
        "why": {},
        "claims": [],
        "answers": [],
    }
    return neg, threads, move


def test_typed_reference_resolves_latest_package_and_rejects_stale_ids():
    neg, threads, _ = example()
    hint = SupplierPackage(SID, "msg:current", "offer:T1-0")
    terms = package_terms(hint, neg.case, threads, neg.sides[SID].standard)
    assert terms == {"unit_price": 44, "payment_days": 30, "contract_months": 24}
    for bad in [SupplierPackage(SID, "msg:old", "offer:T1-0"), SupplierPackage(SID, "msg:current", "offer:unknown")]:
        with pytest.raises(ValueError):
            package_terms(bad, neg.case, threads, neg.sides[SID].standard)


def test_adapter_preserves_package_and_code_cost_limit_without_changing_original():
    neg, threads, move = example()
    before = deepcopy(move)
    result = Reconsideration("deterministic")(neg, threads, move)
    assert move == before and result["sheets"][0] == move["sheets"][0]
    assert len(result["sheets"]) == 2
    extra = result["sheets"][1]
    assert nonprice(extra) == {"payment_days": 30, "contract_months": 24}
    assert eco.cost(neg.case, extra, neg.sides[SID].standard) <= eco.cost(neg.case, move["sheets"][0]) + 0.01
    assert result["why"]["reconsideration"]["used"]


def test_explicit_standard_outside_options_is_not_silently_snapped():
    neg, threads, move = example()
    del threads[SID][-1]["term_sheets"][0]["terms"]["payment_days"]
    candidates = alternatives(neg, threads, move)
    assert candidates and candidates[0]["terms"]["payment_days"] == 45


@pytest.mark.parametrize("change", ["invalid_option", "must_have", "fixed_conflict", "missing_term", "nan_price"])
def test_invalid_supplier_packages_are_not_proposed(change):
    neg, threads, move = example()
    terms = threads[SID][-1]["term_sheets"][0]["terms"]
    if change == "invalid_option":
        terms["contract_months"] = 13
    elif change == "must_have":
        neg.case["buyer"]["must_haves"] = [{"field": "payment_days", "op": ">=", "value": 60}]
    elif change == "fixed_conflict":
        terms["lead_time_days"] = 100
    elif change == "missing_term":
        terms.pop("contract_months")
        neg.sides[SID].standard.pop("contract_months")
    else:
        terms["unit_price"] = float("nan")
    assert alternatives(neg, threads, move) == []


@pytest.mark.parametrize("kind", ["accept", "walk_away", "final_offer", "agreed", "hold", "note", "first", "full"])
def test_terminal_and_ineligible_moves_never_call_model(kind):
    neg, threads, move = example()
    if kind in {"accept", "walk_away"}:
        move = {"supplier_id": SID, "action": {"type": kind}, "why": "terminal"}
    elif kind in {"final_offer", "agreed"}:
        threads[SID][-1]["status"] = kind
    elif kind in {"hold", "note"}:
        move[kind] = True
    elif kind == "first":
        threads[SID] = threads[SID][-1:]
    else:
        move["sheets"] *= 3

    async def forbidden(body):
        pytest.fail("model should not be called")

    result = Reconsideration("decision", forbidden)(neg, threads, move)
    assert result.get("sheets") == move.get("sheets") and result.get("action") == move.get("action")
    assert not result["why"]["reconsideration"]["model_called"]


def test_same_nonprice_package_is_not_repeated_after_sending():
    neg, threads, move = example()
    result = Reconsideration("deterministic")(neg, threads, move)
    threads[SID].insert(-1, {"from": "buyer", "term_sheets": [{"terms": result["sheets"][1]}]})
    assert alternatives(neg, threads, move) == []


@pytest.mark.parametrize("choice", ["PROCEED", "RECONSIDER", "error"])
def test_gate_controls_only_additional_sheet_and_records_failure(choice):
    neg, threads, move = example()

    async def gate(body):
        if choice == "error":
            raise TimeoutError()
        return choice, {"answers": []}

    result = Reconsideration("decision", gate)(neg, threads, move)
    assert result["sheets"][0] == move["sheets"][0]
    assert len(result["sheets"]) == (2 if choice == "RECONSIDER" else 1)
    assert result["why"]["reconsideration"]["error"] == ("TimeoutError" if choice == "error" else None)


def test_gate_api_validates_choice_and_has_hard_deadline():
    neg, threads, move = example()
    body = gate_body(neg, threads, move, alternatives(neg, threads, move)[0])

    async def slow(request):
        await asyncio.sleep(1)
        return httpx.Response(200)

    started = time.monotonic()
    with pytest.raises(TimeoutError):
        asyncio.run(ask_gate(body, httpx.MockTransport(slow), timeout=0.02))
    assert time.monotonic() - started < 0.5
    response = {"answers": [{"name": "gate", "type": "choice", "choice": "accept", "confidence": 0.99}]}
    with pytest.raises(ValueError):
        asyncio.run(ask_gate(body, httpx.MockTransport(lambda req: httpx.Response(200, json=response))))


def test_default_buyer_does_not_install_adapter_and_price_history_keeps_main():
    base, changed = ProcuDealAgent(None), ProcuDealAgent(None)
    assert base.reconsideration is None
    changed.reconsideration = Reconsideration("deterministic")
    first = supplier_msg(45, payment_days=30, contract_months=24)
    first["message_id"] = "msg:0"
    threads = {SID: [first]}
    opening = base.decide(CASE, deepcopy(threads))
    assert changed.decide(CASE, deepcopy(threads)) == opening
    reply = supplier_msg(44.5, n=1, payment_days=30, contract_months=24)
    reply["message_id"] = "msg:1"
    threads[SID] += [{**opening["message"], "from": "buyer"}, reply]
    original = base.decide(CASE, deepcopy(threads))
    alternative = changed.decide(CASE, deepcopy(threads))
    assert len(alternative["message"]["term_sheets"]) == 2
    info = changed.trace[-1]["reconsideration"]
    assert info["used"] and alternative["message"]["term_sheets"][-1]["terms"] == info["candidate"]["terms"]
    assert alternative["message"]["term_sheets"][0] == original["message"]["term_sheets"][0]
    assert base.negotiator.sides[SID].ours == changed.negotiator.sides[SID].ours
    assert json.dumps(CASE) == json.dumps(base.negotiator.case)


def test_live_gate_error_keeps_wire_offer_and_never_invokes_delegate():
    async def fail(body):
        raise TimeoutError()

    def forbidden(*args, **kwargs):
        pytest.fail("gate failure invoked the buyer fallback")

    base, changed = ProcuDealAgent(forbidden), ProcuDealAgent(forbidden)
    changed.reconsideration = Reconsideration("decision", fail)
    first = supplier_msg(45, payment_days=30, contract_months=24)
    first["message_id"] = "msg:0"
    threads = {SID: [first]}
    opening = base.decide(CASE, deepcopy(threads))
    changed.decide(CASE, deepcopy(threads))
    reply = supplier_msg(44.5, n=1, payment_days=30, contract_months=24)
    reply["message_id"] = "msg:1"
    threads[SID] += [{**opening["message"], "from": "buyer"}, reply]
    expected = base.decide(CASE, deepcopy(threads))
    assert changed.decide(CASE, deepcopy(threads)) == expected
    assert changed.trace[-1]["source"] == "engine"
    assert changed.trace[-1]["reconsideration"]["error"] == "TimeoutError"


def test_wall_deadline_survives_a_non_cooperative_gate():
    async def stuck(body):
        time.sleep(0.3)
        return "RECONSIDER", {}

    started = time.monotonic()
    with pytest.raises(TimeoutError):
        invoke_gate(stuck, {}, timeout=0.02)
    assert time.monotonic() - started < 0.2
