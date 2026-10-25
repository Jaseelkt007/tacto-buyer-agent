"""Post-run inspection of extra sheets. Private economics are used only here, never by the buyer."""

import argparse
import json
from pathlib import Path

from arena_kit.agents.procudeal import economics as eco
from arena_kit.agents.procudeal.reconsideration import SupplierPackage, nonprice, package_terms
from arena_kit.cost import must_haves_ok
from arena_kit.supplier_gym.policy import Profile, SupplierPolicy


def audit(root):
    rows = []
    for folder in sorted(root.glob("pass*-*")):
        if not folder.is_dir():
            continue
        for path in sorted(folder.glob("*-private.json")):
            data = json.loads(path.read_text())
            public = json.loads(path.with_name(path.name.replace("-private", "-public")).read_text())
            case = public["case"]
            for move in data["buyer_trace"]:
                info = move.get("reconsideration") or {}
                if not info.get("used"):
                    continue
                candidate = info["candidate"]["terms"]
                sid, number = move["supplier_id"], move["round"]
                spec = data["profiles"][sid]
                context = {k: case[k] for k in ("parts", "negotiable", "term_options", "fixed_terms")}
                context.update(supplier_id=sid, standard=spec["standard"])
                supplier = SupplierPolicy(context, Profile(**spec["economics"]))
                events = next(s[sid] for s in public["transcript"].values() if sid in s)
                index = [i for i, m in enumerate(events) if m.get("from") == "buyer"][number]
                hint = SupplierPackage(**info["candidate"]["reference"])
                source = package_terms(hint, case, {sid: events[:index]}, spec["standard"])
                estimates = {**data["dossiers"][sid], "standard": spec["standard"]}
                before = eco.cost(case, move["our_sheets"][0], spec["standard"], estimates)
                after = eco.cost(case, candidate, spec["standard"], estimates)
                chosen = [
                    next(x for x in a["actions"] if x["id"] == a["chosen"])
                    for a in data["choices"]
                    if a["supplier_id"] == sid and a["round"] == number + 1
                ]
                rows.append(
                    {
                        "run": folder.name,
                        "case_id": case["case_id"],
                        "round": number,
                        "supplier_id": sid,
                        "terms": candidate,
                        "reference": info["candidate"]["reference"],
                        "on_wire": candidate in [s["terms"] for s in events[index]["term_sheets"]],
                        "package_preserved": nonprice(candidate) == nonprice(source),
                        "must_haves_ok": must_haves_ok(case, candidate, spec["standard"]),
                        "main_cost": before,
                        "alternative_cost": after,
                        "cost_bound_ok": after <= before + 0.01,
                        "private_floor": supplier.floor(candidate),
                        "supplier_feasible": supplier.feasible(candidate),
                        "supplier_accepted": any(a["kind"] == "agree" and a["terms"] == candidate for a in chosen),
                    }
                )
    summary = {
        "alternatives": len(rows),
        "supplier_feasible": sum(r["supplier_feasible"] for r in rows),
        "supplier_accepted": sum(r["supplier_accepted"] for r in rows),
        "verification_failures": [
            r for r in rows if not all(r[k] for k in ("on_wire", "package_preserved", "must_haves_ok", "cost_bound_ok"))
        ],
        "note": "Private floors are post-run diagnostics only; buyer and gate never read them.",
    }
    (root / "alternative-audit.json").write_text(json.dumps({"summary": summary, "rows": rows}, indent=2) + "\n")
    print(json.dumps(summary))
    if summary["verification_failures"]:
        raise SystemExit(1)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("root", type=Path)
    audit(ap.parse_args().root)
