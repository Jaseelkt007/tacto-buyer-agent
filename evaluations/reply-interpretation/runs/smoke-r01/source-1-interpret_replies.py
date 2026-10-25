"""Interpret saved public reply prefixes. No arena sessions or negotiation actions."""

import argparse
import hashlib
import json
import shutil
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from observe_decisions import read_inputs

from arena_kit.agents.procudeal import reply_interpretation as ri
from arena_kit.cli import load_env

KIT = Path(__file__).resolve().parents[1]


def save(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("inputs", nargs="+", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--case", action="append", default=[], help="case ID; repeat to include multiple cases")
    parser.add_argument("--decision", type=int, action="append", default=[], help="snapshot index; repeatable")
    parser.add_argument("--parallel", type=int, choices=range(1, 5), default=4)
    parser.add_argument("--model", default=ri.MODEL)
    parser.add_argument("--validate-only", action="store_true")
    args = parser.parse_args()
    packets, errors, inputs = read_inputs(args.inputs)
    selected = [r for r in packets if (not args.case or r["packet"]["case_id"] in args.case)
                and (not args.decision or r["packet"]["decision_index"] in args.decision)]
    if not selected:
        parser.error("no snapshots match the selected cases/decisions")
    contexts = []
    for row in selected:
        p = row["packet"]
        sid = p["proposed_action"]["supplier_id"]
        # The completed action chooses a thread to inspect, but never enters model context.
        contexts.append(ri.build_context(p["case"], sid, p["threads"][sid]))
    if args.validate_only:
        print(json.dumps({"snapshots": len(contexts), "capture_errors": errors, "model_calls": 0,
                          "max_context_bytes": max(len(json.dumps(c).encode()) for c in contexts)}))
        return
    if args.out is None or args.out.exists():
        parser.error("--out must name a fresh directory")
    load_env(KIT / ".env")
    args.out.mkdir(parents=True)
    sources = [Path(ri.__file__), Path(__file__), KIT / "arena_kit/agents/procudeal/policy.py",
               KIT / "arena_kit/agents/procudeal/__init__.py"]
    for i, source in enumerate(sources):
        shutil.copyfile(source, args.out / f"source-{i}-{source.name}")
    save(args.out / "manifest.json", {
        "mode": "offline_reply_interpretation", "model": args.model, "prompt": ri.PROMPT,
        "timeout_seconds": ri.TIMEOUT_S, "parallel": args.parallel, "inputs": inputs,
        "source_sha256": {str(s.relative_to(KIT)): hashlib.sha256(s.read_bytes()).hexdigest() for s in sources},
        "capture_errors": errors, "new_negotiation_sessions": 0,
    })

    def one(row):
        p = row["packet"]
        sid = p["proposed_action"]["supplier_id"]
        reader = ri.ReplyInterpreter(model=args.model)
        reader.read(p["case"], sid, p["threads"][sid])
        result = reader.records[0]
        result["source_snapshot_sha256"] = row["sha256"]
        result["decision_index"] = p["decision_index"]
        result["response_schema"] = ri.response_schema(result["context"])
        return result

    rows = []
    with ThreadPoolExecutor(max_workers=args.parallel) as pool:
        for i, row in enumerate(pool.map(one, selected)):
            rows.append(row)
            save(args.out / f"{i:04d}.json", row)
            view = row["reading"]
            print(f"{view['case_id']} decision {row['decision_index']}: {view['status']}; "
                  f"{len(view['observations'])} observations; error={view['error']}", flush=True)
    summary = {
        "snapshots": len(rows), "model_calls": sum(r["model_called"] for r in rows),
        "statuses": dict(Counter(r["reading"]["status"] for r in rows)),
        "errors": dict(Counter(r["reading"]["error"] for r in rows if r["reading"]["error"])),
        "observations": sum(len(r["reading"]["observations"]) for r in rows),
        "changed_buyer_actions": 0, "new_negotiation_sessions": 0,
        "note": "Provenance-checked interpretations; semantic accuracy and score benefit are not established.",
    }
    save(args.out / "summary.json", summary)
    print(json.dumps(summary))
    if summary["statuses"].get("unavailable") or errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
