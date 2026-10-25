"""Reconcile saved local supplier runs and write a readable, explicitly synthetic report."""

import argparse
import json
from pathlib import Path

from arena_kit.cost import must_haves_ok, total_cost
from arena_kit.supplier_gym.chooser import ReferenceChooser
from arena_kit.supplier_gym.sim import GymSim


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("run", type=Path)
    args = ap.parse_args()
    manifest = json.loads((args.run / "manifest.json").read_text())
    rows = json.loads((args.run / "results.json").read_text())
    infeasible, mismatches, score_mismatches, fallbacks, calls = [], [], [], 0, 0
    table, wave_table, diagnostics = [], [], []
    for row in rows:
        name = row["case_id"].split(":")[1]
        public = json.loads((args.run / f"{name}-public.json").read_text())
        private = json.loads((args.run / f"{name}-private.json").read_text())
        sim = GymSim(public["case"], private["profiles"], ReferenceChooser())
        transcripts = next(iter(public["transcript"].values()), {})
        for supplier, messages in transcripts.items():
            for message in messages:
                if message.get("from") == "buyer":
                    continue
                for sheet in message.get("term_sheets", []):
                    if not sim.policies[supplier].feasible(sheet["terms"]):
                        infeasible.append([name, supplier, sheet["term_sheet_id"]])
        for attempt in private["choices"]:
            calls += attempt["mode"] in ("llm", "fallback")
            fallbacks += attempt["mode"] == "fallback"
            selected = next(a for a in attempt["actions"] if a["id"] == attempt["chosen"])
            if selected["kind"] == "walk":
                continue
            messages = transcripts[attempt["supplier_id"]]
            offer = f"offer:{attempt['supplier_id'].split(':')[1]}-{attempt['round']}"
            matching = [
                s["terms"]
                for m in messages
                if m.get("from") != "buyer"
                for s in m.get("term_sheets", [])
                if s["term_sheet_id"] == offer
            ]
            if not matching or any(terms != selected["terms"] for terms in matching):
                mismatches.append([name, offer])
        result = row.get("result", {})
        terms = result.get("terms") or {}
        gap = row.get("missed_savings_eur")
        if manifest.get("timed_rehearsal") and result:
            case = public["case"]
            opening = min(
                total_cost(case, p.opening(), p.standard)
                for p in sim.policies.values()
                if must_haves_ok(case, p.opening(), p.standard)
            )
            best = sim.benchmark(case)[0]
            alternative = case["buyer"].get("alternative", {}).get("terms", {})
            alt_cost = total_cost(case, alternative) if alternative.get("unit_price") else None
            if alt_cost is not None:
                best = min(best, alt_cost)
            realized = total_cost(case, terms) if result["deal"] else alt_cost
            expected = 0.0
            if realized is not None and (not result["deal"] or must_haves_ok(case, terms)):
                expected = (
                    min(1, max(0, (opening - realized) / (opening - best)))
                    if opening - best > 0.01
                    else float(realized <= best + 0.01)
                )
            if abs(result["score"] - expected) > 1e-9 or result["c_best"] != best:
                score_mismatches.append(name)
            baseline = min(opening, alt_cost) if alt_cost is not None else opening
            baseline_score = (
                min(1, max(0, (opening - baseline) / (opening - best)))
                if opening - best > 0.01
                else float(baseline <= best + 0.01)
            )
            diagnostics.append(
                {
                    "case_id": row["case_id"],
                    "score": result["score"],
                    "opening_baseline_cost": baseline,
                    "opening_baseline_score": baseline_score,
                    "realized_cost": realized,
                    "improvement_over_opening_baseline_eur": round(baseline - realized, 2)
                    if realized is not None
                    else None,
                    "deal_no_worse_than_alternative": (realized <= alt_cost + 0.01)
                    if result["deal"] and alt_cost is not None
                    else None,
                    "terms": terms,
                    "supplier_id": result.get("supplier_id"),
                }
            )
            wave_table.append(
                f"| {name} | {result['score'] * 100:.1f} | {row['finished_seconds']:.1f} | {row['end_reason']} |"
            )
        table.append(
            f"| {name} | {'deal' if result.get('deal') else row['status'] if row['status'] != 'completed' else 'walk'} "
            f"| {result.get('supplier_id') or '—'} | {terms.get('payment_days', '—')} "
            f"| {terms.get('contract_months', '—')} | {'yes' if terms.get('index_clause') else 'no'} "
            f"| {gap:,.2f} | {row['supplier_fallbacks']} |"
            if gap is not None
            else f"| {name} | failed | — | — | — | — | — | {row['supplier_fallbacks']} |"
        )
    reconciliation = {
        "requested": len(manifest["requested"]),
        "recorded": len(rows),
        "completed": sum(r["status"] == "completed" for r in rows),
        "failed": sum(r["status"] != "completed" for r in rows),
        "unstarted": len(manifest["requested"]) - len(rows),
        "model_calls": calls,
        "model_fallbacks": fallbacks,
        "infeasible_published_offers": infeasible,
        "selected_vs_published_mismatches": mismatches,
        "score_mismatches": score_mismatches,
    }
    (args.run / "reconciliation.json").write_text(json.dumps(reconciliation, indent=2) + "\n")
    pairs = []
    suite_manifest = args.run / "suite/manifest.json"
    metadata = json.loads(suite_manifest.read_text()) if suite_manifest.is_file() else {}
    for a, b in metadata.get("pairs", []) if isinstance(metadata, dict) else []:
        left = next((d for d in diagnostics if d["case_id"] == f"case:{a}"), None)
        right = next((d for d in diagnostics if d["case_id"] == f"case:{b}"), None)
        pairs.append(
            {
                "cases": [a, b],
                "both_completed": left is not None and right is not None,
                "cost_difference_eur": round(left["realized_cost"] - right["realized_cost"], 2)
                if left and right and left["realized_cost"] is not None and right["realized_cost"] is not None
                else None,
                "same_contract_terms": left["terms"] == right["terms"] if left and right else None,
            }
        )
    (args.run / "diagnostics.json").write_text(
        json.dumps(
            {"completed_case_diagnostics": diagnostics, "pairs": pairs, "failed_cases": reconciliation["failed"]},
            indent=2,
        )
        + "\n"
    )
    text = [
        "# Local supplier run",
        "",
        f"Mode: {manifest['mode']}; model: {manifest['model'] or 'none'}.",
        "",
        "This is a synthetic test under invented supplier economics. The benchmark gap is against",
        "the best financially feasible package or the buyer's alternative, not a prediction of",
        "savings obtainable from real suppliers or of a leaderboard score.",
        "",
        "| Case | Outcome | Supplier | Payment days | Months | Indexed | Benchmark gap EUR | Fallbacks |",
        "|---|---|---|---:|---:|---|---:|---:|",
        *table,
        "",
        "Reconciliation:",
        "",
        "```json",
        json.dumps(reconciliation, indent=2),
        "```",
        "",
        "The saved public transcripts were rechecked against private financial limits. Every",
        "published counteroffer was also compared with the recorded model/reference selection.",
        "",
        "Limitations: one pass, invented economics, fixed action menus and templated supplier prose;",
        "no relationship-health scoring, semantic claim grading or hosted arena calls.",
        "",
    ]
    if manifest.get("timed_rehearsal"):
        summary = json.loads((args.run / "summary.json").read_text())
        text += [
            "## One timed wave",
            "",
            f"Synthetic wave score: **{summary['synthetic_wave_score']:.1f}/100**.",
            "",
            "| Case | Score / 100 | Finished after wave start (seconds) | End reason |",
            "|---|---:|---:|---|",
            *wave_table,
            "",
            "```json",
            json.dumps(summary, indent=2),
            "```",
            "",
            "Scores were recomputed from the recorded terms, independent supplier profiles and",
            "the published buyer-cost formula. This run tests one local wave, not transitions",
            "between multiple waves. In-process HTTP does not reproduce hosted-service or venue-network latency.",
            "",
        ]
        if summary.get("completion_mode") == "when_done":
            text += [
                "Quick completion was selected; thread deadlines and the wave cap remained active.",
                "The wave closed early after all cases ended. Full-cap waiting was not tested."
                if summary.get("closed_early")
                else "The wave did not close early. Inspect case errors, cap closures and elapsed time.",
                "",
            ]
        text += [
            "## Negotiation beyond the opening baseline",
            "",
            "The static baseline takes the cheapest acceptable opening or alternative and does not negotiate.",
            "The following table contains completed cases only. Failed cases remain in the overall wave denominator.",
            "",
            "| Case | Baseline score / 100 | Achieved score / 100 | Improvement over baseline EUR |",
            "|---|---:|---:|---:|",
        ]
        for d in diagnostics:
            gain = d["improvement_over_opening_baseline_eur"]
            gain_text = f"{gain:,.2f}" if gain is not None else "unavailable"
            text.append(
                f"| {d['case_id']} | {d['opening_baseline_score'] * 100:.1f} | {d['score'] * 100:.1f} | {gain_text} |"
            )
        if pairs:
            text += [
                "",
                "## Matched controls",
                "",
                "```json",
                json.dumps(pairs, indent=2),
                "```",
                "",
                "A difference in one stochastic pair is diagnostic, not proof of identity or ordering bias.",
                "Compare the same frozen configuration over the preregistered repetitions.",
                "",
            ]
    else:
        text += ["No timed wave was exercised in this individual-case run.", ""]
    (args.run / "report.md").write_text("\n".join(text))
    print(json.dumps(reconciliation))
    if infeasible or mismatches or score_mismatches or reconciliation["failed"] or reconciliation["unstarted"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
