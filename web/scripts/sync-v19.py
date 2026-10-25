"""Export the original v1.9 suite and Python-built initial dossiers; no arena/model calls.

Run from web: ../starter-kit/.venv/bin/python scripts/sync-v19.py [--check]
"""

import argparse
from collections import Counter
from dataclasses import asdict
import hashlib
import json
import math
from pathlib import Path
import subprocess
import sys
import types

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "starter-kit"))

from arena_kit.data import DataPackage  # noqa: E402

OUT = ROOT / "web/src/data/v19.json"
ARCHIVE = ROOT / "web/src/data/runs.json"
CASES = ("P01", "P02", "P03", "P04", "P05", "P07", "P08", "P10", "P11", "P18")
DOSSIER_COMMIT = "44dbff9"
BASELINES = {f"zone0-v3-baseline-r{i}" for i in range(1, 6)}


def v19_dossier_module():
    """Run the recorded version's builder, independent of ongoing engine development."""
    name = "procudeal_v19_dossier_snapshot"
    source = subprocess.check_output(
        ["git", "show", f"{DOSSIER_COMMIT}:starter-kit/arena_kit/agents/procudeal/dossier.py"],
        cwd=ROOT, text=True,
    )
    module = types.ModuleType(name)
    sys.modules[name] = module
    exec(compile(source, f"git:{DOSSIER_COMMIT}/dossier.py", "exec"), module.__dict__)
    return module


def finite(value):
    if isinstance(value, dict):
        return {k: finite(v) for k, v in value.items()}
    if isinstance(value, list):
        return [finite(v) for v in value]
    return None if isinstance(value, float) and not math.isfinite(value) else value


def terms_rows(terms):
    return [{"label": k.replace("_", " "), "value": json.dumps(v) if isinstance(v, dict) else str(v)}
            for k, v in terms.items() if v is not None]


def export():
    cases = json.loads((ROOT / "starter-kit/knowledge/practice_cases.json").read_text())
    pkg = DataPackage(ROOT / "starter-kit/data/package")
    dm = v19_dossier_module()
    sessions, repeat_scores = [], {}
    original = {}
    for path in sorted((ROOT / "runs").glob("*/*.json")):
        run = json.loads(path.read_text())
        note = run.get("note", "")
        if note == "engine v1.9 (defaults)":
            cid = run["case_id"]
            if cid in original:
                raise ValueError(f"duplicate original v1.9 run: {cid}")
            original[cid] = (path, run)
        if note in BASELINES:
            scores = repeat_scores.setdefault(note, {})
            if run["case_id"] in scores:
                raise ValueError(f"duplicate baseline case: {note} {run['case_id']}")
            scores[run["case_id"]] = run["result"]["score"]
    if set(original) != {f"case:{cid}" for cid in CASES}:
        raise ValueError("the original v1.9 ten-case suite is incomplete")

    for cid in CASES:
        path, run = original[f"case:{cid}"]
        if run["commit"] != DOSSIER_COMMIT:
            raise ValueError(f"unexpected v1.9 source commit in {path}")
        case, result = cases[run["case_id"]], run["result"]
        decisions = run["decisions"]
        if any(d["source"] != "engine" or "hybrid" in d or d.get("plan") for d in decisions):
            raise ValueError(f"non-v1.9 decision in {path}")
        if not result["deal"] or not result["must_haves_ok"]:
            raise ValueError(f"invalid original result: {path}")
        dossiers = []
        for sid in case["suppliers"]:
            quote = run["session"]["opening"][sid]["terms"].get("unit_price")
            d = dm.build(case, sid, pkg, quote, rich=True)
            d.cap_by_quote(quote, case["buyer"].get("sustainable_margin_pct"))
            docs = pkg.query("SELECT id, subject FROM documents WHERE supplier_id = ? ORDER BY date", (sid,))
            dossiers.append({**asdict(d), "documents": docs, "opening_price": quote})
        queues = {sid: iter([d for d in decisions if d["supplier_id"] == sid]) for sid in case["suppliers"]}
        messages = []
        for item in run["session"]["result"]["trace"]:
            move, buyer = item["move"], item["actor"] == "buyer"
            if buyer and move["type"] == "timeout":
                raise ValueError(f"unexpected timeout: {path}")
            sid = move.get("supplier_id") if buyer else item["actor"]
            d = next(queues[sid]) if buyer else None
            terms = [t["terms"] for t in move.get("term_sheets", [])] if buyer else [move.get("terms", {})]
            messages.append({
                "actor": "buyer" if buyer else "supplier", "supplier_id": sid,
                "round": item["round"], "status": move.get("type") if buyer else move.get("status"),
                "body": (move.get("body") if buyer else move.get("text")) or "",
                "price": terms[0].get("unit_price") if terms else None,
                "terms": [terms_rows(t) for t in terms], "refs": move.get("refs", []),
                "checks": [{"result": c["result"], "index": c["index"]} for c in move.get("claim_results", [])],
                "decision": None if d is None else {
                    "round": d["round"], "action": d["action"], "price": d.get("price"),
                    "anchor": d.get("anchor"), "ceiling": d.get("ceiling"),
                    "cost": d.get("c_main"), "limit": d.get("limit"),
                    "claims": d.get("claims", []), "why": d.get("why", ""),
                    "trade": d.get("trade"), "source": d["source"], "seconds": d["seconds"],
                },
            })
        for q in queues.values():
            if next(q, None) is not None:
                raise ValueError(f"unmatched decision in {path}")
        sessions.append({
            "id": run["session_id"], "case_id": cid, "title": case["title"], "type": case["type"],
            "goal": case["buyer"]["category_goal"], "need": case["buyer"].get("need_per_year"),
            "round_limit": case["round_limit"], "negotiable": case["negotiable"],
            "source_file": str(path.relative_to(ROOT)), "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "commit": run["commit"], "when": run["when"], "seconds": run["seconds"],
            "engine_seconds": sum(d["seconds"] for d in decisions), "decision_count": len(decisions),
            "dossiers": dossiers, "messages": messages,
            "result": {"score": result["score"] * 100, "opening_cost": result["c_open"],
                       "deal_cost": result["c_deal"], "unit_price": result["terms"]["unit_price"],
                       "supplier_id": result["supplier_id"], "must_haves_ok": result["must_haves_ok"],
                       "terms": terms_rows(result["terms"]), "rounds": run["session"]["rounds"]},
        })
    repeats = []
    for name, scores in sorted(repeat_scores.items()):
        if set(scores) != {f"case:{cid}" for cid in CASES}:
            raise ValueError(f"incomplete baseline repeat: {name}")
        repeats.append({"name": name, "mean": sum(scores.values()) / len(scores) * 100})
    sources = Counter(m["decision"]["source"] for s in sessions for m in s["messages"] if m["decision"])
    return finite({
        "version": "v1.9", "dossier_commit": DOSSIER_COMMIT,
        "dossier_scope": "Data-package estimate after opening-quote cap; before observed quote-rate updates.",
        "benchmark": {"mean": sum(s["result"]["score"] for s in sessions) / len(sessions),
                      "cases": len(sessions), "deals": len(sessions), "engine_decisions": sources["engine"],
                      "llm_decisions": sources["kit-llm"], "repeats": repeats},
        "sessions": sessions,
    })


def archive_with_originals(sessions):
    """Keep historical runs and ensure links from the canonical demo resolve to real traces."""
    archive = json.loads(ARCHIVE.read_text())
    by_id = {r["session_id"]: r for r in archive["runs"]}
    for session in sessions:
        run = json.loads((ROOT / session["source_file"]).read_text())
        s = run["session"]
        trace, result = s["result"]["trace"], {k: v for k, v in s["result"].items() if k != "trace"}
        by_id[session["id"]] = {
            "file": session["source_file"], "case_id": run["case_id"], "agent": run["agent"],
            "note": run["note"], "commit": run["commit"], "when": run["when"],
            "seconds": run["seconds"], "session_id": session["id"], "replay_url": s.get("replay_url"),
            "end_reason": s.get("end_reason"), "rounds": s.get("rounds"), "result": result,
            "trace": trace, "decisions": run["decisions"], "backoffice": run.get("backoffice", []),
        }
    archive["runs"] = sorted(by_id.values(), key=lambda r: (r["case_id"], r["when"]))
    return finite(archive)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()
    snapshot = export()
    payload = json.dumps(snapshot, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    archive = archive_with_originals(snapshot["sessions"])
    if args.check:
        if not OUT.exists() or OUT.read_text() != payload:
            sys.exit("v1.9 snapshot differs; run npm run sync:v19")
        if json.loads(ARCHIVE.read_text()) != archive:
            sys.exit("canonical archive traces differ; run npm run sync:v19")
        print("v1.9 snapshot matches the ten original runs and Python dossier builder")
    else:
        OUT.write_text(payload)
        ARCHIVE.write_text(json.dumps(archive, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n")
        print(f"Exported original v1.9 suite to {OUT.relative_to(ROOT)}")
