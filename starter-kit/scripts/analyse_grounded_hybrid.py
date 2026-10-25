"""Reproduce hosted experiment tables from saved runs; never query a leaderboard."""

import argparse
import json
import re
import statistics
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NOTE = re.compile(r"^zone0-v3-(baseline|original|sources|corrected)-r(\d+)$")
EVALUATION = {"case:P03", "case:P04", "case:P07", "case:P11", "case:P18"}


def distribution(values):
    return {"n": len(values), "mean": statistics.mean(values), "median": statistics.median(values),
            "range": [min(values), max(values)]}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, default=ROOT / "notes/analysis/zone0-v3/hosted.json")
    args = ap.parse_args()
    grouped = defaultdict(dict)
    duplicates = []
    for p in sorted((ROOT / "runs").glob("P*/*.json")):
        r = json.loads(p.read_text())
        match = NOTE.match(r.get("note") or "")
        if not match:
            continue
        arm, repeat = match.groups()
        key, case = (arm, int(repeat)), r["case_id"]
        if case in grouped[key]:
            duplicates.append({"arm": arm, "repeat": repeat, "case": case})
        decisions = r.get("decisions") or []
        calls = [d.get("hybrid") or (d["why"].get("hybrid") if isinstance(d.get("why"), dict) else None)
                 for d in decisions]
        calls = [c for c in calls if c]
        grouped[key][case] = {
            "score": r["result"]["score"], "deal": r["result"].get("deal"),
            "must_haves_ok": r["result"].get("must_haves_ok"),
            "rounds": r["session"].get("rounds"), "seconds": r["seconds"],
            "calls": len(calls), "model_errors": sum(bool(c.get("error")) for c in calls),
            "model_used": sum(bool(c.get("used")) for c in calls),
            "nondefault_options": sum(c.get("used") and c.get("choice", {}).get("option") not in ("", "E0", None)
                                      for c in calls),
            "engine_errors": sum(d.get("source") != "engine" for d in decisions),
            "file": str(p.relative_to(ROOT)), "experiment": r.get("experiment"),
        }
    expected = set(grouped.get(("baseline", 1), {}))
    passes = [{"arm": arm, "repeat": repeat, "cases": cases,
               "complete": set(cases) == expected and len(expected) == 10,
               "mean_score": 100 * statistics.mean(r["score"] for r in cases.values())}
              for (arm, repeat), cases in sorted(grouped.items())]
    pairs = []
    for repeat in sorted({r for _, r in grouped}):
        a, b = grouped.get(("baseline", repeat)), grouped.get(("corrected", repeat))
        if a and b and set(a) == set(b) == expected:
            delta = {case: 100 * (b[case]["score"] - a[case]["score"]) for case in sorted(expected)}
            pairs.append({"repeat": repeat, "case_deltas": delta, "mean_delta": statistics.mean(delta.values())})
    summary = {"passes": passes, "paired_deltas": pairs, "duplicates": duplicates}
    summary["arms"] = {}
    for arm in sorted({p["arm"] for p in passes}):
        complete = [p for p in passes if p["arm"] == arm and p["complete"]]
        if not complete:
            continue
        cases = [c for p in complete for c in p["cases"].values()]
        summary["arms"][arm] = {
            "pass_scores": distribution([p["mean_score"] for p in complete]),
            "evaluation_scores": distribution([
                100 * statistics.mean(c["score"] for k, c in p["cases"].items() if k in EVALUATION)
                for p in complete]),
            "case_scores": {case: distribution([100 * p["cases"][case]["score"] for p in complete])
                            for case in sorted(expected)},
            "sessions": len(cases), "deals": sum(bool(c["deal"]) for c in cases),
            "must_have_failures": sum(c["must_haves_ok"] is False for c in cases),
            "must_have_unknown": sum(c["must_haves_ok"] is None for c in cases),
            **{key: sum(c[key] for c in cases) for key in
               ("calls", "model_errors", "model_used", "nondefault_options", "engine_errors")},
        }
    if pairs:
        values = [p["mean_delta"] for p in pairs]
        summary["paired_mean_delta"] = statistics.mean(values)
        summary["paired_median_delta"] = statistics.median(values)
        summary["paired_range"] = [min(values), max(values)]
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(summary, indent=2) + "\n")
    for p in passes:
        print(p["arm"], p["repeat"], round(p["mean_score"], 3), "complete", p["complete"])
    if pairs:
        print("paired mean delta", summary["paired_mean_delta"], "range", summary["paired_range"])
    if duplicates or any(not p["complete"] for p in passes):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
