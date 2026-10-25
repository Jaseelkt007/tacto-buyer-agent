"""Rebuild explicit synthetic fixtures. Never infers private economics from buyer dossiers."""

import json
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "scripts/fixtures/supplier_gym"


def spec(cost, *, rate=0.08, fixed=0, credit=0, hedge="2026-12-31", priorities="Seek a profitable repeat order."):
    return {
        "standard": {"payment_days": 60, "contract_months": 12, "volume_per_year": 6000, "index_clause": None},
        "economics": {
            "unit_cost": cost,
            "annual_fixed_cost": fixed,
            "finance_rate": rate,
            "minimum_margin": 0.04,
            "opening_markup": 0.16,
            "capacity": 12000,
            "normal_capacity": 9000,
            "overtime_per_unit": cost * 0.18,
            "commitment_credit": credit,
            "hedge_until": hedge,
            "material_share": 0.5,
            "unhedged_reserve": 0.04,
            "hedged_index_reserve": 0.04,
            "final_round": 5,
            "priorities": priorities,
            "opening_email": (
                "Fictional practice enquiry. Our opening quote is attached; we welcome a package proposal."
            ),
        },
    }


def main():
    template = json.loads((ROOT / "arena_kit/sim_cases/S01.json").read_text())
    release = json.loads((ROOT / "data/release-sunday/facts.json").read_text())
    cash = spec(80, rate=0.30, priorities="Liquidity is tight. Prefer payment in 10 days; trade price for cash.")
    neutral = spec(80, rate=0.03, priorities="Financing is inexpensive. Do not give large discounts for early payment.")
    capacity = spec(11, fixed=18000, priorities="Idle machines need work. Larger firm volumes spread annual costs.")
    hedge = spec(
        12, hedge="2027-12-31", priorities="Steel is fixed through 2027. Avoid indexing already hedged supply."
    )
    noise = spec(2.70, priorities="Recycling publicity has no financial effect on this cable order.")
    distributor = spec(7.5, credit=0.3, priorities="A lost customer leaves room. A two-year commitment has value.")
    foundry = spec(
        78, rate=0.24, credit=3, priorities="Need cash and firm call-offs. Prefer faster payment and two years."
    )
    # IDs and public source links are real. All costs, qualification and bargaining limits below are invented.
    rows = [
        ("L01", "Cash-sensitive casting order", "310050", {"70170": cash}, "cash", 100),
        ("L02", "Casting order financing control", "310050", {"70170": neutral}, "cash_control", 100),
        ("L03", "Machined adapter annual order", "320050", {"70270": capacity}, "capacity", 16),
        ("L04", "Steel bracket supply for 2027", "330020", {"70340": hedge}, "hedge", 17),
        ("L05", "Steel bracket supply for 2028", "330020", {"70340": hedge}, "hedge_expiry", 17),
        ("L06", "Cable annual order", "350040", {"70560": noise}, "noise_control", 3.5),
        ("L07", "Cable annual order", "350040", {"70560": noise}, "noise", 3.5),
        ("L08", "Bearing distribution renewal", "360020", {"70640": distributor}, "commitment", 10),
        ("L09", "Casting competitive enquiry", "310050", {"70170": cash, "70190": foundry}, "rfq", 100),
        ("L10", "Casting alternative-source enquiry", "310050", {"70170": cash, "70190": foundry}, "no_deal", 100),
    ]
    manifest = []
    for cid, title, part, profiles, mechanism, current in rows:
        case = deepcopy(template)
        profiles = {f"sup:{sid}": deepcopy(value) for sid, value in profiles.items()}
        case.update(
            case_id=f"case:{cid}",
            title=title,
            type="rfq" if len(profiles) > 1 else "renewal",
            parts=[f"part:{part}"],
            suppliers=list(profiles),
            briefing="Fictional local practice: obtain an acceptable supply agreement for the stated need.",
            trigger_doc=None,
            refs=[],
            facts={},
        )
        case["fixed_terms"] = {
            "lead_time_days": 42,
            "volume_per_year": 6000,
            "contract_months": 12,
            "index_clause": None,
            "incoterm": "DAP",
            "tooling_eur": 0,
            "effective_date": "2028-01-01" if mechanism == "hedge_expiry" else "2027-01-01",
        }
        case["term_options"] = {"payment_days": [10, 30, 60, 90]}
        case["buyer"].update(
            need_per_year=6000,
            horizon_years=1,
            current_unit_price=current,
            fallback_unit_price=round(current * 1.2, 2),
            index_paths={},
            freight_eur_per_unit={"EXW": 0.5, "FCA": 0.3, "DAP": 0},
            must_haves=[{"field": "lead_time_days", "op": "<=", "value": 42}],
        )
        if mechanism == "capacity":
            case["negotiable"].append("volume_per_year")
            case["term_options"]["volume_per_year"] = [6000, 9000, 15000]
            case["fixed_terms"].pop("volume_per_year")
            case["buyer"]["need_per_year"] = 9000
        if mechanism in ("commitment", "rfq", "no_deal"):
            case["negotiable"].append("contract_months")
            case["term_options"]["contract_months"] = [12, 24]
            case["fixed_terms"].pop("contract_months")
            case["buyer"]["horizon_years"] = 2
        if mechanism in ("hedge", "hedge_expiry"):
            clause = {"series": "PPI-C241", "material_share": 0.5, "deadband_pct": 3.0, "base_month": "2026-09"}
            case["negotiable"].append("index_clause")
            case["term_options"]["index_clause"] = [None, clause]
            case["fixed_terms"].pop("index_clause")
            case["buyer"]["index_paths"] = {"PPI-C241": 0.04}
        for sid, profile in profiles.items():
            relevant = {ref: fact for ref, fact in release.items() if fact.get("supplier") == sid}
            case["facts"].update(relevant)
            case["refs"].extend(relevant)
            if letter := next((ref for ref in relevant if ref.startswith("doc:")), None):
                case["trigger_doc"] = letter
            if mechanism == "noise":
                profile["economics"]["opening_email"] += " Our company recently opened a cable recycling line."
        alternative = {
            **case["fixed_terms"],
            "unit_price": round(current * 1.18, 2),
            "payment_days": 60,
            "volume_per_year": case["buyer"]["need_per_year"],
            "contract_months": int(case["buyer"]["horizon_years"] * 12),
        }
        if mechanism == "no_deal":
            alternative["unit_price"] = 65
        case["buyer"]["alternative"] = {"kind": "other_supplier", "ref": None, "terms": alternative}
        for kind, content in (("public", case), ("private", profiles)):
            path = DEST / kind / f"{cid}.json"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(content, indent=2, ensure_ascii=False) + "\n")
        manifest.append(
            {
                "case_id": case["case_id"],
                "mechanism": mechanism,
                "supplier_count": len(profiles),
                "sources": case["refs"],
                "assumptions": "All economics, enquiry quantities, prices, "
                "buyer alternatives and RFQ supplier qualification are synthetic; not hidden arena facts.",
            }
        )
    (DEST / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {len(manifest)} cases / {sum(r['supplier_count'] for r in manifest)} supplier instances")


if __name__ == "__main__":
    main()
