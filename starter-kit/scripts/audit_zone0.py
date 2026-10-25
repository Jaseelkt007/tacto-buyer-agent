"""Inventory Zone 0; optionally audit interpretations with a model. Never writes live knowledge."""

import argparse
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import httpx

from arena_kit.agents.procudeal.research import source_audit as audit
from arena_kit.cli import load_env
from arena_kit.data import DataPackage

KIT = Path(__file__).resolve().parents[1]


def ask(payload, model, effort):
    user = json.dumps(payload, ensure_ascii=False)
    start = time.monotonic()
    if model.startswith("claude-"):
        from arena_kit.agents.procudeal.research import llm

        answer = llm.ask(audit.SYSTEM, user, audit.SCHEMA, tag="source_audit", model=model,
                         effort=effort, max_tokens=14000)
        usage = llm.usage_report()
    else:
        # Offline-only adapter: no dependency or behavior change to the live model client.
        with httpx.Client(timeout=180) as client:
            response = client.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}"},
                json={"model": model, "instructions": audit.SYSTEM, "input": user,
                      "reasoning": {"effort": effort}, "max_output_tokens": 14000,
                      "store": False,
                      "text": {"format": {"type": "json_schema", "name": "source_audit",
                                          "strict": True, "schema": audit.SCHEMA}}},
            )
        if response.status_code != 200:
            # Provider errors are useful; never log the request headers or key.
            raise RuntimeError(f"provider HTTP {response.status_code}: {response.text[:500]}")
        result = response.json()
        if result.get("status") != "completed":
            details = {k: result.get(k) for k in ("status", "incomplete_details", "usage")}
            raise RuntimeError(f"incomplete model response: {json.dumps(details)}")
        texts = [c["text"] for item in result.get("output", []) for c in item.get("content", [])
                 if c.get("type") == "output_text"]
        if not texts:
            raise RuntimeError("model returned no output text")
        answer, usage = json.loads("".join(texts)), result.get("usage", {})
    return answer, {"seconds": round(time.monotonic() - start, 2), "usage": usage}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--knowledge", type=Path, default=KIT / "knowledge")
    parser.add_argument("--data", type=Path, default=KIT / "data/package")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--suppliers", nargs="*", default=[])
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--model", help="gpt-6.1-sol, gpt-6-luna, or claude-opus-5-5")
    parser.add_argument("--effort", default="low")
    parser.add_argument("--parallel", type=int, default=3)
    parser.add_argument("--calibration", type=Path, help="labelled diagnostic claims; labels never sent to the model")
    args = parser.parse_args()
    if args.model and not (args.all or args.suppliers or args.calibration):
        parser.error("model calls need --suppliers or --all")
    if args.out.resolve().is_relative_to(args.knowledge.resolve()):
        parser.error("output must be outside production knowledge")
    load_env(KIT / ".env")
    if args.calibration:
        if not args.model:
            parser.error("--calibration requires --model")
        fixture = json.loads(args.calibration.read_text())
        payload = {k: v for k, v in fixture.items() if k != "expected"}
        args.out.mkdir(parents=True, exist_ok=True)
        try:
            answer, meta = ask(payload, args.model, args.effort)
        except Exception as exc:
            failure = {"model": args.model, "effort": args.effort, "fixture_hash": audit.digest(fixture),
                       "error": str(exc)}
            (args.out / "calibration-error.json").write_text(json.dumps(failure, indent=2) + "\n")
            raise SystemExit(str(exc)) from exc
        checked = audit.validate(answer, payload)
        actual = {f["claim_id"]: f for f in checked["findings"] if f["provenance_valid"]}
        comparisons = [{"claim_id": cid, "expected": expected,
                        "actual": actual.get(cid, {}).get("verdict"),
                        "pass": actual.get(cid, {}).get("verdict") in expected}
                       for cid, expected in fixture["expected"].items()]
        result = {"model": args.model, "effort": args.effort, "meta": meta, "audit": checked,
                  "comparisons": comparisons, "passed": sum(c["pass"] for c in comparisons),
                  "total": len(comparisons), "fixture_hash": audit.digest(fixture)}
        args.out.mkdir(parents=True, exist_ok=True)
        (args.out / "calibration.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        print(json.dumps({k: result[k] for k in ("model", "passed", "total")}), flush=True)
        if not checked["complete"] or result["passed"] != result["total"]:
            raise SystemExit(1)
        return
    all_dossiers = [json.loads(p.read_text()) for p in sorted((args.knowledge / "suppliers").glob("*.json"))]
    if not all_dossiers:
        parser.error("no dossiers found")
    args.out.mkdir(parents=True, exist_ok=True)
    report = audit.inventory(all_dossiers)
    (args.out / "inventory.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"suppliers": report["suppliers"], **report["totals"]}), flush=True)
    if not args.model:
        return
    selected = [d for d in all_dossiers if args.all or d["supplier_id"] in args.suppliers]
    missing = set(args.suppliers) - {d["supplier_id"] for d in selected}
    if missing:
        parser.error(f"unknown suppliers: {sorted(missing)}")
    pkg = DataPackage(args.data)
    # Resolve SQLite-backed evidence serially; independent model calls can run in parallel.
    payloads = [(d, audit.audit_input(pkg, d)) for d in selected]

    def one(dossier, payload):
        key = audit.digest([audit.SYSTEM, audit.SCHEMA, payload, args.model, args.effort])
        path = args.out / f"{dossier['supplier_id'].replace(':', '_')}-{key[:12]}.json"
        if path.exists():
            existing = json.loads(path.read_text())
            if existing.get("input_hash") == key and existing.get("audit", {}).get("complete"):
                return existing
        answer, meta = ask(payload, args.model, args.effort)
        result = {"supplier_id": dossier["supplier_id"], "input_hash": key,
                  "dossier_hash": audit.digest(dossier), "model": args.model, "effort": args.effort,
                  "meta": meta, "audit": audit.validate(answer, payload), "raw": answer}
        path.with_suffix(".input.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
        path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
        return result

    results, errors = [], {}
    with ThreadPoolExecutor(max_workers=max(1, args.parallel)) as pool:
        jobs = {pool.submit(one, d, p): d["supplier_id"] for d, p in payloads}
        for job in as_completed(jobs):
            sid = jobs[job]
            try:
                result = job.result()
                results.append(result)
                print(sid, result["audit"]["verdict_counts"], "complete", result["audit"]["complete"], flush=True)
            except Exception as exc:
                errors[sid] = str(exc)
                print(sid, type(exc).__name__, str(exc), flush=True)
    summary = {"model": args.model, "suppliers_requested": len(selected), "errors": errors,
               "results": [{k: r[k] for k in ("supplier_id", "input_hash", "meta", "audit")} for r in results]}
    (args.out / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
    if errors or any(not r["audit"]["complete"] for r in results):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
