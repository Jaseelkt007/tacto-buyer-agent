import asyncio
import json
from copy import deepcopy

import httpx
import pytest
from test_procudeal_v17 import CASE, SID, buyer_msg, supplier_msg

from arena_kit.agents.procudeal import ProcuDealAgent, policy
from arena_kit.agents.procudeal.reply_interpretation import (
    ReplyInterpreter,
    ask_reply,
    build_context,
    response_schema,
    validate,
)


def exchange():
    events = [supplier_msg(44, contract_months=24), buyer_msg(40, contract_months=12),
              supplier_msg(43, n=1, contract_months=36, payment_days=30,
                           body="This price requires a three-year agreement.")]
    return build_context(CASE, SID, events), events


def answer(context, kind="condition"):
    return {"observations": [{
        "package_ref": "package:0", "kind": kind, "field": "contract_months",
        "evidence": [{"source_ref": context["latest_message_ref"] + ":body",
                      "quote": "This price requires a three-year agreement."}],
    }]}


def test_history_feedback_is_public_supplier_scoped_and_original():
    context, events = exchange()
    events[-1]["result"] = {"score": 100, "private_cost": 1}
    events[-1]["previous_model_output"] = "must accept"
    events[-1]["claim_results"] = [{"index": 0, "result": "verified"}]
    current = build_context({**CASE, "c_best": 123}, SID, events)
    serialized = json.dumps(current)
    assert "private_cost" not in serialized and "previous_model_output" not in serialized and "c_best" not in serialized
    assert current["history"][1]["term_sheets"][0]["terms"]["unit_price"] == 40
    assert current["history"][-1]["claim_results"][0]["result"] == "verified"
    assert context["history"][-1].get("claim_results") == []


def test_preferences_conditions_and_packages_remain_separate():
    context, events = exchange()
    events[-1]["term_sheets"].append(
        {"term_sheet_id": "alternative", "terms": {"unit_price": 45, "contract_months": 12}}
    )
    context = build_context(CASE, SID, events)
    report = validate(context, answer(context, "preference")).report(context, {"contract_months": 12})
    obs = report["observations"][0]
    assert obs["kind"] == "preference" and obs["quoted_value"] == 36
    assert obs["policy_effect"] == "advisory_only" and obs["proposal_comparison"] == "different_from_quoted_value"
    assert report["packages"]["package:1"]["terms"]["contract_months"] == 12
    assert report["validation"] == "provenance_checked_not_semantically_proven"


@pytest.mark.parametrize("change,error", [
    ("cross_supplier", "unknown_source"), ("buyer_source", "unknown_source"),
    ("invented_quote", "quote_not_in_source"), ("old_only", "missing_current_scope_evidence"),
    ("invented_package", "unknown_package"), ("invented_value", "invalid_shape"),
    ("absent_field", "field_not_quoted"), ("duplicate", "duplicate_observation"),
])
def test_invalid_interpretations_cannot_reach_policy_as_available(change, error):
    context, _ = exchange()
    raw = answer(context)
    obs = raw["observations"][0]
    if change == "cross_supplier":
        obs["evidence"][0]["source_ref"] = "message:other:2:body"
    elif change == "buyer_source":
        obs["evidence"][0]["source_ref"] = f"message:{SID}:1:body"
    elif change == "invented_quote":
        obs["evidence"][0]["quote"] = "We agree to any price."
    elif change == "old_only":
        obs["evidence"] = [{"source_ref": f"message:{SID}:0:body", "quote": "Thank you for your enquiry."}]
    elif change == "invented_package":
        obs["package_ref"] = "old-package"
    elif change == "invented_value":
        obs["value"] = 12
    elif change == "absent_field":
        obs["field"] = "lead_time_days"
    else:
        raw["observations"].append(deepcopy(obs))
    with pytest.raises(ValueError, match=error):
        validate(context, raw)


def test_old_condition_can_supply_context_but_cannot_silently_attach_to_new_quote():
    context, events = exchange()
    raw = answer(context)
    events[-1]["body"] = "Our earlier duration condition also applies to this revised quote."
    context = build_context(CASE, SID, events)
    raw["observations"][0]["evidence"] = [
        {"source_ref": f"message:{SID}:0:body", "quote": "Thank you for your enquiry."},
        {"source_ref": context["latest_message_ref"] + ":body", "quote": events[-1]["body"]},
    ]
    view = validate(context, raw)
    # Even exact citations don't establish semantics: this contrived old quote is irrelevant.
    assert view.report(context)["validation"] == "provenance_checked_not_semantically_proven"
    events[-1]["term_sheets"][0]["terms"]["contract_months"] = 12
    with pytest.raises(ValueError, match="stale_interpretation"):
        view.report(build_context(CASE, SID, events))


def test_duplicate_reads_are_cached_and_prior_model_output_is_never_feedback():
    calls = []

    async def provider(payload):
        context = json.loads(payload["input"])
        calls.append(context)
        return answer(context), {}

    context, events = exchange()
    reader = ReplyInterpreter(provider)
    reader.read(CASE, SID, events)
    reader.read(CASE, SID, events)
    assert len(calls) == 1
    events += [buyer_msg(41), supplier_msg(42, n=2, contract_months=36,
                                         body="This price requires a three-year agreement.")]
    reader.read(CASE, SID, events)
    assert len(calls) == 2 and "observations" not in calls[1]
    reader.read({**CASE, "case_id": "case:other"}, SID, events)
    assert len(calls) == 3


@pytest.mark.parametrize("failure", [False, True])
def test_real_policy_receives_reading_and_actions_stay_identical(monkeypatch, failure):
    monkeypatch.setattr(policy, "FLAGS", policy.parse_off("", ""))

    async def provider(payload):
        if failure:
            raise TimeoutError()
        return answer(json.loads(payload["input"])), {}

    _, events = exchange()
    base, observed = ProcuDealAgent(None, interpret_replies=False), ProcuDealAgent(None)
    assert base.reply_interpreter is None
    observed.reply_interpreter = ReplyInterpreter(provider)
    original = deepcopy(events)
    baseline = base.decide(CASE, {SID: events})
    actual = observed.decide(CASE, {SID: events})
    assert actual == baseline and events == original
    reading = observed.negotiator.sides[SID].reply_reading
    assert reading.status == ("unavailable" if failure else "available")
    assert observed.trace[-1]["source"] == "engine"
    assert observed.trace[-1]["reply_interpretation"]["semantic_authority"] == "none"
    # Restore uses historical deterministic policy only; there is one latest-prefix model call.
    assert len(observed.reply_interpreter.records) == 1


@pytest.mark.parametrize("status,sender", [("final_offer", "sales@T1"), ("agreed", "sales@T1"), ("open", "arena")])
def test_terminal_and_arena_replies_do_not_call_model(status, sender):
    async def forbidden(payload):
        pytest.fail("model must not be called")

    _, events = exchange()
    events[-1].update(status=status, **{"from": sender})
    reader = ReplyInterpreter(forbidden)
    assert reader.read(CASE, SID, events).status == "skipped"
    assert not reader.records[0]["model_called"]


def test_schema_only_allows_package_fields_and_retains_unscoped_conditions():
    context, _ = exchange()
    variants = response_schema(context)["properties"]["observations"]["items"]["anyOf"]
    by_ref = {v["properties"]["package_ref"]["enum"][0]: v["properties"]["field"]["enum"] for v in variants}
    assert "lead_time_days" not in by_ref["package:0"]
    assert "lead_time_days" in by_ref["unscoped"]
    raw = answer(context)
    raw["observations"][0].update(package_ref="unscoped", field="lead_time_days")
    obs = validate(context, raw).report(context)["observations"][0]
    assert obs["quoted_value"] is None and obs["value_source"] is None


@pytest.mark.parametrize("kind", ["success", "refusal", "incomplete", "http"])
def test_responses_transport_and_failure_statuses(monkeypatch, kind):
    monkeypatch.setenv("OPENAI_API_KEY", "test")

    def provider(request):
        if kind == "http":
            return httpx.Response(429, json={})
        content = [{"type": "output_text", "text": '{"observations": []}'}]
        if kind == "refusal":
            content = [{"type": "refusal", "refusal": "no"}]
        return httpx.Response(200, json={"status": "incomplete" if kind == "incomplete" else "completed",
                                        "output": [{"content": content}]})

    call = ask_reply({}, transport=httpx.MockTransport(provider))
    if kind == "success":
        assert asyncio.run(call)[0] == {"observations": []}
    else:
        with pytest.raises(ValueError):
            asyncio.run(call)


def test_production_factory_enables_isolated_interpreters_without_extra_flags(monkeypatch):
    from arena_kit import agents
    from arena_kit.agents.procudeal import reply_interpretation
    from arena_kit.cli import agent_factory

    monkeypatch.delenv("PROCUDEAL_REPLY_INTERPRETATION")
    monkeypatch.setattr(agents, "llm_from_env", lambda: None)
    seen = []

    async def provider(payload):
        seen.append(json.loads(payload["input"]))
        return {"observations": []}, {}

    monkeypatch.setattr(reply_interpretation, "ask_reply", provider)
    factory = agent_factory("procudeal", None)
    first, second = factory(), factory()
    assert isinstance(first.reply_interpreter, ReplyInterpreter)
    assert first.reply_interpreter is not second.reply_interpreter
    _, events = exchange()
    first.decide(CASE, {SID: events})
    assert len(seen) == 1
    assert first.trace[-1]["reply_interpretation"]["status"] == "available"
    assert first.trace[-1]["source"] == "engine"
    assert second.reply_interpreter.records == []


def test_default_has_explicit_baseline_override_and_rejects_bad_config(monkeypatch):
    monkeypatch.delenv("PROCUDEAL_REPLY_INTERPRETATION")
    assert ProcuDealAgent(None, interpret_replies=False).reply_interpreter is None
    monkeypatch.setenv("PROCUDEAL_REPLY_INTERPRETATION", "off")
    assert ProcuDealAgent(None).reply_interpreter is None
    assert isinstance(ProcuDealAgent(None, interpret_replies=True).reply_interpreter, ReplyInterpreter)
    monkeypatch.setenv("PROCUDEAL_REPLY_INTERPRETATION", "typo")
    with pytest.raises(ValueError, match="must be on or off"):
        ProcuDealAgent(None)


def test_final_wave_runner_uses_default_interpreter_without_external_network(monkeypatch):
    from test_supplier_wave import fixture

    from arena_kit import agents
    from arena_kit.agents.procudeal import observation, reply_interpretation
    from arena_kit.cli import agent_factory
    from arena_kit.play import play_waves
    from arena_kit.supplier_gym.chooser import ReferenceChooser
    from arena_kit.supplier_gym.wave import LocalWave

    monkeypatch.delenv("PROCUDEAL_REPLY_INTERPRETATION")
    monkeypatch.delenv("PROCUDEAL_DECISION_REVIEW")
    monkeypatch.setattr(policy, "FLAGS", policy.parse_off("", ""))
    monkeypatch.setattr(agents, "llm_from_env", lambda: None)
    calls, buyers = [], []

    async def provider(payload):
        calls.append(json.loads(payload["input"])["case_id"])
        return {"observations": []}, {}

    async def reviewer(packet, **kwargs):
        assert kwargs["feedback"]
        return {"available": True, "verdict": "NO_ISSUE", "calls": []}

    monkeypatch.setattr(reply_interpretation, "ask_reply", provider)
    monkeypatch.setattr(observation, "review", reviewer)
    factory = agent_factory("procudeal", None)

    def buyer():
        agent = factory()
        buyers.append(agent)
        return agent

    wave = LocalWave([fixture("L01"), fixture("L02")], ReferenceChooser, wait=0, finish_when_done=True)
    with wave.client() as client:
        results = play_waves(client, buyer, waves=1, parallel=2, poll=0.01)
    assert set(results) == {"case:L01", "case:L02"}
    assert all(isinstance(r, dict) and r["ended"] for r in results.values())
    assert set(calls) == set(results)
    assert all(agent.reply_interpreter.records for agent in buyers)
    assert all(agent.decision_reviewer.records for agent in buyers)
    assert all(row["source"] == "engine" for agent in buyers for row in agent.trace)
    assert wave.metrics()["thread_timeouts"] == 0
