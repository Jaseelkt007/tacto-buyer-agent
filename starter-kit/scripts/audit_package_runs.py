"""Post-run wire and supplier-choice audit; private economics never reach the buyer."""

import argparse
import json
from collections import Counter
from pathlib import Path

from arena_kit.agents.procudeal.reconsideration import SupplierPackage, nonprice, package_terms
from arena_kit.cost import must_haves_ok, total_cost
from arena_kit.supplier_gym.chooser import ReferenceChooser
from arena_kit.supplier_gym.sim import GymSim


def audit(root):
    counts, interventions, failures, probes = Counter(), [], [], []
    for folder in sorted(root.glob("pass*-*")):
        if not folder.is_dir() or not (folder / "results.json").exists():
            continue
        for path in sorted(folder.glob("*-private.json")):
            private = json.loads(path.read_text())
            public = json.loads(path.with_name(path.name.replace("-private", "-public")).read_text())
            case = public["case"]
            sim = GymSim(case, private["profiles"], ReferenceChooser())
            threads = next(iter(public["transcript"].values()))
            for choice in private["choices"]:
                chosen = next(a for a in choice["actions"] if a["id"] == choice["chosen"])
                counts["choices"] += 1
                counts[choice["mode"]] += 1
                counts[f"chosen_{chosen['kind']}"] += 1
                feasible_bids = [a for a in choice["actions"] if a["kind"] == "agree"]
                counts["had_feasible_buyer_bid"] += bool(feasible_bids)
                counts["declined_feasible_buyer_bid"] += bool(feasible_bids) and chosen["kind"] != "agree"
                if chosen["terms"] and not sim.policies[choice["supplier_id"]].feasible(chosen["terms"]):
                    failures.append([str(path), "infeasible supplier choice"])
            for sid, supplier in sim.policies.items():
                previous_terms = None
                for message in threads[sid]:
                    if message.get("from") == "buyer" or not message.get("term_sheets"):
                        continue
                    terms = supplier.complete(message["term_sheets"][0]["terms"])
                    if (
                        previous_terms
                        and message.get("status") != "agreed"
                        and nonprice(terms) == nonprice(previous_terms)
                        and terms["unit_price"] > previous_terms["unit_price"]
                    ):
                        counts["supplier_raised_price_on_same_package"] += 1
                    previous_terms = terms
                opening = supplier.opening()
                cheap = {**opening, "unit_price": 0.01}
                rich = {**opening, "unit_price": round(opening["unit_price"] * 2, 2)}
                low = supplier.menu(1, opening, [cheap])
                high = supplier.menu(1, opening, [rich])
                def counter(actions):
                    return [a.terms for a in actions if a.kind in {"counter", "final"}]
                probes.append(
                    {
                        "run": folder.name,
                        "case": case["case_id"],
                        "supplier": sid,
                        "below_floor_bid_can_be_accepted": any(a.kind == "agree" for a in low),
                        "high_feasible_bid_can_be_accepted": any(a.kind == "agree" for a in high),
                        "counter_menu_unchanged_when_buyer_price_changes": counter(low) == counter(high),
                        "early_walk_available": any(a.kind == "walk" for a in low),
                    }
                )
            for trace in private["buyer_trace"]:
                info = trace.get("persistent_package")
                if not info or not info.get("used"):
                    continue
                sid, terms = trace["supplier_id"], trace["our_sheets"][0]
                messages = threads[sid]
                buyers = [(i, m) for i, m in enumerate(messages) if m.get("from") == "buyer"]
                index, published = buyers[trace["round"]]
                prefix = messages[:index]
                standard = sim.policies[sid].standard
                source = package_terms(SupplierPackage(**info["reference"]), case, {sid: prefix}, standard)
                checks = {
                    "wire_matches": [s["terms"] for s in published["term_sheets"]] == trace["our_sheets"],
                    "package_preserved": nonprice(terms) == nonprice(source),
                    "must_haves_ok": must_haves_ok(case, terms, standard),
                    "cost_below_limit": total_cost(case, terms, standard) < info["cost_limit"],
                    "cost_matches": abs(total_cost(case, terms, standard) - info["estimated_cost"]) < 0.01,
                }
                following = next((m for m in messages[index + 1 :] if m.get("from") != "buyer"), {})
                accepted = following.get("status") == "agreed" and any(
                    s["terms"] == terms for s in following.get("term_sheets", [])
                )
                entry = {
                    "run": folder.name,
                    "case": case["case_id"],
                    "round": trace["round"],
                    "terms": terms,
                    "source": source,
                    "checks": checks,
                    "supplier_financial_floor": sim.policies[sid].floor(terms),
                    "supplier_feasible": sim.policies[sid].feasible(terms),
                    "supplier_accepted_exact_package": accepted,
                    "next_supplier_status": following.get("status"),
                    "cost_increase_over_original_bid": round(
                        info["estimated_cost"] - total_cost(case, info["original_sheets"][0], standard), 2
                    ),
                }
                interventions.append(entry)
                if not all(checks.values()):
                    failures.append(entry)
    result = {
        "supplier_choices": dict(counts),
        "interventions": interventions,
        "failures": failures,
        "supplier_menu_probes": probes,
        "limits": "Price menus follow a round schedule; no early walk; prose is templated; no health scoring.",
    }
    (root / "supplier-and-wire-audit.json").write_text(json.dumps(result, indent=2) + "\n")
    print(
        json.dumps(
            {
                "supplier_choices": dict(counts),
                "interventions": len(interventions),
                "accepted_interventions": sum(i["supplier_accepted_exact_package"] for i in interventions),
                "failures": len(failures),
                "probes": len(probes),
            }
        )
    )
    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path)
    audit(parser.parse_args().root)
