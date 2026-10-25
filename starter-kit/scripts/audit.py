# ruff: noqa: E501 - the report is markdown tables; their rows read best on one line
"""Rule audit: checks the engine's numbers and rules against what the arena revealed in runs/.

    uv run python scripts/audit.py            # report to notes/analysis/audit.md
    uv run python scripts/audit.py --print    # also print it

Offline: reads runs/, the practice case files (knowledge/practice_cases.json) and the data package.
No arena or model calls. Method and verdicts: docs/findings.md section 10. The checks, by rule type:
  1 our maths on the arena's formula   C_deal lines, C_open, health price
  2 hidden supplier numbers            cost of money (alternative sheets), full cost (relationship charge)
  3 our predictions of its behaviour   its price for other terms (`supplier_value`), the regex signals
  4 filters that hide options          options we never offered
  6 arguments                          the arena's claim results and the supplier's own verdict
"""

import argparse
import itertools
import json
import math
import re
import statistics as st
from collections import Counter, defaultdict
from pathlib import Path

from arena_kit import cost as kc
from arena_kit.agents.procudeal import dossier as dm
from arena_kit.agents.procudeal import economics as eco
from arena_kit.data import DataPackage

KIT = Path(__file__).resolve().parents[1]
ROOT = KIT.parent
OUT = ROOT / "notes" / "analysis" / "audit.md"
CASES = json.loads((KIT / "knowledge" / "practice_cases.json").read_text())

FEEDBACK = re.compile(r"[Ww]e checked the (.+?) you cited[;,:] (.+?)(?:\.|$)", re.M)


def load_runs():
    runs = []
    for path in sorted((ROOT / "runs").glob("*/*.json")):
        try:
            x = json.loads(path.read_text())
        except (OSError, ValueError):
            continue
        if x.get("case_id") not in CASES or not x.get("session"):
            continue
        x["_trace"] = ((x["session"].get("result") or {}).get("trace")) or []
        runs.append(x)
    return runs


def supplier_moves(run):
    return [e for e in run["_trace"] if e.get("actor") != "buyer"]


def buyer_moves(run):
    return [e for e in run["_trace"] if e.get("actor") == "buyer"]


def standards(runs):
    """Its standard terms per (case, supplier): the closed deal's fixed fields + its opening's negotiable
    ones. A negotiable field the opening leaves out comes from its quote PDF, which runs/ does not keep:
    we take the allowed value that reproduces the arena's C_open to the euro (single-supplier cases)."""
    out = {}
    for r in runs:
        res = r.get("result") or {}
        sid, case = res.get("supplier_id"), CASES[r["case_id"]]
        if not res.get("deal") or not sid or (r["case_id"], sid) in out:
            continue
        opening = (r["session"].get("opening") or {}).get(sid, {}).get("terms") or {}
        std = {**res["terms"], **{k: v for k, v in opening.items() if k != "unit_price"}}
        gaps = [
            f
            for f in case["negotiable"]
            if f != "unit_price" and f not in opening and case.get("term_options", {}).get(f)
        ]
        if gaps and len(case.get("suppliers") or []) == 1 and opening.get("unit_price"):
            for combo in itertools.product(*(case["term_options"][f] for f in gaps)):
                trial = {**std, **dict(zip(gaps, combo, strict=True))}
                if abs(kc.total_cost(case, {**trial, "unit_price": opening["unit_price"]}, trial) - res["c_open"]) < 1:
                    std = trial
                    break
            else:
                std["_unfitted"] = gaps
        out[(r["case_id"], sid)] = std
    return out


def pct(x):
    return f"{x * 100:+.1f} %"


# ---------- type 2: hidden supplier numbers ----------
def true_rates(runs, stds):
    """Its cost of money, from alternative sheets that differ from its main sheet only in payment days:
    the exact inverse of the kit's `supplier_value` (`economics.implied_rate`, 360-day basis)."""
    rates = defaultdict(list)
    for r in runs:
        case = CASES[r["case_id"]]
        for e in supplier_moves(r):
            key = (r["case_id"], e["actor"])
            m = e.get("move") or {}
            main = m.get("terms") or {}
            for a in m.get("alternatives") or []:
                alt = a.get("terms") or {}
                std = stds.get(key) or {**case.get("fixed_terms", {}), "payment_days": alt.get("payment_days")}
                rate = eco.implied_rate(case, main, alt, {k: v for k, v in std.items() if not k.startswith("_")})
                if rate is not None and 0 < rate < 0.5:
                    rates[key].append(rate)
    return rates


def back_out_full_cost(case, terms, std, rate, charge):
    """Its full cost from the arena's relationship charge on a deal (inverts `_soft`)."""
    b = case["buyer"]
    years = kc._years(case, kc.closing_terms(case, terms, std))
    k = charge / (b["relationship_eur_per_point"] * years)
    gap = math.sqrt(10 * k) if k <= 2.5 else k + 2.5
    worth = kc.supplier_value(case, terms, {"standard": std, "interest_rate": rate})
    return worth * (1 - (b["sustainable_margin_pct"] - gap) / 100)


def true_full_costs(runs, rates, stds):
    out = defaultdict(list)
    for r in runs:
        res = r.get("result") or {}
        charge = (res.get("cost_breakdown") or {}).get("relationship") or 0
        key = (r["case_id"], res.get("supplier_id"))
        if res.get("deal") and charge > 0 and rates.get(key) and key in stds:
            out[key].append(back_out_full_cost(CASES[key[0]], res["terms"], stds[key], st.median(rates[key]), charge))
    return out


# ---------- our estimates, as the engine builds them ----------
def our_dossier(pkg, key, prices=(), quote=None):
    """The engine's dossier at setup (`quote`: its opening price, used when there is no should-cost),
    then capped by every price in `prices` as the engine does after each offer."""
    case_id, sid = key
    d = dm.build(CASES[case_id], sid, pkg, quote.get("unit_price") if quote else None, rich=True)
    for p in prices:
        d.bound_full_cost(p)
    return d


def prices_seen(runs, key):
    """Every price it offered in these runs (pass one run: the engine caps per case, not across runs)."""
    out = []
    for r in runs:
        if r["case_id"] != key[0]:
            continue
        opening = (r["session"].get("opening") or {}).get(key[1], {}).get("terms") or {}
        out += [opening.get("unit_price")]
        out += [
            (e.get("move") or {}).get("terms", {}).get("unit_price") for e in supplier_moves(r) if e["actor"] == key[1]
        ]
    return [p for p in out if p]


def section_rates(rates, pkg):
    rows = [
        "| case | supplier | owner type | our rule | cash regex | its real rate (pairs) | error |",
        "|---|---|---|---|---|---|---|",
    ]
    for key in sorted(rates):
        v = rates[key]
        try:
            d = our_dossier(pkg, key)
        except Exception as exc:  # demo suppliers have no package rows
            rows.append(
                f"| {key[0][5:]} | {key[1]} | - | - | - | {st.median(v) * 100:.2f} % ({len(v)}) | no dossier ({type(exc).__name__}) |"
            )
            continue
        rows.append(
            f"| {key[0][5:]} | {key[1]} | {d.owner_type or '-'} | {d.interest_rate * 100:.2f} % | {d.cash_need} "
            f"| {st.median(v) * 100:.2f} % ({len(v)}; {min(v) * 100:.2f}-{max(v) * 100:.2f}) | {(d.interest_rate - st.median(v)) * 100:+.2f} pp |"
        )
    return "\n".join(rows)


def section_full_cost(fcs, runs, pkg):
    rows = [
        "| case | supplier | deals | true full cost | should-cost (ours) | after the 99.5 % cap, per run: median (min-max) | floor |",
        "|---|---|---|---|---|---|---|",
    ]
    for key in sorted(fcs):
        v, med = fcs[key], st.median(fcs[key])
        d0 = our_dossier(pkg, key)
        if d0.full_cost is None:
            continue
        pre = d0.full_cost
        capped = [our_dossier(pkg, key, prices_seen([r], key)).full_cost for r in runs if r["case_id"] == key[0]]
        lo, mid, hi = min(capped), st.median(capped), max(capped)
        rows.append(
            f"| {key[0][5:]} | {key[1]} | {len(v)} | {med:.2f} ({min(v):.2f}-{max(v):.2f}) | {pre:.2f} ({pct(pre / med - 1)}) "
            f"| {mid:.2f} ({pct(mid / med - 1)}; {lo:.2f}-{hi:.2f}) | {d0.full_cost_floor} ({pct(d0.full_cost_floor / med - 1)}) |"
        )
    return "\n".join(rows)


# ---------- type 1: our maths ----------
def section_cost_lines(runs, stds):
    diffs, n = defaultdict(float), 0
    for r in runs:
        res = r.get("result") or {}
        key = (r["case_id"], res.get("supplier_id"))
        if not res.get("deal") or key not in stds:
            continue
        ours = kc.cost_breakdown(CASES[key[0]], res["terms"], stds[key])
        n += 1
        for line, val in (res.get("cost_breakdown") or {}).items():
            if line != "relationship":
                diffs[line] = max(diffs[line], abs((ours.get(line) or 0) - val))
    rows = [f"Deals checked: {n}. Largest difference per line, our `cost_breakdown` vs the arena's (EUR):", ""]
    rows += ["| line | max difference |", "|---|---|"] + [f"| {k} | {v:,.2f} |" for k, v in sorted(diffs.items())]
    return "\n".join(rows)


def section_open_and_health(runs, stds, rates, fcs, pkg):
    rows = [
        "| case | supplier | arena C_open | our C_open at setup | difference | health price: ours at setup / after the cap (this run) / true | score lost if it accepted at our setup health price |",
        "|---|---|---|---|---|---|---|",
    ]
    done = set()
    for r in runs:
        res = r.get("result") or {}
        key = (r["case_id"], res.get("supplier_id"))
        case = CASES[key[0]]
        if key in done or not res.get("deal") or key not in stds or len(case.get("suppliers") or []) != 1:
            continue
        done.add(key)
        std = stds[key]
        opening = (r["session"].get("opening") or {}).get(key[1], {}).get("terms") or {}
        quote = {**std, **opening}
        try:
            d0 = our_dossier(pkg, key, quote=opening)
        except Exception:
            continue
        ours_open = eco.cost(case, quote, std, d0.estimate(std, rich=True))
        line = (
            f"| {key[0][5:]} | {key[1]} | {res['c_open']:,.0f} | {ours_open:,.0f} | {ours_open - res['c_open']:+,.0f} |"
        )
        if case["buyer"].get("category_goal") in kc.RELATIONSHIP_GOALS and key in fcs and key in rates:
            mix = {k: v for k, v in res["terms"].items() if k != "unit_price"}
            truth = {"standard": std, "interest_rate": st.median(rates[key]), "full_cost": st.median(fcs[key])}
            d1 = our_dossier(pkg, key, prices_seen([r], key), quote=opening)
            h0 = eco.cheapest_price(case, mix, std, d0.estimate(std, rich=True))
            h1 = eco.cheapest_price(case, mix, std, d1.estimate(std, rich=True))
            ht = eco.cheapest_price(case, mix, std, truth)
            span = res["c_open"] - res["c_best"]
            lost = (eco.cost_at(case, mix, h0, std, truth) - eco.cost_at(case, mix, ht, std, truth)) / span
            line += f" {h0:.2f} / {h1:.2f} / {ht:.2f} | {lost:.3f} |"
        else:
            line += " - | - |"
        rows.append(line)
    rows += [
        "",
        "Health prices on the terms of the closed deal; the score loss is measured with the true full cost and rate.",
    ]
    return "\n".join(rows)


# ---------- type 3: predictions ----------
def section_conversion(runs, stds, rates, pkg):
    """Its alternative sheet's price, predicted from its main sheet by `supplier_value`: with our rule's
    rate and with its true rate. Grouped by the fields the two sheets differ in."""
    errs = defaultdict(lambda: {"rule": [], "true": []})
    cache = {}
    for r in runs:
        for e in supplier_moves(r):
            key = (r["case_id"], e["actor"])
            if key not in stds:
                continue
            if key not in cache:
                try:
                    cache[key] = our_dossier(pkg, key)
                except Exception:
                    cache[key] = None
            d = cache[key]
            m = e.get("move") or {}
            main, case, std = m.get("terms") or {}, CASES[key[0]], stds[key]
            for a in m.get("alternatives") or []:
                alt = a.get("terms") or {}
                if not main.get("unit_price") or not alt.get("unit_price"):
                    continue
                diff = tuple(sorted(k for k in set(main) | set(alt) if k != "unit_price" and main.get(k) != alt.get(k)))
                full_m, full_a = {**std, **main}, {**std, **alt}
                for name, rate in (
                    ("rule", d.interest_rate if d else None),
                    ("true", st.median(rates[key]) if rates.get(key) else None),
                ):
                    if rate is None:
                        continue
                    est = {"standard": std, "interest_rate": rate}
                    pred = eco.price_for_value(case, full_a, est, eco.value(case, full_m, est))
                    if pred:
                        errs[diff][name].append(pred / alt["unit_price"] - 1)
    rows = [
        "| the sheets differ in | pairs | error with our rule's rate: median (min to max) | error with its true rate: median (min to max) |",
        "|---|---|---|---|",
    ]
    for diff, v in sorted(errs.items(), key=lambda x: -len(x[1]["rule"] or x[1]["true"])):
        cell = lambda xs: f"{pct(st.median(xs))} ({pct(min(xs))} to {pct(max(xs))})" if xs else "-"  # noqa: E731
        rows.append(
            f"| {', '.join(diff) or '(price only)'} | {max(len(v['rule']), len(v['true']))} | {cell(v['rule'])} | {cell(v['true'])} |"
        )
    rows += [
        "",
        "Error = predicted / real price of its alternative sheet − 1. Zero means `supplier_value` explains how it prices that difference.",
    ]
    return "\n".join(rows)


def sentences(text):
    """Its sentences with figures masked, so the same line with other numbers counts as one."""
    for s in re.split(r"(?<=[.!?])\s+|\n+", text or ""):
        s = re.sub(r"\d[\d.,]*", "#", s.strip())
        if len(s) > 25:
            yield s


def section_signals(runs, pkg, rates):
    """The regex signals next to what it said and did. A sentence that many suppliers write is a stock
    line of the arena's bots, not a signal about this one."""
    who = defaultdict(set)
    own = defaultdict(Counter)
    for r in runs:
        for e in supplier_moves(r):
            for s in set(sentences((e.get("move") or {}).get("text"))):
                who[s].add(e["actor"])
                own[(r["case_id"], e["actor"])][s] += 1
    stock = {s for s, sids in who.items() if len(sids) >= 4}
    rows = [
        "| case | supplier | regex: cash / work / capacity full / hedged | its real rate | its own lines (not stock) on payment, volume, capacity, hedging |",
        "|---|---|---|---|---|",
    ]
    topic = re.compile(r"payment|cash|liquid|volume|capacit|utili[sz]|hedg|forward", re.I)
    for key in sorted(own):
        try:
            d = our_dossier(pkg, key)
        except Exception:
            continue
        flags = " / ".join(
            "yes" if getattr(d, s) else "no" for s in ("cash_need", "wants_work", "capacity_full", "hedged")
        )
        rate = f"{st.median(rates[key]) * 100:.1f} %" if rates.get(key) else "-"
        lines = [s for s, _ in own[key].most_common() if s not in stock and topic.search(s)][:2]
        rows.append(f"| {key[0][5:]} | {key[1]} | {flags} | {rate} | {' / '.join(x[:110] for x in lines) or '-'} |")
    rows += ["", "Stock lines (written by 4 or more different suppliers), most common first:", ""]
    rows += ["| suppliers | line |", "|---|---|"]
    rows += [f"| {len(who[s])} | {s[:140]} |" for s in sorted(stock, key=lambda s: -len(who[s]))[:15]]
    return "\n".join(rows)


# ---------- type 4: hidden options ----------
def section_options(runs):
    ours, theirs = defaultdict(set), defaultdict(set)
    for r in runs:
        c = r["case_id"]
        for e in buyer_moves(r):
            for s in (e.get("move") or {}).get("term_sheets") or []:
                for k, v in (s.get("terms") or {}).items():
                    ours[(c, k)].add(json.dumps(v, sort_keys=True))
        for e in supplier_moves(r):
            m = e.get("move") or {}
            for t in [m.get("terms") or {}] + [a.get("terms") or {} for a in m.get("alternatives") or []]:
                for k, v in t.items():
                    theirs[(c, k)].add(json.dumps(v, sort_keys=True))
    rows = ["| case | field | allowed options | we never offered | it offered |", "|---|---|---|---|---|"]
    for c in sorted({r["case_id"] for r in runs}):
        case = CASES[c]
        for f in case["negotiable"]:
            if f == "unit_price":
                continue
            allowed = [json.dumps(v, sort_keys=True) for v in case.get("term_options", {}).get(f, [])]
            never = [v for v in allowed if v not in ours[(c, f)]]
            short = lambda vs: ", ".join(_short(v) for v in vs) or "-"  # noqa: E731
            rows.append(f"| {c[5:]} | {f} | {len(allowed)} | {short(never)} | {short(sorted(theirs[(c, f)]))} |")
    return "\n".join(rows)


def _short(v):
    x = json.loads(v)
    if isinstance(x, dict):
        return f"clause db {x.get('deadband_pct')} %"
    return "none" if x is None else str(x)


# ---------- type 6: arguments ----------
def section_claims(runs):
    results, verdict = defaultdict(Counter), defaultdict(Counter)
    for r in runs:
        trace = r["_trace"]
        for i, e in enumerate(trace):
            if e.get("actor") != "buyer":
                continue
            move = e.get("move") or {}
            claims = (move.get("interpreted") or {}).get("claims") or []
            sid = move.get("supplier_id") or e.get("supplier_id")
            reply = next((x for x in trace[i + 1 :] if x.get("actor") == sid), None)
            if not claims or not reply:
                continue
            for cr in (reply.get("move") or {}).get("claim_results") or []:
                idx = cr.get("index")
                if idx is not None and idx < len(claims):
                    results[claims[idx].get("type")][cr.get("result")] += 1
        for e in supplier_moves(r):
            for kind, said in FEEDBACK.findall((e.get("move") or {}).get("text") or ""):
                tag = "moved" if "took it into account" in said or "each holds and we took" in said else "no change"
                verdict[kind.strip()][tag] += 1
    rows = ["Arena check of each claim we sent (by claim type):", "", "| claim type | results |", "|---|---|"]
    rows += [f"| {k} | {dict(v)} |" for k, v in sorted(results.items(), key=lambda x: -sum(x[1].values()))]
    rows += [
        "",
        'Its own verdict in the reply ("we took it into account" vs "it does not change our calculation"):',
        "",
    ]
    rows += ["| data it names | took it into account | no change | share that moved it |", "|---|---|---|---|"]
    for k, v in sorted(verdict.items(), key=lambda x: -sum(x[1].values())):
        tot = v["moved"] + v["no change"]
        if tot >= 3 and k.endswith("data") and len(k) < 40:
            rows.append(f"| {k} | {v['moved']} | {v['no change']} | {v['moved'] / tot:.0%} |")
    return "\n".join(rows)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--print", action="store_true")
    args = ap.parse_args()
    pkg = DataPackage(KIT / "data" / "package")
    runs = load_runs()
    stds = standards(runs)
    rates = true_rates(runs, stds)
    fcs = true_full_costs(runs, rates, stds)
    parts = [
        "# Rule audit",
        "",
        f"Generated by `starter-kit/scripts/audit.py` from {len(runs)} runs. Method: `docs/findings.md` section 10.",
        "",
        "## Type 1: our maths vs the arena",
        "",
        section_cost_lines(runs, stds),
        "",
        "### C_open and the health price",
        "",
        section_open_and_health(runs, stds, rates, fcs, pkg),
        "",
        "## Type 2: hidden supplier numbers",
        "",
        "### Cost of money (from its alternative sheets; exact inverse of the kit formula)",
        "",
        section_rates(rates, pkg),
        "",
        "### Full cost (backed out of the arena's relationship charge, with its real rate)",
        "",
        section_full_cost(fcs, runs, pkg),
        "",
        "## Type 3: our predictions of its behaviour",
        "",
        "### How it prices other terms (`supplier_value`, cash only)",
        "",
        section_conversion(runs, stds, rates, pkg),
        "",
        "### Regex signals vs what it said and did",
        "",
        section_signals(runs, pkg, rates),
        "",
        "## Type 4: options we never offered",
        "",
        section_options(runs),
        "",
        "## Type 6: arguments",
        "",
        section_claims(runs),
        "",
    ]
    text = "\n".join(parts)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text, encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)} ({len(text):,} chars)")
    if args.print:
        print(text)


if __name__ == "__main__":
    main()
