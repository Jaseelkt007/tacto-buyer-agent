"""Compare the same offline reviewer with and without exchange feedback on identical snapshots."""

import argparse
import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

KIT = Path(__file__).resolve().parents[1]


def save(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def summarize(root):
    attempts = json.loads((root / "attempts.json").read_text())
    rows, summaries = [], []
    for attempt in attempts:
        folder = root / attempt["label"]
        if not (folder / "summary.json").exists():
            continue
        summaries.append({"label": attempt["label"], **json.loads((folder / "summary.json").read_text())})
        for path in sorted(folder.glob("[0-9][0-9][0-9][0-9].json")):
            row = json.loads(path.read_text())
            rows.append(
                {
                    "arm": attempt["arm"],
                    "pass": attempt["pass"],
                    "path": str(path),
                    "case": row["case_id"],
                    "decision": row["decision_index"],
                    "input_sha256": row["input_packet_sha256"],
                    "assessment": row.get("assessment"),
                    "verdict": row.get("verdict"),
                    "field": row.get("field"),
                    "evidence": row.get("evidence"),
                    "available": row["available"],
                    "error": row["error"],
                }
            )
    totals = {}
    for arm in ("baseline", "feedback"):
        subset = [r for r in rows if r["arm"] == arm]
        totals[arm] = {
            "reviews": len(subset),
            "available": sum(r["available"] for r in subset),
            "verdicts": dict(Counter(r["verdict"] for r in subset if r["available"])),
            "errors": dict(Counter(r["error"] for r in subset if not r["available"])),
        }
    by_key = {}
    for row in rows:
        by_key.setdefault((row["pass"], row["case"], row["decision"]), {})[row["arm"]] = row
    pairs = []
    for (n, case, decision), arms in sorted(by_key.items()):
        pairs.append(
            {
                "pass": n,
                "case": case,
                "decision": decision,
                "same_original_input": len(arms) == 2
                and arms["baseline"]["input_sha256"] == arms["feedback"]["input_sha256"],
                "baseline": arms.get("baseline"),
                "feedback": arms.get("feedback"),
            }
        )
    save(root / "comparison.json", {"totals": totals, "pairs": pairs, "summaries": summaries})
    print(json.dumps(totals, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inputs", nargs="*", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--report-only", action="store_true")
    args = parser.parse_args()
    root = args.out.resolve()
    if args.report_only:
        summarize(root)
        return
    if root.exists() or not args.inputs:
        parser.error("provide captured inputs and a fresh output directory")
    root.mkdir(parents=True)
    attempts = []
    for n, order in enumerate((("baseline", "feedback"), ("feedback", "baseline")), start=1):
        for arm in order:
            label = f"pass{n}-{arm}"
            command = [
                sys.executable,
                "scripts/observe_decisions.py",
                *[str(p.resolve()) for p in args.inputs],
                "--out",
                str(root / label),
            ]
            if arm == "feedback":
                command.append("--feedback")
            attempt = {"label": label, "arm": arm, "pass": n, "command": command}
            attempts.append(attempt)
            save(root / "attempts.json", attempts)
            print(f"Reviewing {label}", flush=True)
            with (root / f"{label}.log").open("w") as log:
                try:
                    result = subprocess.run(command, cwd=KIT, stdout=log, stderr=subprocess.STDOUT, timeout=180)
                    attempt["returncode"] = result.returncode
                except subprocess.TimeoutExpired:
                    attempt["returncode"] = "timeout"
            save(root / "attempts.json", attempts)
            if attempt["returncode"] not in (0, 1):
                break
    summarize(root)


if __name__ == "__main__":
    main()
