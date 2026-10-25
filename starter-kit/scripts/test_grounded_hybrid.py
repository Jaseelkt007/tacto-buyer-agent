"""Compare hybrid decisions on fixed public replay states. No simulated acceptance or live sessions."""

import argparse
import json
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import audit  # noqa: E402
import replay  # noqa: E402

from arena_kit.agents.procudeal import context, policy, tactician  # noqa: E402
from arena_kit.agents.procudeal import economics as eco  # noqa: E402
from arena_kit.cli import load_env  # noqa: E402
from arena_kit.data import DataPackage  # noqa: E402

ARMS = {"original": "", "sources": "grounded_dossier", "corrected": "grounded_dossier,measured_trades"}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("cases", nargs="+")
    ap.add_argument("--arm", choices=ARMS, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--parallel", type=int, default=3)
    ap.add_argument("--states", type=int, default=2)
    args = ap.parse_args()
    load_env(audit.KIT / ".env")
    policy.FLAGS = policy.parse_off("", ARMS[args.arm])
    pkg = DataPackage(audit.KIT / "data/package")
    runs = audit.load_runs()
    standards = audit.standards(runs)
    jobs = []
    for name in args.cases:
        cid = name if name.startswith("case:") else f"case:{name}"
        run = [r for r in runs if r["case_id"] == cid and r.get("note") == "v1.9"]
        if not run:
            run = [r for r in runs if r["case_id"] == cid and "v1.9" in (r.get("note") or "")]
        if not run:
            raise ValueError(f"no v1.9 replay for {cid}")
        run = run[-1]
        case = audit.CASES[cid]
        if len(case["suppliers"]) != 1:
            raise ValueError("single-supplier replays only")
        sid = case["suppliers"][0]
        std = {k: v for k, v in standards[(cid, sid)].items() if not k.startswith("_")}
        events = replay.to_events(run, sid, std, case)
        ends = [i for i, e in enumerate(events) if e.get("from") != "buyer" and e.get("status") == "open"]
        jobs.extend((case, sid, events[:i + 1]) for i in ends[:args.states])
    args.out.mkdir(parents=True, exist_ok=True)

    def one(job):
        case, sid, events = job
        neg = policy.Negotiator(case, pkg)
        baseline = neg.decide({sid: events})
        packet = context.build(neg, {sid: events}, baseline)
        answer, seconds, error = tactician.ask(packet, cache=False)
        move, check = tactician.to_move(neg, packet, answer, baseline)
        side = neg.sides[sid]

        def cost(candidate):
            sheets = candidate.get("sheets") or []
            if sheets:
                return eco.cost(case, sheets[0], side.standard, side.estimate())
            action = candidate.get("action") or {}
            return packet["accept"].get(action.get("term_sheet_id"))

        row = {"case": case["case_id"], "round": sum(e.get("from") == "buyer" for e in events),
               "arm": args.arm, "answer": answer, "seconds": seconds, "error": error, "check": check,
               "baseline_cost": cost(baseline), "candidate_cost": cost(move),
               "baseline": baseline.get("sheets") or baseline.get("action"),
               "candidate": move.get("sheets") or move.get("action"),
               "available_options": len(packet["options"]), "packet": packet["text"]}
        (args.out / f"{case['case_id'].replace(':', '_')}-{row['round']}.json").write_text(
            json.dumps(row, indent=2, ensure_ascii=False) + "\n")
        print(row["case"], row["round"], check, "options", row["available_options"], flush=True)
        return row

    with ThreadPoolExecutor(max_workers=args.parallel) as pool:
        rows = list(pool.map(one, jobs))
    summary = {"arm": args.arm, "states": len(rows), "errors": sum(bool(r["error"]) for r in rows),
               "changed_terms_or_price": sum(r["baseline"] != r["candidate"] for r in rows),
               "cost_increases": sum(r["candidate_cost"] is not None and r["baseline_cost"] is not None
                                     and r["candidate_cost"] > r["baseline_cost"] + 0.01 for r in rows)}
    (args.out / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary), flush=True)
    if summary["errors"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
