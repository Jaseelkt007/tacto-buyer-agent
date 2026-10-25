import json
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from arena_kit.client import ArenaError
from arena_kit.supplier_gym.chooser import ReferenceChooser
from arena_kit.supplier_gym.wave import LocalWave

FIXTURES = Path(__file__).parents[1] / "scripts/fixtures/supplier_gym"


def fixture(name):
    return (
        json.loads((FIXTURES / "public" / f"{name}.json").read_text()),
        json.loads((FIXTURES / "private" / f"{name}.json").read_text()),
    )


def test_wave_visibility_unique_sessions_and_cap():
    now = [100.0]
    wave = LocalWave([fixture("L01"), fixture("L02")], ReferenceChooser, clock=lambda: now[0], wait=3)
    with wave.client() as client:
        with pytest.raises(ArenaError) as error:
            client.cases("final")
        assert error.value.status == 403
        now[0] = 103
        cases = client.cases("final")
        assert len(cases) == 2 and all(c["wave"] == 1 and c["seconds_left"] == 480 for c in cases)
        a, b = client.open_session("case:L01"), client.open_session("case:L02")
        assert a["session_id"] != b["session_id"]
        with pytest.raises(ArenaError) as error:
            client.open_session("case:L01")
        assert error.value.status == 409
        now[0] = 584
        assert not any(c["open"] for c in client.cases("final"))
        assert client.session(a["session_id"])["end_reason"] == "wave_cap"
        assert client.session(b["session_id"])["end_reason"] == "wave_cap"


def test_supplier_calls_overlap_and_same_identity_keeps_separate_profiles():
    barrier = threading.Barrier(2)

    class ConcurrentChooser(ReferenceChooser):
        def choose(self, view, history, actions):
            barrier.wait(timeout=3)
            return super().choose(view, history, actions)

    wave = LocalWave([fixture("L01"), fixture("L02")], ConcurrentChooser, wait=0)
    with wave.client() as client:
        opened = [client.open_session(cid) for cid in wave.gyms]
        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [
                pool.submit(client.send_message, o["session_id"], "sup:70170", {"body": "Please improve your offer."})
                for o in opened
            ]
            replies = [f.result(timeout=5) for f in futures]
        assert all(r["status"] == "open" for r in replies)
        assert replies[0]["term_sheets"][0]["terms"] != replies[1]["term_sheets"][0]["terms"]
    assert wave.metrics()["peak_overlapping_supplier_requests"] == 2


def test_thread_clock_enabled_and_reply_after_wave_cap_cannot_be_accepted():
    now = [100.0]

    class SlowChooser(ReferenceChooser):
        def choose(self, view, history, actions):
            now[0] += 481
            return super().choose(view, history, actions)

    wave = LocalWave([fixture("L01")], SlowChooser, clock=lambda: now[0], wait=0)
    with wave.client() as client:
        opened = client.open_session("case:L01")
        reply = client.send_message(opened["session_id"], "sup:70170", {"body": "Please improve your price."})
        assert reply["result"]["ended"] and not reply["result"]["deal"]
        assert client.session(opened["session_id"])["end_reason"] == "wave_cap"
    now[0] = 100
    wave = LocalWave([fixture("L01")], ReferenceChooser, clock=lambda: now[0], wait=0)
    with wave.client() as client:
        opened = client.open_session("case:L01")
        now[0] += 61
        assert len(client.thread(opened["session_id"], "sup:70170")["timeouts"]) == 1


def test_score_benchmark_includes_cheaper_buyer_alternative():
    wave = LocalWave([fixture("L10")], ReferenceChooser, wait=0)
    with wave.client() as client:
        opened = client.open_session("case:L10")
        result = client.walk_away(opened["session_id"])
        assert result["c_best"] == result["c_alt"]
        assert result["score"] == 1


def test_quick_completion_waits_for_every_case_and_preserves_cap():
    now = [100.0]
    wave = LocalWave(
        [fixture("L01"), fixture("L02")], ReferenceChooser, wait=0, clock=lambda: now[0], finish_when_done=True
    )
    with wave.client() as client:
        a, b = client.open_session("case:L01"), client.open_session("case:L02")
        client.walk_away(a["session_id"])
        assert all(c["open"] for c in client.cases("final"))
        client.walk_away(b["session_id"])
        assert not any(c["open"] for c in client.cases("final"))
    assert wave.metrics()["closed_early"] is True
    assert wave.metrics()["cap_seconds"] == 480


def test_real_wave_runner_exits_after_quick_completion_on_old_fixtures():
    from arena_kit.play import play_waves

    class CloseImmediately:
        def decide(self, case, threads):
            return {"supplier_id": case["suppliers"][0], "message": {"action": {"type": "walk_away"}}}

    wave = LocalWave([fixture("L01"), fixture("L02")], ReferenceChooser, wait=0, finish_when_done=True)
    with wave.client() as client:
        results = play_waves(client, CloseImmediately, waves=1, parallel=2, poll=0.05)
    assert len(results) == 2
    assert all(result["ended"] for result in results.values())
    assert wave.metrics()["closed_early"] is True
