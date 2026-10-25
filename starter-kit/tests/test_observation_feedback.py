import asyncio
import json
from copy import deepcopy

import httpx
from test_observation import captured, response

from arena_kit.agents.procudeal.feedback import with_feedback
from arena_kit.agents.procudeal.observation import digest, review


def packet():
    buyer, _, _ = captured()
    result = deepcopy(buyer.observation_packets[0]["packet"])
    sid = result["proposed_action"]["supplier_id"]
    result["decision_index"] = 2
    result["threads"][sid] = [
        {
            "from": "sales",
            "status": "open",
            "body": "Twelve months is our preferred package.",
            "term_sheets": [{"term_sheet_id": "q0", "terms": {"unit_price": 45, "contract_months": 12}}],
        },
        {"from": "buyer", "term_sheets": [{"terms": {"unit_price": 40, "contract_months": 24}}]},
        {
            "from": "sales",
            "status": "open",
            "body": "Please see our revised quote.",
            "term_sheets": [{"term_sheet_id": "q1", "terms": {"unit_price": 44, "contract_months": 12}}],
        },
    ]
    result["proposed_action"]["message"] = {"term_sheets": [{"terms": {"unit_price": 41, "contract_months": 24}}]}
    return result, sid


def test_feedback_preserves_offers_and_observed_replies_without_inventing_rejections():
    original, sid = packet()
    before = deepcopy(original)
    enriched = with_feedback(original)
    state = enriched["exchange_feedback"]["suppliers"][sid]
    assert original == before
    assert state["exchanges"][0]["status"] == "open"
    assert state["exchanges"][0]["buyer"]["term_sheets"][0]["terms"]["contract_months"] == 24
    assert state["repeated_quoted_values"] == [
        {
            "field": "contract_months",
            "value": 12,
            "consecutive_quotes": 2,
            "sources": [f"message:{sid}:0", f"message:{sid}:2"],
            "latest_term_sheet_id": "q1",
        }
    ]
    assert state["current_draft_differences"][0]["is_violation"] == "not determined"
    assert enriched["proposed_action"] == original["proposed_action"]


def test_changed_supplier_quote_supersedes_repetition_and_addressed_draft_clears_difference():
    original, sid = packet()
    original["threads"][sid][-1]["term_sheets"][0]["terms"]["contract_months"] = 24
    state = with_feedback(original)["exchange_feedback"]["suppliers"][sid]
    assert state["repeated_quoted_values"] == []
    assert state["current_draft_differences"] == []


def test_feedback_is_prefix_only_and_cannot_leak_between_cases_or_suppliers():
    original, sid = packet()
    earlier = with_feedback(original)
    original["threads"][sid].append({"from": "sales", "status": "agreed", "term_sheets": []})
    assert earlier["exchange_feedback"]["suppliers"][sid]["exchanges"][0]["status"] == "open"
    other, other_sid = packet()
    other["case_id"] = "case:other"
    other["threads"][other_sid] = other["threads"][other_sid][:1]
    state = with_feedback(other)["exchange_feedback"]
    assert state["case_id"] == "case:other"
    assert state["suppliers"][other_sid]["repeated_quoted_values"] == []
    assert state["suppliers"][other_sid]["exchanges"] == []


def test_arena_response_is_not_recorded_as_supplier_feedback():
    original, sid = packet()
    original["threads"][sid][-1]["from"] = "arena"
    state = with_feedback(original)["exchange_feedback"]["suppliers"][sid]
    assert state["exchanges"][0]["status"] == "arena_feedback"
    assert len(state["quotation_history"]) == 1
    assert state["repeated_quoted_values"] == []


def test_alternative_packages_are_never_merged_into_an_invented_package():
    original, sid = packet()
    original["threads"][sid][-1]["term_sheets"].append(
        {"term_sheet_id": "q2", "terms": {"unit_price": 47, "contract_months": 24, "payment_days": 90}}
    )
    state = with_feedback(original)["exchange_feedback"]["suppliers"][sid]
    assert len(state["quotation_history"][-1]["term_sheets"]) == 2
    assert state["current_draft_differences"][0]["term_sheet_id"] == "q1"
    assert not any(x["field"] == "payment_days" for x in state["repeated_quoted_values"])


def test_same_decision_model_receives_feedback_and_cites_original_exchange_state(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    original, sid = packet()
    before = deepcopy(original)

    def provider(request):
        payload = json.loads(request.content)
        data = json.loads(payload["input"])
        assert data["exchange_feedback"]["suppliers"][sid]["repeated_quoted_values"][0]["value"] == 12
        question = payload["questions"][0]["name"]
        choice = "RECONSIDER:contract_months" if question == "assessment" else f"feedback:{sid}"
        return httpx.Response(200, json=response(choice, question))

    result = asyncio.run(review(original, transport=httpx.MockTransport(provider), feedback=True))
    assert original == before
    assert result["input_packet_sha256"] == digest(original)
    assert result["available"] and result["field"] == "contract_months"
    assert result["supporting_source"]["kind"] == "derived_exchange_feedback"
    assert len(result["calls"]) == 2


def test_default_review_still_has_no_feedback_or_new_calls(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    original, _ = packet()

    def provider(request):
        assert "exchange_feedback" not in json.loads(json.loads(request.content)["input"])
        return httpx.Response(200, json=response())

    result = asyncio.run(review(original, transport=httpx.MockTransport(provider)))
    assert result["available"] and not result["feedback_enabled"]
    assert len(result["calls"]) == 1
