"""Construct and seal Wave 02 without running a buyer, reading scores or calling a model."""

import argparse
import hashlib
import json
from copy import deepcopy
from pathlib import Path

from build_supplier_gym import spec

KIT = Path(__file__).resolve().parents[1]
DEFAULT = KIT.parent / "evaluations/supplier-generalization/wave-02"

PROTOCOL = """# Wave 02 protocol

Status: prospective authored stress suite. No buyer negotiation was run during construction.
This suite was designed after observing Wave 01, so it is not an independently sampled benchmark.

Freeze the v1.9 buyer and this suite before the first run. Run five complete repetitions if making
a robustness claim. Retain every failed case and model fallback. Use fresh output directories.
Do not change financial profiles, supplier prompts or the buyer between those repetitions.

G04/G05 change only opaque case/supplier IDs. Both suppliers are synthetic and have no package
history. G08/G09 change only the case ID and RFQ supplier ordering. These are paired controls,
not independent cases. Report total-cost and term differences across repetitions, not a pass/fail
judgment from one stochastic pair.

Primary outcomes: must-have compliance, cost versus the stated alternative, model/buyer errors,
and financial feasibility. Secondary outcomes: normalized synthetic score, absolute gap to the
private financial oracle, improvement over the cheapest acceptable opening/alternative baseline,
and sensitivity in the two paired controls. The oracle is not guaranteed to be offered by the LLM.

Several suppliers retain a positive final counteroffer margin. Concession pace and patience vary.
Private commitment penalties can reverse the usual benefit of a longer contract. All private
economics and newly created enquiries are hypothetical. Real source IDs are provenance for the
historical context, not evidence for the invented financial values or future opening emails.

This suite covers leverage cases only. It does not test supplier-health scoring, unrestricted
supplier prose, semantic claim verification, simultaneous payment-quote inference, hosted service
latency or multi-wave transitions. Quick completion does not validate waiting through eight minutes.

Detailed rationale and paper language: ../methodology.md. Any buyer tuning after these runs makes
this a development suite. Build a new suite before claiming fresh validation of the tuned buyer.
"""


def profile(cost, *, rate=0.08, fixed=0, final=0.04, power=0.7, rounds=4, **kwargs):
    out = spec(cost, rate=rate, fixed=fixed, **kwargs)
    out["economics"].update(
        final_markup=final, concession_power=power, final_round=rounds, commitment_penalty=0, opening_markup=0.22
    )
    return out


def construct():
    template = json.loads((KIT / "arena_kit/sim_cases/S01.json").read_text())
    release = json.loads((KIT / "data/release-sunday/facts.json").read_text())

    def case(number, part, profiles, *, need, current, months=12, date="2027-01-01"):
        c = deepcopy(template)
        c.update(
            case_id=f"case:G{number:02}",
            title="Supply enquiry",
            type="rfq" if len(profiles) > 1 else "renewal",
            briefing="Fictional evaluation enquiry. Negotiate supply for the stated need and conditions.",
            parts=[f"part:{part}"],
            suppliers=list(profiles),
            facts={},
            refs=[],
            trigger_doc=None,
        )
        c["fixed_terms"] = {
            "lead_time_days": 35,
            "volume_per_year": need,
            "contract_months": months,
            "index_clause": None,
            "incoterm": "DAP",
            "tooling_eur": 0,
            "effective_date": date,
        }
        c["negotiable"] = ["unit_price", "payment_days"]
        c["term_options"] = {"payment_days": [10, 30, 60, 90]}
        c["buyer"].update(
            need_per_year=need,
            horizon_years=months / 12,
            current_unit_price=current,
            fallback_unit_price=round(current * 1.12, 2),
            need_lead_time_days=35,
            freight_eur_per_unit={"EXW": 0.6, "FCA": 0.35, "DAP": 0},
            index_paths={},
            must_haves=[{"field": "lead_time_days", "op": "<=", "value": 60}],
        )
        for sid, p in profiles.items():
            p["standard"].update(volume_per_year=need, contract_months=months)
            p["economics"]["opening_email"] = "Fictional evaluation quote. " + p["economics"]["opening_email"]
            c["facts"].update({ref: fact for ref, fact in release.items() if fact.get("supplier") == sid})
        c["refs"] = sorted(c["facts"])
        return c, profiles

    def option(c, field, values):
        c["negotiable"].append(field)
        c["fixed_terms"].pop(field, None)
        c["term_options"][field] = values

    entries, mechanisms = [], []

    def add(c, p, mechanism, expectation):
        entries.append((c, p))
        mechanisms.append({"case_id": c["case_id"], "mechanism": mechanism, "expectation": expectation})

    p = profile(
        13.4,
        rate=0.06,
        final=0.06,
        power=0.45,
        rounds=3,
        priorities="The current production window is full. Do not exchange a discount for impossible volume.",
    )
    p["economics"].update(
        capacity=4800,
        normal_capacity=4000,
        overtime_per_unit=7.5,
        opening_email="Historical short-time work is over. Only 4,800 units fit this window.",
    )
    c, ps = case(1, "320050", {"sup:70270": p}, need=4000, current=17)
    option(c, "volume_per_year", [3000, 4000, 6000])
    add(c, ps, "capacity reversal", "A 6,000-unit proposal cannot be accepted; current capacity overrides old news.")

    p = profile(
        12.1,
        fixed=14000,
        rate=0.07,
        final=0.025,
        power=1.7,
        rounds=6,
        priorities="A larger lot spreads setup cost, but do not claim the buyer needs the surplus.",
    )
    p["economics"].update(
        normal_capacity=11000, opening_email="Unit prices fall with lot size; all ordered units bind."
    )
    c, ps = case(2, "320050", {"sup:70270": p}, need=5000, current=18)
    option(c, "volume_per_year", [5000, 8000, 11000])
    add(c, ps, "overbuying", "Lower unit price for excess volume need not mean lower buyer total cost.")

    p = profile(
        74,
        rate=0.045,
        final=0.07,
        power=0.6,
        rounds=3,
        priorities="Long fixed-price commitments expose us to energy risk; they require a surcharge.",
    )
    p["economics"].update(
        commitment_penalty=28, opening_email="Twelve months can be fixed. Longer commitments need an exposure premium."
    )
    c, ps = case(3, "310011", {"sup:70190": p}, need=4200, current=88, months=24)
    ps["sup:70190"]["standard"]["contract_months"] = 12
    option(c, "contract_months", [6, 12, 24])
    add(c, ps, "commitment reversal", "Evaluate the long-term premium against shorter coverage plus fallback buying.")

    p = profile(
        16.8,
        rate=0.18,
        final=0.05,
        power=0.8,
        rounds=5,
        priorities="Seek a profitable order. Earlier settlement has a real but finite financing benefit.",
    )
    p["standard"]["payment_days"] = 45
    p["economics"]["opening_email"] = "We can discuss complete packages; settlement timing affects price."
    c, ps = case(4, "320050", {"sup:99041": p}, need=3500, current=22)
    c["term_options"]["payment_days"] = [15, 45, 75]
    add(c, ps, "identity control A", "Compare with G05 across repeated runs; economics and available history match.")
    twin = deepcopy(c)
    twin.update(case_id="case:G05", suppliers=["sup:99051"])
    add(twin, {"sup:99051": deepcopy(p)}, "identity control B", "Only case and supplier IDs differ from G04.")

    p = profile(
        12.6,
        rate=0.055,
        final=0.045,
        power=0.6,
        rounds=4,
        hedge="2027-12-31",
        priorities="Only the first six delivery months are hedged; price the remaining material exposure.",
    )
    p["economics"].update(
        material_share=0.6,
        unhedged_reserve=0.16,
        opening_email="Fixed material inventory covers six months of this two-year enquiry.",
    )
    c, ps = case(6, "330020", {"sup:70340": p}, need=7400, current=17.5, months=24, date="2027-07-01")
    clause = {"series": "PPI-C241", "material_share": 0.6, "deadband_pct": 3.0, "base_month": "2026-09"}
    option(c, "index_clause", [None, clause])
    c["buyer"]["index_paths"] = {"PPI-C241": 0.02}
    add(c, ps, "partial hedge", "A blanket hedged flag loses the distinction between covered and uncovered deliveries.")

    p = profile(
        13.0,
        rate=0.065,
        final=0.035,
        power=1.3,
        rounds=5,
        priorities="An indexed quote transfers material exposure. The buyer must evaluate its own index path.",
    )
    p["economics"].update(
        material_share=0.6,
        unhedged_reserve=0.025,
        opening_email="An indexed headline price can be lower; the clause still adjusts invoices.",
    )
    c, ps = case(7, "330030", {"sup:70340": p}, need=5200, current=18, date="2028-01-01")
    option(c, "index_clause", [None, deepcopy(clause)])
    c["buyer"]["index_paths"] = {"PPI-C241": 0.18}
    add(c, ps, "index total-cost trap", "A lower indexed quote can cost more under the disclosed upward index path.")

    cheap = profile(
        62,
        rate=0.08,
        final=0.04,
        power=0.5,
        rounds=4,
        priorities="Offer low prices with our standard 56-day lead time; do not promise faster delivery.",
    )
    dear = profile(
        67,
        rate=0.055,
        final=0.03,
        power=1.2,
        rounds=5,
        priorities="Our 28-day lead time has value. Negotiate the whole package.",
    )
    cheap["standard"]["lead_time_days"], dear["standard"]["lead_time_days"] = 56, 28
    cheap["economics"]["opening_email"] = "Our quote includes our standard lead time. Please read the attachment."
    dear["economics"]["opening_email"] = "Our quote includes our standard lead time. Please read the attachment."
    c, ps = case(8, "310050", {"sup:70170": cheap, "sup:70190": dear}, need=3200, current=90)
    c["fixed_terms"].pop("lead_time_days")
    c["buyer"]["late_cost_per_day"] = 3000
    add(
        c,
        ps,
        "RFQ total cost and order A",
        "Compare full cost with supplier-specific PDF standards, not headline price.",
    )
    twin = deepcopy(c)
    twin.update(case_id="case:G09", suppliers=list(reversed(c["suppliers"])))
    add(twin, deepcopy(ps), "RFQ order B", "Only case ID and supplier ordering differ from G08.")

    p = profile(
        9.2,
        rate=0.12,
        final=0.08,
        power=0.4,
        rounds=3,
        priorities="Maintain a firm final quote; accept a feasible buyer proposal if it is commercially sensible.",
    )
    p["economics"].update(
        minimum_margin=0.06,
        opening_email="We have limited price flexibility. Please propose a commercially complete package.",
    )
    c, ps = case(10, "360020", {"sup:70640": p}, need=4000, current=10.5)
    add(
        c,
        ps,
        "narrow agreement corridor",
        "Close only below the credible alternative or walk away; deal rate alone is not success.",
    )

    for c, _ps in entries:
        b = c["buyer"]
        alternative = {
            **c["fixed_terms"],
            "unit_price": round(b["current_unit_price"] * 1.08, 2),
            "payment_days": 60,
            "volume_per_year": b["need_per_year"],
            "contract_months": round(b["horizon_years"] * 12),
            "lead_time_days": 35,
            "index_clause": None,
        }
        if c["case_id"] == "case:G10":
            alternative["unit_price"] = 10.4
        c["buyer"]["alternative"] = {"kind": "other_supplier", "ref": None, "terms": alternative}
    return entries, mechanisms


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, default=DEFAULT)
    args = ap.parse_args()
    entries, mechanisms = construct()
    files = {"protocol.md": PROTOCOL}
    for case, profiles in entries:
        name = case["case_id"].split(":")[1]
        for kind, value in (("public", case), ("private", profiles)):
            files[f"{kind}/{name}.json"] = json.dumps(value, indent=2, ensure_ascii=False) + "\n"
    manifest = {
        "suite_id": "wave-02",
        "design": "authored prospective stress test after Wave 01",
        "buyer_evaluations_at_construction": 0,
        "synthetic_finances": True,
        "generator_sha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        "cases": mechanisms,
        "pairs": [["G04", "G05"], ["G08", "G09"]],
        "hypotheses_hidden_from_buyer": True,
    }
    files["manifest.json"] = json.dumps(manifest, indent=2) + "\n"
    seal = {
        "algorithm": "sha256",
        "files": {name: hashlib.sha256(text.encode()).hexdigest() for name, text in sorted(files.items())},
    }
    files["seal.json"] = json.dumps(seal, indent=2) + "\n"
    for name, text in files.items():
        path = args.out / name
        if path.exists() and path.read_text() != text:
            raise SystemExit(f"Refusing to change frozen suite file {path}. Use a new suite directory/version.")
    for name, text in files.items():
        path = args.out / name
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists():
            path.write_text(text)
    print(f"Sealed {len(entries)} cases / {sum(len(p) for _, p in entries)} supplier instances at {args.out}")
    print("No buyer negotiation or model call was run.")


if __name__ == "__main__":
    main()
