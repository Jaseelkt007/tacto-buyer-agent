"""Export deterministic dossier snapshots for suppliers mentioned in the additive release.

No arena or model calls. Actual case parts, opening quotes and observed payment trades are
applied by the live engine; these snapshots only show the available source-stage estimates.
"""

import argparse
import json
import os
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path

from arena_kit.agents.procudeal.dossier import build, query
from arena_kit.cli import load_env
from arena_kit.data import DataPackage

KIT = Path(__file__).resolve().parents[1]


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", help="base package directory; release is detected alongside it")
    ap.add_argument("--out", type=Path, default=KIT / "knowledge/deterministic/release.json")
    args = ap.parse_args()
    load_env(KIT / ".env")
    pkg = DataPackage(args.data or os.environ.get("ARENA_DATA") or KIT / "data/package")
    if pkg.release is None:
        ap.error("no additive release found alongside the package")
    release = json.loads((pkg.release / "facts.json").read_text())
    suppliers = sorted({f.get("supplier") or f.get("supplier_id") for f in release.values()
                        if f.get("supplier") or f.get("supplier_id")})
    rows = []
    for sid in suppliers:
        parts = sorted({r["part_id"] for r in query(pkg, "SELECT part_id FROM sourcing WHERE supplier_id = ?", (sid,))})
        for part in parts or [None]:
            d = build({"parts": [part] if part else []}, sid, pkg, rich=True)
            rows.append({"part_id": part, "release_sources_read": sorted(set(d.source_ids) & release.keys()),
                         "dossier": asdict(d)})
    result = {"built": datetime.now(UTC).isoformat(), "release": str(pkg.release),
              "scope": "Source-stage supplier/part snapshots, not hidden final cases. No opening quote supplied.",
              "financing": "Rule-based prior; v1.9 replaces it when comparable payment quotes reveal a rate.",
              "global_release_ids": sorted(ref for ref, f in release.items()
                                           if not (f.get("supplier") or f.get("supplier_id"))),
              "suppliers": suppliers, "dossiers": rows}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {len(rows)} supplier/part dossiers for {len(suppliers)} suppliers to {args.out}")
    for sid in suppliers:
        d = next(r["dossier"] for r in rows if r["dossier"]["supplier_id"] == sid)
        print(sid, d["name"], {k: d[k] for k in ("cash_need", "wants_work", "capacity_full", "hedged")})


if __name__ == "__main__":
    main()
