import asyncio
import json
import time
from copy import deepcopy

import httpx
import pytest
from test_observation import response
from test_procudeal_v17 import CASE, SID, buyer_msg, supplier_msg

from arena_kit import agents
from arena_kit.agents.procudeal import ProcuDealAgent, observation, policy, reply_interpretation
from arena_kit.cli import agent_factory


@pytest.fixture(autouse=True)
def setup(monkeypatch):
    monkeypatch.setattr(policy, "FLAGS", policy.parse_off("", ""))
    monkeypatch.setenv("OPENAI_API_KEY", "test")


@pytest.mark.parametrize("accept", [False, True])
def test_both_default_models_run_in_order_with_feedback_and_preserve_decision(monkeypatch, accept):
    monkeypatch.delenv("PROCUDEAL_REPLY_INTERPRETATION")
    monkeypatch.delenv("PROCUDEAL_DECISION_REVIEW")
    monkeypatch.setattr(agents, "llm_from_env", lambda: None)
    stages = []

    async def interpreter(payload):
        stages.append("interpret")
        return {"observations": []}, {}

    def transport(request):
        body = json.loads(request.content)
        packet = json.loads(body["input"])
        assert packet["exchange_feedback"]["suppliers"][SID]["exchanges"]
        assert packet["proposed_action"]
        stages.append(body["questions"][0]["name"])
        return httpx.Response(200, json=response())

    original_review = observation.review

    async def reviewer(packet, **kwargs):
        assert kwargs["feedback"] is True
        return await original_review(packet, transport=httpx.MockTransport(transport), **kwargs)

    monkeypatch.setattr(reply_interpretation, "ask_reply", interpreter)
    monkeypatch.setattr(observation, "review", reviewer)
    threads = {SID: [supplier_msg(45), buyer_msg(40), supplier_msg(40 if accept else 44, n=1,
                                                                                status="agreed" if accept else "open")]}
    baseline = ProcuDealAgent(None, interpret_replies=False, review_decisions=False).decide(CASE, deepcopy(threads))
    agent = agent_factory("procudeal", None)()
    assert agent.decide(CASE, threads) == baseline
    assert stages == (["assessment"] if accept else ["interpret", "assessment"])
    assert agent.trace[-1]["decision_review"]["verdict"] == "NO_ISSUE"
    assert agent.trace[-1]["decision_review"]["decision_index"] == 0
    assert agent.reconsideration is None
    if accept:
        assert baseline["message"]["action"]["type"] == "accept"


def test_supported_reconsideration_is_logged_without_an_action_override(monkeypatch):
    def provider(request):
        body = json.loads(request.content)
        name = body["questions"][0]["name"]
        return httpx.Response(200, json=response("RECONSIDER:unit_price" if name == "assessment" else "case", name))

    original_review = observation.review

    async def reviewer(packet, **kwargs):
        return await original_review(packet, transport=httpx.MockTransport(provider), **kwargs)

    monkeypatch.setattr(observation, "review", reviewer)
    threads = {SID: [supplier_msg(45)]}
    baseline = ProcuDealAgent(None, review_decisions=False).decide(CASE, deepcopy(threads))
    agent = ProcuDealAgent(None, review_decisions=True)
    assert agent.decide(CASE, threads) == baseline
    row = agent.trace[-1]["decision_review"]
    assert row["verdict"] == "RECONSIDER" and len(row["calls"]) == 2
    assert row["semantic_authority"] == "none"


def test_live_reviewer_has_wall_deadline_and_keeps_the_policy_action(monkeypatch):
    async def hangs(packet, **kwargs):
        await asyncio.sleep(0.3)
        return {"available": True, "verdict": "RECONSIDER"}

    monkeypatch.setattr(observation, "LIVE_TIMEOUT_S", 0.02)
    monkeypatch.setattr(observation, "review", hangs)
    threads = {SID: [supplier_msg(45)]}
    baseline = ProcuDealAgent(None, review_decisions=False).decide(CASE, deepcopy(threads))
    agent = ProcuDealAgent(None, review_decisions=True)
    started = time.monotonic()
    assert agent.decide(CASE, threads) == baseline
    assert time.monotonic() - started < 0.25
    assert agent.trace[-1]["decision_review"]["error"] == "TimeoutError"


def test_exhausted_decision_budget_skips_review(monkeypatch):
    async def forbidden(*args, **kwargs):
        pytest.fail("review must not run after budget is exhausted")

    monkeypatch.setattr(observation, "LIVE_DECISION_BUDGET_S", 0)
    monkeypatch.setattr(observation, "review", forbidden)
    agent = ProcuDealAgent(None, review_decisions=True)
    decision = agent.decide(CASE, {SID: [supplier_msg(45)]})
    assert decision["message"]["term_sheets"]
    row = agent.trace[-1]["decision_review"]
    assert row["error"] == "decision_budget_exhausted" and not row["review_attempted"]


def test_decision_review_can_be_disabled_independently(monkeypatch):
    monkeypatch.delenv("PROCUDEAL_REPLY_INTERPRETATION")
    agent = ProcuDealAgent(None, review_decisions=False)
    assert agent.reply_interpreter is not None and agent.decision_reviewer is None
    monkeypatch.setenv("PROCUDEAL_DECISION_REVIEW", "typo")
    with pytest.raises(ValueError, match="must be on or off"):
        ProcuDealAgent(None)
