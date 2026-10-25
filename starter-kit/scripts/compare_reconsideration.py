"""Run or analyse the preregistered two-pass comparison. All output attempts are retained."""

import argparse
import json
import statistics
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]
ORDERS = [("off", "deterministic", "decision"), ("decision", "deterministic", "off")]


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n")


def analyse(root):
    runs = []
    for folder in sorted(root.glob("pass*-*")):
        if not folder.is_dir():
            continue
        if not (folder / "summary.json").exists():
            runs.append({"run": folder.name, "incomplete": True})
            continue
        manifest = json.loads((folder / "manifest.json").read_text())
        summary = json.loads((folder / "summary.json").read_text())
        infos, by_case, mismatches = [], {}, []
        for file in sorted(folder.glob("*-private.json")):
            data = json.loads(file.read_text())
            row = data["evaluation"]
            by_case[row["case_id"]] = row.get("result", {}).get("score", 0) * 100
            for move in data["buyer_trace"]:
                info = move.get("reconsideration")
                if not info:
                    continue
                infos.append(info)
                if info["used"] and info["candidate"]["terms"] not in move["our_sheets"]:
                    mismatches.append({"case": row["case_id"], "round": move["round"]})
        calls = [i["seconds"] for i in infos if i["model_called"]]
        runs.append(
            {
                "run": folder.name,
                "arm": manifest["reconsideration"],
                "summary": summary,
                "suite_integrity": manifest["suite_integrity"],
                "source_sha256": manifest["source_sha256"],
                "case_scores": by_case,
                "eligible": sum(i["eligible"] for i in infos),
                "alternatives_sent": sum(i["used"] for i in infos),
                "gate_calls": len(calls),
                "adapter_errors": sum(i["error"] is not None for i in infos),
                "wire_mismatches": mismatches,
                "gate_median_seconds": statistics.median(calls) if calls else None,
                "gate_max_seconds": max(calls) if calls else None,
            }
        )
    groups = defaultdict(list)
    for run in runs:
        if not run.get("incomplete"):
            groups[run["arm"]].append(run)
    aggregate = {}
    for arm, values in groups.items():
        scores = [r["summary"]["synthetic_wave_score"] for r in values]
        aggregate[arm] = {
            "passes": len(values),
            "mean_score": statistics.mean(scores),
            "range": [min(scores), max(scores)],
            "alternatives_sent": sum(r["alternatives_sent"] for r in values),
            "gate_calls": sum(r["gate_calls"] for r in values),
            "adapter_errors": sum(r["adapter_errors"] for r in values),
            "supplier_fallbacks": sum(r["summary"]["model_fallbacks"] for r in values),
            "failed_must_haves": sum(r["summary"]["failed_must_haves"] for r in values),
            "failed_cases": sum(r["summary"]["failed"] for r in values),
        }
    save(root / "comparison.json", {"runs": runs, "aggregate": aggregate})
    lines = [
        "# Reconsideration comparison",
        "",
        "Two passes per arm; synthetic development evidence, not a leaderboard estimate.",
        "Supplier calls are stochastic. Report fallback-contaminated runs rather than deleting them.",
        "",
        "| Arm | Passes | Mean / 100 | Range | Alternatives sent | Gate calls | Adapter errors | Supplier fallbacks |",
        "|---|---:|---:|---|---:|---:|---:|---:|",
    ]
    for arm, r in aggregate.items():
        lines.append(
            f"| {arm} | {r['passes']} | {r['mean_score']:.2f} | {r['range']} | "
            f"{r['alternatives_sent']} | {r['gate_calls']} | {r['adapter_errors']} | {r['supplier_fallbacks']} |"
        )
    lines += [
        "",
        "| Run | Score | Deals | Alternatives | Gate calls | Max gate seconds |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for r in runs:
        if r.get("incomplete"):
            lines.append(f"| {r['run']} | incomplete | | | | |")
        else:
            lines.append(
                f"| {r['run']} | {r['summary']['synthetic_wave_score']} | {r['summary']['deals']} | "
                f"{r['alternatives_sent']} | {r['gate_calls']} | {r['gate_max_seconds']} |"
            )
    (root / "comparison.md").write_text("\n".join(lines) + "\n")
    print(json.dumps(aggregate), flush=True)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("root", type=Path)
    ap.add_argument("--run-local", action="store_true")
    ap.add_argument("--supplier-mode", choices=["llm", "reference"], default="llm")
    args = ap.parse_args()
    if args.run_local:
        if args.root.exists():
            ap.error("choose a fresh root; use analysis without --run-local for existing attempts")
        args.root.mkdir(parents=True)
        attempts = []
        for number, order in enumerate(ORDERS, 1):
            for arm in order:
                output = args.root / f"pass{number}-{arm}"
                cmd = [
                    sys.executable,
                    "scripts/supplier_wave.py",
                    "--suite",
                    "../evaluations/supplier-generalization/wave-02",
                    "--finish-when-done",
                    "--reconsider",
                    arm,
                    "--mode",
                    args.supplier_mode,
                    "--out",
                    str(output),
                ]
                print(f"Starting pass {number}, arm {arm}", flush=True)
                with (args.root / f"pass{number}-{arm}.log").open("w") as log:
                    try:
                        result = subprocess.run(cmd, cwd=KIT, stdout=log, stderr=subprocess.STDOUT, timeout=600)
                        code = result.returncode
                    except subprocess.TimeoutExpired:
                        code = "harness_timeout"
                attempts.append({"pass": number, "arm": arm, "command": cmd, "exit_code": code})
                save(args.root / "attempts.json", attempts)
                analyse(args.root)
    elif not args.root.is_dir():
        ap.error("no run directory")
    analyse(args.root)


if __name__ == "__main__":
    main()
