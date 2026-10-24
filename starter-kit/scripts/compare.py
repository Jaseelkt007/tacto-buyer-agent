"""Compare agents across saved runs: best and latest score per case, per agent (and note).

    uv run python scripts/compare.py                 # every agent
    uv run python scripts/compare.py --by note       # one column per run note, e.g. "engine v1.1"
"""

import argparse
import json
from collections import defaultdict
from pathlib import Path

RUNS = Path(__file__).resolve().parents[2] / "runs"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--by", choices=["agent", "note"], default="agent")
    args = ap.parse_args()
    best, cases = defaultdict(dict), set()
    for f in sorted(RUNS.glob("*/*.json")):
        r = json.loads(f.read_text())
        score = (r.get("result") or {}).get("score")
        if score is None:
            continue
        col, case = r.get(args.by) or "-", r["case_id"].split(":")[-1]
        cases.add(case)
        best[col][case] = max(best[col].get(case, 0.0), score)
    cols = sorted(best)
    print("| case | " + " | ".join(cols) + " |")
    print("|---|" + "---|" * len(cols))
    for case in sorted(cases):
        print(f"| {case} | " + " | ".join(f"{best[c][case]:.3f}" if case in best[c] else "" for c in cols) + " |")
    hosted = [c for c in sorted(cases) if c.startswith("P")]
    means = []
    for c in cols:
        got = [best[c][k] for k in hosted if k in best[c]]
        means.append(f"{100 * sum(got) / len(got):.1f} ({len(got)})" if got else "")
    print("| **mean P (n)** | " + " | ".join(means) + " |")


if __name__ == "__main__":
    main()
