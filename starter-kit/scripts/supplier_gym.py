"""Run individual local negotiations. No hosted arena or timed rehearsal calls."""

import argparse
import hashlib
import json
import logging
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path

from arena_kit.agents.procudeal import ProcuDealAgent, policy
from arena_kit.agents.procudeal.dossier import build
from arena_kit.cli import load_env
from arena_kit.data import DataPackage
from arena_kit.play import RemoteTable, play
from arena_kit.supplier_gym.chooser import LLMChooser, ReferenceChooser
from arena_kit.supplier_gym.sim import GymSim

KIT = Path(__file__).resolve().parents[1]
FIXTURES = KIT / "scripts/fixtures/supplier_gym"


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False, allow_nan=False) + "\n")


def no_buyer_model(*args, **kwargs):
    raise RuntimeError("v1.9 buyer unexpectedly requested a fallback model")


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("cases", nargs="*", help="L01 ... L10; default all ten")
    ap.add_argument("--mode", choices=["llm", "reference"], default="llm")
    ap.add_argument("--model", default="gpt-6.1-sol")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()
    if args.out.exists():
        ap.error("output directory already exists; choose a new run directory to preserve its evidence")
    names = args.cases or [p.stem for p in sorted((FIXTURES / "public").glob("*.json"))]
    if len(set(names)) != len(names) or any(not (FIXTURES / "public" / f"{n}.json").is_file() for n in names):
        ap.error("use distinct case names L01 through L10")
    load_env(KIT / ".env")
    policy.FLAGS = policy.parse_off("", "")
    package = DataPackage(KIT / "data/package")
    if package.release is None:
        ap.error("Sunday release missing; this suite is intended to test release ingestion")
    logging.getLogger("arena").setLevel(logging.ERROR)
    args.out.mkdir(parents=True)
    rows = []
    source_files = [*sorted((KIT / "arena_kit/supplier_gym").glob("*.py")), Path(__file__)]
    source_hashes = {str(p.relative_to(KIT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in source_files}
    save(
        args.out / "manifest.json",
        {
            "started": datetime.now(UTC).isoformat(),
            "requested": names,
            "mode": args.mode,
            "model": args.model if args.mode == "llm" else None,
            "buyer": "v1.9 defaults",
            "features": policy.FLAGS,
            "release": str(package.release),
            "timed_rehearsal": False,
            "source_sha256": source_hashes,
        },
    )
    for name in names:
        case_path, profile_path = FIXTURES / "public" / f"{name}.json", FIXTURES / "private" / f"{name}.json"
        case, profiles = json.loads(case_path.read_text()), json.loads(profile_path.read_text())
        chooser = LLMChooser(args.model) if args.mode == "llm" else ReferenceChooser()
        gym = GymSim(case, profiles, chooser, package.facts)
        buyer = ProcuDealAgent(no_buyer_model, package)
        row = {"case_id": case["case_id"], "status": "failed", "error": None}
        print(f"{name}: starting {len(profiles)} supplier(s), {args.mode}", flush=True)
        try:
            with gym.local_client() as client:
                result = play(RemoteTable(client), case["case_id"], buyer)
            row.update(status="completed", result=result)
            outcome_cost = result["c_deal"] if result["deal"] else result["c_alt"]
            best_costs = [n for n in (result["c_best"], result["c_alt"]) if n is not None]
            row["missed_savings_eur"] = round(outcome_cost - min(best_costs), 2) if outcome_cost is not None else None
            row["supplier_financially_feasible"] = (
                gym.policies[result["supplier_id"]].feasible(result["terms"]) if result["deal"] else None
            )
        except Exception as exc:
            row["error"] = f"{type(exc).__name__}: {exc}"
        row["supplier_model_calls"] = sum(a["mode"] in ("llm", "fallback") for a in gym.audit)
        row["supplier_fallbacks"] = sum(a["mode"] == "fallback" for a in gym.audit)
        row["buyer_fallbacks"] = sum(t["source"] != "engine" for t in buyer.trace)
        row["supplier_threads_contacted"] = sorted({a["supplier_id"] for a in gym.audit})
        row["all_model_choices_succeeded"] = (
            args.mode == "llm" and row["supplier_model_calls"] > 0 and not row["supplier_fallbacks"]
        )
        rows.append(row)
        save(args.out / f"{name}-public.json", {"case": case, "transcript": gym.public_transcript()})
        save(
            args.out / f"{name}-private.json",
            {
                "evaluation": row,
                "profiles": profiles,
                "choices": gym.audit,
                "buyer_trace": buyer.trace,
                "dossiers": {sid: asdict(build(case, sid, package, rich=True)) for sid in profiles},
                "case_sha256": hashlib.sha256(case_path.read_bytes()).hexdigest(),
                "profile_sha256": hashlib.sha256(profile_path.read_bytes()).hexdigest(),
            },
        )
        save(args.out / "results.json", rows)
        print(
            f"{name}: {row['status']}, deal={row.get('result', {}).get('deal')}, "
            f"model calls={row['supplier_model_calls']}, fallbacks={row['supplier_fallbacks']}, "
            f"missed savings={row.get('missed_savings_eur')}, error={row['error']}",
            flush=True,
        )
    summary = {
        "requested": len(names),
        "completed": sum(r["status"] == "completed" for r in rows),
        "failed": sum(r["status"] != "completed" for r in rows),
        "unstarted": len(names) - len(rows),
        "model_calls": sum(r["supplier_model_calls"] for r in rows),
        "model_fallbacks": sum(r["supplier_fallbacks"] for r in rows),
        "buyer_fallbacks": sum(r["buyer_fallbacks"] for r in rows),
        "deals": sum(r.get("result", {}).get("deal", False) for r in rows),
        "failed_must_haves": sum(r.get("result", {}).get("must_haves_ok") is False for r in rows),
        "note": "Synthetic functional test. No leaderboard prediction or timed-rehearsal validation.",
    }
    save(args.out / "summary.json", summary)
    print(json.dumps(summary), flush=True)
    if summary["failed"] or summary["model_fallbacks"] or summary["buyer_fallbacks"] or summary["failed_must_haves"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
