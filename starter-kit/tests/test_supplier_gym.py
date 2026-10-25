import asyncio
import json
from copy import deepcopy
from pathlib import Path

import httpx
import pytest

from arena_kit.cost import total_cost
from arena_kit.docs import quote_terms, read_document
from arena_kit.sim import Fail
from arena_kit.supplier_gym import chooser as chooser_module
from arena_kit.supplier_gym.chooser import LLMChooser, ReferenceChooser
from arena_kit.supplier_gym.sim import GymSim

FIXTURES = Path(__file__).parents[1] / "scripts/fixtures/supplier_gym"


def gym(name="L01", chooser=None):
    case = json.loads((FIXTURES / "public" / f"{name}.json").read_text())
    profiles = json.loads((FIXTURES / "private" / f"{name}.json").read_text())
    return GymSim(case, profiles, chooser or ReferenceChooser())


def policy(name="L01"):
    return next(iter(gym(name).policies.values()))


def test_cash_payment_tradeoff_is_independent_and_nontrivial():
    stressed, neutral = policy(), policy("L02")
    saving = stressed.floor({"payment_days": 60}) - stressed.floor({"payment_days": 10})
    control = neutral.floor({"payment_days": 60}) - neutral.floor({"payment_days": 10})
    assert saving > 3
    assert saving > control * 8


def test_capacity_benefit_stops_at_physical_limit():
    p = policy("L03")
    assert p.floor({"volume_per_year": 9000}) < p.floor({"volume_per_year": 6000})
    assert p.floor({"volume_per_year": 15000}) is None
    assert not p.feasible({"unit_price": 1000, "volume_per_year": 15000})


def test_hedge_date_reverses_index_tradeoff():
    covered, expired = policy("L04"), policy("L05")
    clause = covered.context["term_options"]["index_clause"][1]
    assert covered.floor({"index_clause": None}) < covered.floor({"index_clause": clause})
    assert expired.floor({"index_clause": None}) > expired.floor({"index_clause": clause})
    assert expired.supplier_view()["enquiry"]["fixed_terms"]["effective_date"] == "2028-01-01"


def test_noise_changes_words_not_economics_or_legal_actions():
    a, b = policy("L06"), policy("L07")
    assert a.opening() == b.opening()
    assert a.menu(1, a.opening(), []) == b.menu(1, b.opening(), [])
    assert a.profile.opening_email != b.profile.opening_email


def test_commitment_has_real_supplier_value():
    p = policy("L08")
    assert p.floor({"contract_months": 24}) < p.floor({"contract_months": 12})


def test_every_counter_and_agreement_is_financially_feasible():
    p = policy()
    low = {"unit_price": 0.01, "payment_days": 90}
    acceptable = {"unit_price": 110, "payment_days": 10}
    actions = p.menu(2, p.opening(), [low, acceptable])
    assert any(a.kind == "agree" and a.terms == acceptable for a in actions)
    assert not any(a.terms == low for a in actions)
    assert all(p.feasible(a.terms) for a in actions)
    assert len({a.terms["payment_days"] for a in actions}) == 4
    actions[0].terms["unit_price"] = 0.01
    assert p.feasible(actions[0].terms)


def test_final_stage_stops_bargaining_but_accepts_a_feasible_offer():
    p = policy()
    actions = p.menu(6, p.opening(), [{"unit_price": 0.01, "payment_days": 10}], final=True)
    assert [a.kind for a in actions] == ["walk"]
    assert {a.kind for a in p.menu(6, p.opening(), [p.opening()], final=True)} == {"agree", "walk"}


@pytest.mark.parametrize("price", [float("nan"), float("inf"), -1, True, "100"])
def test_invalid_prices_do_not_consume_rounds(price):
    sim = gym()
    opened = sim.open("test", "case:L01")
    sid = opened["session_id"]
    with pytest.raises(Fail) as error:
        sim.message("test", sid, "sup:70170", {"term_sheets": [{"terms": {"unit_price": price, "payment_days": 10}}]})
    assert error.value.status == 422
    assert sim.sessions[sid]["threads"]["sup:70170"]["round"] == 0


def test_old_quote_pdf_and_offer_stay_immutable_and_standard_is_preserved():
    sim = gym("L04")
    opened = sim.open("test", "case:L04")
    sid, supplier = opened["session_id"], "sup:70340"
    message = opened["threads"][supplier][0]
    att = message["attachments"][0]["attachment_id"]
    old_pdf = sim.attachment("test", sid, att)[0]
    old_offer = deepcopy(sim.sessions[sid]["offers"])
    message["term_sheets"][0]["terms"]["unit_price"] = 0.01
    reply = sim.message("test", sid, supplier, {"body": "Please quote an indexed option.", "term_sheets": []})
    assert sim.attachment("test", sid, att)[0] == old_pdf
    for oid, terms in old_offer.items():
        assert sim.sessions[sid]["offers"][oid] == terms
    new_pdf = sim.attachment("test", sid, reply["attachments"][0]["attachment_id"])[0]
    parsed = quote_terms(read_document("quote.pdf", new_pdf))
    assert parsed["standard"]["payment_days"] == 60
    assert parsed["stated"]["index_clause"] == reply["term_sheets"][0]["terms"]["index_clause"]


def test_benchmark_uses_feasible_full_packages_and_lower_than_opening():
    for path in (FIXTURES / "public").glob("*.json"):
        sim = gym(path.stem)
        case = next(iter(sim.cases.values()))
        value, supplier, terms = sim.benchmark(case)
        p = sim.policies[supplier]
        assert p.feasible(terms)
        assert not p.feasible({**terms, "unit_price": terms["unit_price"] - 0.01})
        assert value == total_cost(case, terms, p.standard)
        assert value < min(total_cost(case, p.opening(), p.standard) for p in sim.policies.values())


def test_supplier_prompt_has_own_thread_and_no_buyer_internal_state():
    class Spy:
        seen = None

        def choose(self, view, history, actions):
            self.seen = json.dumps({"view": view, "history": history})
            return ReferenceChooser().choose(view, history, actions)

    spy = Spy()
    sim = gym("L09", spy)
    opened = sim.open("test", "case:L09")
    sim.message("test", opened["session_id"], "sup:70170", {"body": "We seek a competitive package."})
    assert "sup:70190" not in spy.seen
    assert not any(key in spy.seen for key in ("alternative", "current_unit_price", "buyer_trace", "dossier"))
    public = json.dumps(sim.state("test", opened["session_id"])) + json.dumps(sim.public_transcript())
    assert not any(key in public for key in ("private_assumptions", "finance_rate", "minimum_margin", "priorities"))


@pytest.mark.parametrize("response_kind", ["valid", "unknown_id", "bad_json", "http_error"])
def test_llm_choice_or_visible_fallback(monkeypatch, response_kind):
    monkeypatch.setenv("OPENAI_API_KEY", "test-not-a-secret")
    p = policy()
    actions = p.menu(1, p.opening(), [])

    def respond(request):
        data = json.loads(request.content)
        assert data["store"] is False
        assert data["text"]["format"]["schema"]["properties"]["action_id"]["enum"] == [a.id for a in actions]
        if response_kind == "http_error":
            return httpx.Response(503)
        action_id = actions[-1].id if response_kind == "valid" else "impossible"
        content = json.dumps({"action_id": action_id, "summary": "Commercially acceptable."})
        if response_kind == "bad_json":
            content = "not JSON"
        return httpx.Response(
            200, json={"status": "completed", "output": [{"content": [{"type": "output_text", "text": content}]}]}
        )

    chosen, audit = LLMChooser(transport=httpx.MockTransport(respond)).choose(p.supplier_view(), [], actions)
    assert chosen in actions
    assert p.feasible(chosen.terms)
    assert audit["mode"] == ("llm" if response_kind == "valid" else "fallback")
    assert bool(audit["error"]) == (response_kind != "valid")


def test_api_acceptance_idempotency_and_public_privacy():
    sim = gym()
    with sim.local_client() as client:
        opened = client.open_session("case:L01")
        sid = opened["session_id"]
        offer = opened["threads"]["sup:70170"][0]["term_sheets"][0]["term_sheet_id"]
        path = f"/sessions/{sid}/threads/sup:70170/messages"
        body = {"message": {"action": {"type": "accept", "term_sheet_id": offer}}}
        first = client.http.post(path, json=body, headers={"X-Move-Id": "same-move"})
        second = client.http.post(path, json=body, headers={"X-Move-Id": "same-move"})
        assert first.status_code == second.status_code == 200
        assert first.json() == second.json()
        assert first.json()["result"]["deal"]
        public = json.dumps(client.session(sid)) + json.dumps(client.cases()) + first.text
        assert not any(key in public for key in ("finance_rate", "minimum_margin", "private_assumptions"))


def test_model_deadline_cancels_request_and_records_fallback(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-not-a-secret")
    monkeypatch.setattr(chooser_module, "TIMEOUT_S", 0.01)
    cancelled = []

    async def slow(request):
        try:
            await asyncio.sleep(1)
        finally:
            cancelled.append(True)

    p = policy()
    actions = p.menu(1, p.opening(), [])
    _, audit = LLMChooser(transport=httpx.MockTransport(slow)).choose(p.supplier_view(), [], actions)
    assert cancelled == [True]
    assert audit["mode"] == "fallback"
    assert audit["error"] == "TimeoutError"


def test_only_current_offer_can_be_accepted_and_rfq_closes_both_threads():
    sim = gym("L09")
    opened = sim.open("test", "case:L09")
    sid, supplier = opened["session_id"], "sup:70170"
    old_id = opened["threads"][supplier][0]["term_sheets"][0]["term_sheet_id"]
    reply = sim.message("test", sid, supplier, {"body": "Please improve your price."})
    with pytest.raises(Fail) as error:
        sim.message("test", sid, supplier, {"action": {"type": "accept", "term_sheet_id": old_id}})
    assert error.value.status == 422
    current_id = reply["term_sheets"][0]["term_sheet_id"]
    result = sim.message("test", sid, supplier, {"action": {"type": "accept", "term_sheet_id": current_id}})
    assert result["result"]["supplier_id"] == supplier
    assert all(t["closed"] for t in sim.sessions[sid]["threads"].values())
