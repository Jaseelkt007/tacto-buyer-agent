"""Review captured decisions offline. Never opens a negotiation session or changes buyer actions."""

import argparse
import asyncio
import hashlib
import json
import shutil
import statistics
import time
from collections import Counter
from pathlib import Path

from arena_kit.agents.procudeal import observation
from arena_kit.cli import load_env

KIT = Path(__file__).resolve().parents[1]


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n")


def read_inputs(paths):
    files = []
    for path in paths:
        files.extend(sorted(path.glob("*-observations.json")) if path.is_dir() else [path])
    packets, errors, inputs = [], [], {}
    seen = set()
    for path in files:
        data = json.loads(path.read_text())
        inputs[str(path.resolve())] = hashlib.sha256(path.read_bytes()).hexdigest()
        errors.extend(data.get("observation_errors", []))
        for record in data.get("observation_packets", []):
            key = observation.digest(record["packet"])
            if key != record["sha256"]:
                raise ValueError(f"snapshot hash mismatch in {path}")
            if key in seen:
                raise ValueError("duplicate snapshot input; pass each run file once")
            seen.add(key)
            packets.append(record)
    if not packets:
        raise ValueError("no captured decisions; run supplier_wave.py or bench.py with --observe first")
    return packets, errors, inputs


async def run(packets, out, parallel, feedback=False):
    semaphore = asyncio.Semaphore(parallel)

    async def one(i, record):
        async with semaphore:
            result = await observation.review(record["packet"], feedback=feedback)
            save(out / f"{i:04d}.json", result)
            print(f"{result['case_id']} decision {result['decision_index']}: "
                  f"{result.get('verdict', result['error'])} ({result['seconds']}s)", flush=True)
            return result

    return await asyncio.gather(*(one(i, p) for i, p in enumerate(packets)))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("inputs", type=Path, nargs="+")
    ap.add_argument("--out", type=Path)
    ap.add_argument("--parallel", type=int, default=4, choices=range(1, 5))
    ap.add_argument("--validate-only", action="store_true")
    ap.add_argument("--feedback", action="store_true", help="review with a summary of earlier exchanges")
    args = ap.parse_args()
    try:
        packets, errors, inputs = read_inputs(args.inputs)
    except (ValueError, KeyError, OSError) as exc:
        ap.error(str(exc))
    if args.validate_only:
        print(json.dumps({"snapshots": len(packets), "capture_errors": errors, "model_calls": 0}))
        return
    if args.out is None or args.out.exists():
        ap.error("--out must name a fresh directory")
    load_env(KIT / ".env")
    args.out.mkdir(parents=True)
    shutil.copyfile(observation.__file__, args.out / "observer-source.py")
    shutil.copyfile(observation.exchange_feedback.__file__, args.out / "feedback-source.py")
    shutil.copyfile(__file__, args.out / "reviewer-source.py")
    save(args.out / "packets.json", packets)
    sources = (Path(observation.__file__), Path(observation.exchange_feedback.__file__), Path(__file__))
    save(args.out / "manifest.json", {
        "model": observation.MODEL, "timeout_seconds": observation.TIMEOUT_S, "parallel": args.parallel,
        "mode": "offline_observation", "inputs": inputs, "prompt": observation.PROMPT,
        "feedback_enabled": args.feedback,
        "feedback_prompt": observation.exchange_feedback.PROMPT if args.feedback else None,
        "source_sha256": {str(p.relative_to(KIT)): hashlib.sha256(p.read_bytes()).hexdigest()
                          for p in sources},
        "capture_errors": errors,
    })
    started = time.monotonic()
    rows = asyncio.run(run(packets, args.out, args.parallel, args.feedback))
    durations = sorted(r["seconds"] for r in rows)
    summary = {
        "snapshots": len(packets), "capture_errors": len(errors), "model_calls": sum(len(r["calls"]) for r in rows),
        "available": sum(r["available"] for r in rows), "unavailable": sum(not r["available"] for r in rows),
        "verdicts": dict(Counter(r["verdict"] for r in rows if r["available"])),
        "errors": dict(Counter(r["error"] for r in rows if not r["available"])),
        "median_call_seconds": statistics.median(durations), "max_call_seconds": max(durations),
        "capture_seconds_total": sum(p["capture_seconds"] for p in packets),
        "elapsed_seconds": round(time.monotonic() - started, 3), "changed_buyer_actions": 0,
        "feedback_enabled": args.feedback,
        "note": "Fixed-choice observations require semantic review; no intervention or score benefit measured.",
    }
    save(args.out / "summary.json", summary)
    lines = ["# Observation report", "", summary["note"], "", "```json", json.dumps(summary, indent=2), "```", ""]
    for i, r in enumerate(rows):
        lines += [f"## {r['case_id']} decision {r['decision_index']} ({r['action']})", "",
                  f"{r.get('verdict', 'UNAVAILABLE')}; field={r.get('field')}; error={r['error']}.", "",
                  f"[Full observation]({i:04d}.json)", ""]
        if r.get("supporting_source"):
            lines += [f"Evidence: `{r['evidence']}`", "", "```text", r["supporting_source"]["text"], "```", ""]
    (args.out / "report.md").write_text("\n".join(lines))
    print(json.dumps(summary), flush=True)
    if summary["unavailable"] or errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
