import asyncio
import json
import time
from copy import deepcopy
from pathlib import Path

import httpx
import pytest
from test_procudeal_v17 import CASE, SID, supplier_msg

from arena_kit.agents.procudeal import ProcuDealAgent, policy
from arena_kit.agents.procudeal.observation import CaptureAgent, digest, parse_answers, request_body, review
from arena_kit.data import DataPackage
from arena_kit.docs import read_document
from arena_kit.supplier_gym.chooser import ReferenceChooser
from arena_kit.supplier_gym.sim import GymSim
from arena_kit.supplier_gym.suite import load_suite


@pytest.fixture(autouse=True)
def defaults(monkeypatch):
    monkeypatch.setattr(policy, "FLAGS", policy.parse_off("", ""))
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")


def captured():
    agent = CaptureAgent(ProcuDealAgent(None))
    threads = {SID: [supplier_msg(45, payment_days=30, contract_months=24)]}
    decision = agent.decide(CASE, threads)
    assert not agent.observation_errors
    return agent, threads, decision


def test_snapshots_are_independent_of_later_replies_and_returned_actions():
    agent, threads, decision = captured()
    record = agent.observation_packets[0]
    saved = deepcopy(record)
    threads[SID].append({"from": "supplier", "body": "FUTURE_SECRET"})
    decision["message"]["body"] = "MODIFIED_AFTER_CAPTURE"
    assert record == saved
    assert digest(record["packet"]) == record["sha256"]
    wire = json.dumps(request_body(record["packet"]))
    assert "FUTURE_SECRET" not in wire and "MODIFIED_AFTER_CAPTURE" not in wire
    assert "private_profiles" not in wire and "backoffice" not in wire


def test_capture_failure_does_not_change_buyer_action(monkeypatch):
    threads = {SID: [supplier_msg(45, payment_days=30, contract_months=24)]}
    plain = ProcuDealAgent(None).decide(CASE, deepcopy(threads))
    observed = CaptureAgent(ProcuDealAgent(None))

    def fail(*args):
        raise ValueError("capture unavailable")

    monkeypatch.setattr(observed, "snapshot", fail)
    assert observed.decide(CASE, threads) == plain
    assert observed.observation_errors == [{"decision_index": 0, "error": "ValueError"}]
    assert observed.trace[-1]["source"] == "engine"


def response(choice="NO_ISSUE", name="assessment"):
    return {"answers": [{"type": "choice", "name": name, "choice": choice, "confidence": 0.9}]}


@pytest.mark.parametrize("value", [
    response("RECONSIDER"), response("NO_ISSUE", "unknown_question"),
    response("RECONSIDER:nonexistent"), {"answers": []},
    {"answers": [{"type": "refusal"}]},
])
def test_invalid_or_inconsistent_answers_are_not_approvals(value):
    agent, _, _ = captured()
    with pytest.raises(ValueError):
        parse_answers(value, request_body(agent.observation_packets[0]["packet"]))


def test_model_response_records_original_evidence_without_action_authority():
    agent, _, _ = captured()
    packet = agent.observation_packets[0]["packet"]
    def provider(req):
        body = json.loads(req.content)
        if body["questions"][0]["name"] == "assessment":
            return httpx.Response(200, json=response("RECONSIDER:unit_price"))
        assert "RECONSIDER:unit_price" in body["questions"][0]["instructions"]
        return httpx.Response(200, json=response("case", "evidence"))

    transport = httpx.MockTransport(provider)
    result = asyncio.run(review(packet, transport=transport))
    assert result["available"] and result["verdict"] == "RECONSIDER"
    assert result["supporting_source"] == packet["evidence"][0]
    assert result["packet_sha256"] == digest(packet)
    assert len(agent.trace) == 1
    assert len(result["calls"]) == 2


def test_unsupported_flag_is_not_an_approval_or_usable_finding():
    agent, _, _ = captured()

    def provider(req):
        name = json.loads(req.content)["questions"][0]["name"]
        return httpx.Response(200, json=response("RECONSIDER:unit_price" if name == "assessment" else "NONE", name))

    result = asyncio.run(review(agent.observation_packets[0]["packet"], transport=httpx.MockTransport(provider)))
    assert not result["available"] and result["error"] == "unsupported_flag"
    assert result["assessment"] == "RECONSIDER:unit_price" and "verdict" not in result


def test_no_issue_requires_one_call_and_never_requests_support():
    agent, _, _ = captured()
    transport = httpx.MockTransport(lambda req: httpx.Response(200, json=response()))
    result = asyncio.run(review(agent.observation_packets[0]["packet"], transport=transport))
    assert result["available"] and result["verdict"] == "NO_ISSUE"
    assert len(result["calls"]) == 1


def test_timeout_is_hard_and_not_no_issue():
    agent, _, _ = captured()

    async def slow(request):
        await asyncio.sleep(1)
        return httpx.Response(200, json=response())

    started = time.monotonic()
    result = asyncio.run(review(agent.observation_packets[0]["packet"],
                                transport=httpx.MockTransport(slow), timeout=0.02))
    assert time.monotonic() - started < 0.5
    assert not result["available"] and result["error"] == "TimeoutError"
    assert "verdict" not in result


def test_provider_failure_does_not_leak_response_or_become_approval():
    agent, _, _ = captured()
    transport = httpx.MockTransport(lambda req: httpx.Response(403, text="SECRET error body"))
    result = asyncio.run(review(agent.observation_packets[0]["packet"], transport=transport))
    assert result["error"] == "provider_http_403" and not result["available"]
    assert "SECRET" not in json.dumps(result)


def test_observation_preserves_every_action_and_outcome_on_complete_reference_wave():
    kit = Path(__file__).parents[1]
    fixtures, _, _ = load_suite(kit.parent / "evaluations/supplier-generalization/wave-02")
    package = DataPackage(kit / "data/package")

    def negotiate(case, profiles, observe):
        sim = GymSim(case, profiles, ReferenceChooser(), package.facts)
        opened = sim.open("test", case["case_id"])
        session = opened["session_id"]
        threads = opened["threads"]
        buyer = ProcuDealAgent(None, package)
        if observe:
            buyer = CaptureAgent(buyer)
        decisions = []
        for _ in range(40):
            for events in threads.values():
                for message in events:
                    for att in message.get("attachments") or []:
                        if "text" not in att:
                            content = sim.attachment("test", session, att["attachment_id"])[0]
                            att["text"] = read_document(att["name"], content)
            decision = buyer.decide(case, threads)
            decisions.append(deepcopy(decision))
            sid, msg = decision["supplier_id"], decision["message"]
            result = sim.message("test", session, sid, msg)
            if msg.get("action"):
                if observe:
                    assert not buyer.observation_errors
                    assert len(buyer.observation_packets) == len(decisions)
                return decisions, result
            threads[sid] += [{**msg, "from": "buyer"}, result]
        pytest.fail("negotiation did not close")

    for case, profiles in fixtures:
        assert negotiate(case, profiles, False) == negotiate(case, profiles, True)
