"""One local eight-minute LLM supplier wave through the unchanged final runner."""

import argparse
import hashlib
import json
import logging
import shutil
import threading
import time
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path

from negotiation_timing import TimedBuyer

from arena_kit.agents.procudeal import ProcuDealAgent, policy
from arena_kit.agents.procudeal.dossier import build
from arena_kit.cli import load_env
from arena_kit.data import DataPackage
from arena_kit.play import play_waves
from arena_kit.supplier_gym.chooser import LLMChooser, ReferenceChooser
from arena_kit.supplier_gym.suite import load_suite, validate_suite
from arena_kit.supplier_gym.wave import LocalWave

KIT = Path(__file__).resolve().parents[1]
FIXTURES = KIT / "scripts/fixtures/supplier_gym"


def save(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n")


def no_buyer_model(*args, **kwargs):
    raise RuntimeError("v1.9 unexpectedly requested a model fallback")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--mode", choices=["llm", "reference"], default="llm")
    ap.add_argument("--model", default="gpt-6.1-sol")
    ap.add_argument("--suite", type=Path, default=FIXTURES, help="directory with public/ and private/ case files")
    ap.add_argument("--finish-when-done", action="store_true", help="close the local wave once every case has ended")
    ap.add_argument("--validate-only", action="store_true", help="check inputs and arithmetic without running a buyer")
    ap.add_argument("--observe", action="store_true", help="capture decision contexts for an offline reviewer")
    ap.add_argument("--reconsider", choices=["off", "deterministic", "decision"], default="off")
    ap.add_argument("--interpret-replies", action=argparse.BooleanOptionalAction, default=None,
                    help="override default advisory reply interpretation; adds live latency")
    ap.add_argument("--cases", nargs="+", help="case names from the sealed suite, e.g. G03 G06")
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()
    try:
        fixtures, fixture_paths, integrity = load_suite(args.suite)
        validation = validate_suite(args.suite)
        if args.cases:
            selected = {f"case:{c.removeprefix('case:')}" for c in args.cases}
            if selected - fixture_paths.keys():
                ap.error("unknown case in --cases")
            fixtures = [(c, p) for c, p in fixtures if c["case_id"] in selected]
    except (ValueError, KeyError, FileNotFoundError) as exc:
        ap.error(str(exc))
    if args.validate_only:
        print(json.dumps(validation, indent=2))
        return
    if args.out is None:
        ap.error("--out is required for a negotiation run")
    if args.out.resolve().is_relative_to(args.suite.resolve()):
        ap.error("keep run output outside the input suite directory")
    if args.out.exists():
        ap.error("choose a fresh output directory")
    load_env(KIT / ".env")
    policy.FLAGS = policy.parse_off("", "")
    package = DataPackage(KIT / "data/package")
    if package.release is None:
        ap.error("Sunday release missing")
    package.ids("doc:")  # Finish the shared read-only index before worker threads start.
    args.out.mkdir(parents=True)
    shutil.copytree(args.suite, args.out / "suite")
    save(args.out / "input-validation.json", validation)
    buyers, buyer_lock = {}, threading.Lock()

    class RecordedBuyer:
        def __init__(self):
            self.agent = ProcuDealAgent(no_buyer_model, package, interpret_replies=args.interpret_replies)
            if args.reconsider != "off":
                from arena_kit.agents.procudeal.reconsideration import Reconsideration

                self.agent.reconsideration = Reconsideration(args.reconsider)
            if args.observe:
                from arena_kit.agents.procudeal.observation import CaptureAgent

                self.agent = CaptureAgent(self.agent)
            self.agent = TimedBuyer(self.agent)

        def __getattr__(self, name):
            return getattr(self.agent, name)

        def decide(self, case, threads):
            with buyer_lock:
                buyers[case["case_id"]] = self
            return self.agent.decide(case, threads)

    def finished(cid, at, result):
        print(
            f"{cid}: closed at +{at - wave.schedule.start:.1f}s; "
            f"deal={result['deal']}; synthetic score={result['score'] * 100:.1f}",
            flush=True,
        )

    wave = LocalWave(
        fixtures,
        lambda: LLMChooser(args.model) if args.mode == "llm" else ReferenceChooser(),
        facts=package.facts,
        on_end=finished,
        finish_when_done=args.finish_when_done,
    )
    source_files = [
        *sorted((KIT / "arena_kit/supplier_gym").glob("*.py")),
        *sorted((KIT / "arena_kit/agents/procudeal").glob("*.py")),
        KIT / "arena_kit/play.py",
        KIT / "arena_kit/client.py",
        Path(__file__),
        KIT / "scripts/negotiation_timing.py",
    ]
    from arena_kit.agents.procudeal.observation import live_review_enabled
    from arena_kit.agents.procudeal.reply_interpretation import enabled_by_default

    save(
        args.out / "manifest.json",
        {
            "started": datetime.now(UTC).isoformat(),
            "requested": [c["case_id"].split(":")[1] for c, _ in fixtures],
            "mode": args.mode,
            "model": args.model if args.mode == "llm" else None,
            "buyer": "v1.9 defaults",
            "observation_capture": args.observe,
            "reconsideration": args.reconsider,
            "reply_interpretation": enabled_by_default() if args.interpret_replies is None else args.interpret_replies,
            "decision_review": live_review_enabled(),
            "features": policy.FLAGS,
            "release": str(package.release),
            "timed_rehearsal": True,
            "completion_mode": "when_done" if args.finish_when_done else "full_clock",
            "suite": str(args.suite.resolve()),
            "suite_integrity": integrity,
            "waves": 1,
            "cap_seconds": 480,
            "parallel": 10,
            "transport": "in-process HTTP; model provider is the only external service",
            "source_sha256": {
                str(p.relative_to(KIT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in source_files
            },
        },
    )
    logging.basicConfig(level=logging.WARNING, format="%(message)s")
    started = time.monotonic()
    print(
        f"Starting one 480-second wave: {len(fixtures)} cases, "
        f"{sum(len(p) for _, p in fixtures)} supplier instances, clocks enabled; "
        f"completion={'when done' if args.finish_when_done else 'full clock'}.",
        flush=True,
    )
    with wave.client() as client:
        results = play_waves(client, RecordedBuyer, waves=1, parallel=10)
    elapsed = time.monotonic() - started
    rows = []
    for case, profiles in fixtures:
        cid = case["case_id"]
        name = cid.split(":")[1]
        gym, buyer = wave.gyms[cid], buyers.get(cid)
        sessions = list(gym.sessions.values())
        result = results.get(cid)
        error = str(result) if isinstance(result, Exception) else "case never started" if result is None else None
        row = {
            "case_id": cid,
            "status": "failed" if error else "completed",
            "error": error,
            "supplier_model_calls": sum(a["mode"] in ("llm", "fallback") for a in gym.audit),
            "supplier_fallbacks": sum(a["mode"] == "fallback" for a in gym.audit),
            "buyer_fallbacks": sum(t["source"] != "engine" for t in buyer.trace) if buyer else 0,
            "supplier_threads_contacted": sorted({a["supplier_id"] for a in gym.audit}),
            "finished_seconds": round(gym.finished_at - wave.schedule.start, 3) if gym.finished_at else None,
            "end_reason": sessions[0]["end_reason"] if sessions else "not_started",
        }
        if not error:
            row["result"] = result
            cost = result["c_deal"] if result["deal"] else result["c_alt"]
            row["missed_savings_eur"] = round(cost - result["c_best"], 2) if cost is not None else None
        rows.append(row)
        case_path, profile_path = fixture_paths[cid]
        save(args.out / f"{name}-public.json", {"case": case, "transcript": gym.public_transcript()})
        if args.observe:
            save(args.out / f"{name}-observations.json", {
                "observation_packets": getattr(buyer, "observation_packets", []),
                "observation_errors": getattr(buyer, "observation_errors", []),
            })
        save(
            args.out / f"{name}-private.json",
            {
                "evaluation": row,
                "profiles": profiles,
                "choices": gym.audit,
                "buyer_trace": buyer.trace if buyer else [],
                "decision_timings": buyer.decision_timings if buyer else [],
                "reply_interpretations": getattr(getattr(buyer, "reply_interpreter", None), "records", []),
                "decision_reviews": getattr(getattr(buyer, "decision_reviewer", None), "records", []),
                "dossiers": {sid: asdict(build(case, sid, package, rich=True)) for sid in profiles},
                "case_sha256": hashlib.sha256(case_path.read_bytes()).hexdigest(),
                "profile_sha256": hashlib.sha256(profile_path.read_bytes()).hexdigest(),
            },
        )
    summary = {
        **wave.metrics(),
        "elapsed_seconds": round(elapsed, 3),
        "requested": len(fixtures),
        "completed": sum(r["status"] == "completed" for r in rows),
        "failed": sum(r["status"] != "completed" for r in rows),
        "model_calls": sum(r["supplier_model_calls"] for r in rows),
        "model_fallbacks": sum(r["supplier_fallbacks"] for r in rows),
        "buyer_fallbacks": sum(r["buyer_fallbacks"] for r in rows),
        "deals": sum(r.get("result", {}).get("deal", False) for r in rows),
        "failed_must_haves": sum(r.get("result", {}).get("must_haves_ok") is False for r in rows),
        "synthetic_wave_score": round(100 * sum(r.get("result", {}).get("score", 0) for r in rows) / len(fixtures), 1),
        "note": "One synthetic wave; not a leaderboard estimate. Quick completion skips idle cap waiting.",
    }
    save(args.out / "results.json", rows)
    save(args.out / "requests.json", wave.requests)
    save(args.out / "summary.json", summary)
    print(json.dumps(summary), flush=True)
    if (
        summary["failed"]
        or summary["model_fallbacks"]
        or summary["buyer_fallbacks"]
        or summary["failed_must_haves"]
        or summary["http_errors"]
        or summary["thread_timeouts"]
        or summary["wave_cap_closures"]
    ):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
