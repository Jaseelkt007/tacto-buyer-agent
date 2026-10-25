"""Summarize end-to-end advisory interpreter checks, including failures and full buyer latency."""

import argparse
import hashlib
import json
import statistics
from collections import Counter
from pathlib import Path

from arena_kit.cli import load_env
from arena_kit.client import ArenaClient

ROOT = Path(__file__).resolve().parents[2]


def read(path):
    return json.loads(path.read_text())


def save(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def timings(rows):
    values = [r["seconds"] for r in rows]
    return {
        "decisions": len(values), "median_seconds": statistics.median(values) if values else None,
        "max_seconds": max(values) if values else None, "min_seconds": min(values) if values else None,
        "at_least_60_seconds": sum(v >= 60 for v in values),
        "failed_decisions": sum(r["error"] is not None for r in rows),
    }


def interpretations(rows):
    return {
        "attempted_calls": sum(r["model_called"] for r in rows),
        "statuses": dict(Counter(r["reading"]["status"] for r in rows)),
        "errors": dict(Counter(r["reading"]["error"] for r in rows if r["reading"]["status"] == "unavailable")),
        "response_ids": sum(bool(r.get("response_id")) for r in rows),
    }


def actions(record):
    return [r["packet"]["proposed_action"] for r in record.get("observation_packets", [])]


def decision_reviews(rows):
    return {
        "reviews": len(rows), "attempted_reviews": sum(r.get("review_attempted", False) for r in rows),
        "recorded_provider_calls": sum(len(r.get("calls", [])) for r in rows),
        "available": sum(r["available"] for r in rows),
        "verdicts": dict(Counter(r["verdict"] for r in rows if r["available"])),
        "errors": dict(Counter(r["error"] for r in rows if r.get("error"))),
        "unknown_call_counts": sum(r.get("call_count_unknown", False) for r in rows),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--note", default="reply-finalization-r01")
    parser.add_argument("--cases", nargs="+", default=["P07", "P08", "P10", "P18"])
    parser.add_argument("--synthetic", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--verify-hosted", action="store_true", help="read hosted thread timeout counters")
    args = parser.parse_args()
    if args.out.exists():
        parser.error("choose a fresh output directory")
    args.out.mkdir(parents=True)
    baseline = read(ROOT / "evaluations/observation-feedback/runs/practice-all10-r01/comparison.json")
    baseline_paths = {r["case_id"]: ROOT / r["current_file"] for r in baseline["cases"]}
    hosted, all_times, all_reads, all_reviews, inputs = [], [], [], [], {}
    client = None
    if args.verify_hosted:
        load_env(ROOT / "starter-kit/.env")
        client = ArenaClient()
    for cid in args.cases:
        matches = [(p, read(p)) for p in (ROOT / "runs" / cid).glob("*.json")]
        matches = [(p, d) for p, d in matches if d.get("note") == args.note]
        if len(matches) != 1:
            raise ValueError(f"expected exactly one {cid} run with note {args.note}")
        path, data = matches[0]
        previous = read(baseline_paths[data["case_id"]])
        inputs[str(path.relative_to(ROOT))] = hashlib.sha256(path.read_bytes()).hexdigest()
        latency, readings = data["decision_timings"], data["reply_interpretations"]
        all_times.extend(latency)
        all_reads.extend(readings)
        all_reviews.extend(data.get("decision_reviews", []))
        thread_checks = {}
        if client:
            for sid in data["session"]["threads"]:
                thread = client.thread(data["session_id"], sid)
                thread_checks[sid] = {"timeouts": len(thread.get("timeouts", [])), "status": thread.get("status")}
        hosted.append({
            "case_id": data["case_id"], "path": str(path.relative_to(ROOT)),
            "baseline_path": str(baseline_paths[data["case_id"]].relative_to(ROOT)),
            "baseline_score": previous["result"]["score"] * 100, "score": data["result"]["score"] * 100,
            "delta_points": (data["result"]["score"] - previous["result"]["score"]) * 100,
            "same_final_terms": data["result"]["terms"] == previous["result"]["terms"],
            "same_actions": actions(data) == actions(previous),
            "deal": data["result"]["deal"], "must_haves_ok": data["result"]["must_haves_ok"],
            "buyer_fallbacks": sum(r["source"] != "engine" for r in data["decisions"]),
            "latency": timings(latency), "interpretations": interpretations(readings),
            "decision_reviews": decision_reviews(data.get("decision_reviews", [])),
            "server_threads": thread_checks,
        })
    if client:
        client.http.close()
    synthetic, synthetic_times, synthetic_reads, synthetic_reviews = [], [], [], []
    old_synthetic = {r["case_id"]: r for r in read(
        ROOT / "evaluations/supplier-generalization/runs/wave02-r01/results.json"
    )}
    for row in read(args.synthetic / "results.json"):
        name = row["case_id"].split(":")[-1]
        data = read(args.synthetic / f"{name}-private.json")
        synthetic_times.extend(data["decision_timings"])
        synthetic_reads.extend(data["reply_interpretations"])
        synthetic_reviews.extend(data.get("decision_reviews", []))
        synthetic.append({
            "case_id": row["case_id"], "score": row["result"]["score"] * 100,
            "baseline_score": old_synthetic[row["case_id"]]["result"]["score"] * 100,
            "latency": timings(data["decision_timings"]),
            "interpretations": interpretations(data["reply_interpretations"]),
            "decision_reviews": decision_reviews(data.get("decision_reviews", [])),
        })
    summary = {
        "hosted": {"cases": hosted, "latency": timings(all_times), "interpretations": interpretations(all_reads),
                   "decision_reviews": decision_reviews(all_reviews)},
        "synthetic": {"cases": synthetic, "latency": timings(synthetic_times),
                      "interpretations": interpretations(synthetic_reads),
                      "decision_reviews": decision_reviews(synthetic_reviews),
                      "wave": read(args.synthetic / "summary.json")},
        "inputs_sha256": inputs,
        "measurement": "complete agent.decide including capture; excludes supplier HTTP response waiting",
        "limitations": "One pass each; not a worst-case latency guarantee. Synthetic supplier choices vary. "
                       "Advisory content has no direct policy authority; latency can affect scheduling.",
    }
    save(args.out / "comparison.json", summary)
    print(json.dumps({"hosted": summary["hosted"]["latency"], "synthetic": summary["synthetic"]["latency"],
                      "hosted_scores_changed": sum(r["delta_points"] != 0 for r in hosted),
                      "hosted_interpretations": summary["hosted"]["interpretations"],
                      "synthetic_interpretations": summary["synthetic"]["interpretations"]}, indent=2))


if __name__ == "__main__":
    main()
