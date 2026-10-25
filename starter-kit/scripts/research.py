"""Zone 0: build the offline knowledge base (supplier dossiers) with Claude Opus 5.5.

    uv run python scripts/research.py --suppliers sup:70110 sup:70510      # a pilot
    uv run python scripts/research.py --all --parallel 4                     # every supplier with documents
    uv run python scripts/research.py --all --force                          # rebuild (e.g. after the release)

The default grounded pipeline writes knowledge/grounded/suppliers/<sup_id>.json and its index.json.
Use --pipeline legacy for the original knowledge/suppliers artifacts. Model answers are cached under
knowledge/.cache, so a rerun pays only
for what changed. Offline only: no arena call, no time limit. See docs/research.md.
"""

import argparse
import hashlib
import json
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from arena_kit.agents.procudeal.dossier import query
from arena_kit.agents.procudeal.research import dossier, grounded, llm
from arena_kit.cli import load_env
from arena_kit.data import DataPackage

KIT = Path(__file__).resolve().parents[1]
OUT = KIT / "knowledge"
log = logging.getLogger("research")


def path_for(sid):
    return OUT / "suppliers" / f"{sid.replace(':', '_')}.json"


def data_version(pkg):
    """A short fingerprint of the facts the dossiers were built from (changes with the Sunday release)."""
    h = hashlib.sha256(json.dumps(pkg.facts, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:12]
    return {"facts": len(pkg.facts), "hash": h, "release": str(pkg.release) if pkg.release else None}


def suppliers_with_documents(pkg):
    found = {
        r["supplier_id"]
        for r in query(pkg, "SELECT DISTINCT supplier_id FROM documents WHERE supplier_id IS NOT NULL ORDER BY 1")
    }
    found.update(f.get("supplier") or f.get("supplier_id") for ref, f in pkg.facts.items()
                 if ref.startswith("doc:") and (f.get("supplier") or f.get("supplier_id")))
    return sorted(found)


def build_playbook(pkg, effort):
    from arena_kit.agents.procudeal.research import lessons, playbook

    cases = json.loads((OUT / "practice_cases.json").read_text(encoding="utf-8"))
    corpus = playbook.practice_corpus(KIT.parent / "runs", cases=cases, package=pkg)
    print(f"playbook: {len(corpus)} practice runs")
    book = lessons.build_playbook(corpus, effort=effort)
    (OUT / "playbook.json").write_text(json.dumps(book, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"playbook: {len(book['general'].get('lessons') or [])} lessons from {len(book['cases'])} cases")


def main():
    global OUT
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--suppliers", nargs="*", default=[], help="supplier IDs, e.g. sup:70110")
    ap.add_argument("--all", action="store_true", help="every supplier with documents in the package")
    ap.add_argument("--parallel", type=int, default=3, help="suppliers built at once (each runs 4 specialists)")
    ap.add_argument("--force", action="store_true", help="rebuild dossiers that exist")
    ap.add_argument("--effort", default=None, help="model effort (default RESEARCH_EFFORT or high)")
    ap.add_argument("--data", default=None, help="data package folder (default ARENA_DATA or data/package)")
    ap.add_argument("--playbook", action="store_true", help="also build knowledge/playbook.json from our practice runs")
    ap.add_argument("--pipeline", choices=["grounded", "legacy"], default="grounded")
    ap.add_argument("--out", type=Path, help="isolated artifact directory for experiments")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()
    OUT = args.out or (KIT / "knowledge" / "grounded" if args.pipeline == "grounded" else KIT / "knowledge")
    if args.playbook and args.pipeline == "grounded":
        ap.error("playbook is not evidence for the grounded pipeline; build it with --pipeline legacy")
    load_env(KIT / ".env")
    logging.basicConfig(level=logging.INFO if args.verbose else logging.WARNING, format="%(asctime)s %(message)s")
    logging.getLogger("research").setLevel(logging.INFO)
    pkg = DataPackage(args.data or os.environ.get("ARENA_DATA") or KIT / "data" / "package")
    sids = suppliers_with_documents(pkg) if args.all else args.suppliers
    if not sids and not args.playbook:
        sys.exit("give --suppliers, --all or --playbook")
    if args.playbook:
        build_playbook(pkg, args.effort)
    todo = [s for s in sids if args.force or (
        grounded.load(pkg, s, OUT) is None if args.pipeline == "grounded" else not path_for(s).is_file()
    )]
    print(f"{len(sids)} suppliers, {len(todo)} to build with {llm.MODEL} (effort {args.effort or llm.EFFORT})")
    (OUT / "suppliers").mkdir(parents=True, exist_ok=True)
    t0, built, failed = time.monotonic(), [], {}

    def one(sid):
        builder = grounded if args.pipeline == "grounded" else dossier
        d = builder.build(pkg, sid, effort=args.effort)
        temporary = path_for(sid).with_suffix(".tmp")
        temporary.write_text(json.dumps(d, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
        temporary.replace(path_for(sid))
        return d

    with ThreadPoolExecutor(max_workers=max(1, args.parallel)) as pool:
        jobs = {pool.submit(one, s): s for s in todo}
        for job in as_completed(jobs):
            sid = jobs[job]
            try:
                d = job.result()
                built.append(sid)
                errs = d["meta"]["errors"]
                print(
                    f"  {sid} {d.get('name') or ''}: {d['meta']['seconds']}s, "
                    f"{len(d.get('observations') or [])} observations, "
                    f"{len(d['validation']['dropped'])} dropped{', errors: ' + ', '.join(errs) if errs else ''}"
                )
            except Exception as e:  # one supplier must not stop the rest
                log.exception("%s failed", sid)
                failed[sid] = repr(e)
                print(f"  {sid} FAILED: {e!r}")

    index_path = OUT / "index.json"
    index = json.loads(index_path.read_text(encoding="utf-8")) if index_path.is_file() else {"suppliers": {}}
    for sid in built:
        d = json.loads(path_for(sid).read_text(encoding="utf-8"))
        index["suppliers"][sid] = {"name": d.get("name"), "file": str(path_for(sid).resolve()), **d["meta"]}
    runs = index.setdefault("runs", [])
    runs.append(
        {
            "when": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "model": llm.MODEL,
            "effort": args.effort or llm.EFFORT,
            "data": data_version(pkg),
            "built": built,
            "failed": failed,
            "seconds": round(time.monotonic() - t0, 1),
            "usage": llm.usage_report(),
        }
    )
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    total = llm.usage_report()["total"]
    print(
        f"done: {len(built)} built, {len(failed)} failed in {time.monotonic() - t0:.0f}s; "
        f"{int(total.get('calls', 0))} model calls, ${total.get('usd', 0):.2f}"
    )
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
