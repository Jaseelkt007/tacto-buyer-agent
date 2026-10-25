# ruff: noqa: E501 - the report is markdown tables; their rows read best on one line
"""Offline replay: what would the engine (or a flag set) do at every recorded state of a past run?

    uv run python scripts/replay.py P02                       # latest procudeal run of P02, v1.7c vs v1.8
    uv run python scripts/replay.py P02 P01 P03 --runs all    # every unique run
    uv run python scripts/replay.py P02 --arm v1.8=quote_cap,measured_rate,health_refresh

A recorded run becomes the events the live API sends (its e-mails, terms, alternative sheets, claim
results; the quote PDF's standard section rebuilt from what the run shows). A fresh agent decides at
each state after a supplier e-mail, as on a resume. No arena or model calls, no sessions.

Scoring uses the supplier's true full cost and rate backed out by scripts/audit.py. They are for
evaluation only and never reach the engine. "If accepted" is the score of our sheet if the supplier
took it at once - an upper bound, not a prediction; whether it would take it is unknown offline.
Report: notes/analysis/replay-<cases>.md. Single-supplier cases only (RFQ threads are serialised).
"""

import argparse
import logging
import statistics as st
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import audit  # noqa: E402 - the audit's run loader and ground truth

from arena_kit.agents.procudeal import ProcuDealAgent  # noqa: E402
from arena_kit.agents.procudeal import economics as eco  # noqa: E402
from arena_kit.agents.procudeal import policy as po  # noqa: E402
from arena_kit.data import DataPackage  # noqa: E402
from arena_kit.docs import LABELS  # noqa: E402
from arena_kit.play import ENDED  # noqa: E402

FIELD_LABEL = {v: k for k, v in LABELS.items()}
V18 = "quote_cap,measured_rate,health_refresh"


def _fmt(field, v):
    if field == "index_clause":
        if not v:
            return "none"
        return f"{v['series']}, {round(v['material_share'] * 100)}% material, deadband {v['deadband_pct']} %, base {v['base_month']}"
    if field in ("unit_price", "tooling_eur", "chargeback_eur_per_complaint"):
        return f"{float(v):.2f}"
    return str(v)


def quote_pdf(case, opening, std):
    """The quote PDF's text in the arena's layout, from the opening terms and the recovered standard terms."""
    lines = ["Offered terms"]
    lines += [f"{FIELD_LABEL[f]} {_fmt(f, v)}" for f, v in {**std, **opening}.items() if f in FIELD_LABEL]
    lines += ["Our standard terms"]
    lines += [f"{FIELD_LABEL[f]} {_fmt(f, v)}" for f, v in std.items() if f in FIELD_LABEL and f != "unit_price"]
    lines += ["Terms fixed by your enquiry"]
    lines += [f"{FIELD_LABEL[f]} {_fmt(f, v)}" for f, v in case.get("fixed_terms", {}).items() if f in FIELD_LABEL]
    return "\n".join(lines)


def to_events(run, sid, std, case):
    """The run's trace as the live API's thread: supplier e-mails with their sheets, ours with ours."""
    events, first = [], True
    for e in run["_trace"]:
        m = e.get("move") or {}
        if e.get("actor") == "buyer":
            if (m.get("supplier_id") or sid) != sid:
                continue
            events.append(
                {
                    "from": "buyer",
                    "body": m.get("body") or "",
                    "term_sheets": m.get("term_sheets") or [],
                    "refs": m.get("refs") or [],
                    "type": m.get("type"),
                }
            )
            continue
        if e.get("actor") != sid:
            continue
        sheets = [{"term_sheet_id": m.get("offer_id"), "terms": m.get("terms") or {}}]
        sheets += [
            {"term_sheet_id": a.get("offer_id"), "terms": a.get("terms") or {}} for a in m.get("alternatives") or []
        ]
        msg = {
            "from": sid,
            "status": m.get("status"),
            "body": m.get("text") or "",
            "term_sheets": sheets,
            "claim_results": m.get("claim_results") or [],
            "signals": m.get("signals") or {},
            "attachments": [],
        }
        if first:
            msg["attachments"] = [{"name": "quote.pdf", "text": quote_pdf(case, m.get("terms") or {}, std)}]
            first = False
        events.append(msg)
    return events


def set_flags(spec):
    """'' = the defaults (v1.7c); otherwise the defaults plus these names on."""
    po.FLAGS = po.parse_off("", spec)


def decide(case, events, sid, package):
    agent = ProcuDealAgent(complete=None, package=package)
    decision = agent.decide(case, {sid: events})
    side = agent.negotiator.sides.get(sid)
    msg = decision.get("message") or {}
    action = (msg.get("action") or {}).get("type") or "offer"
    sheet = ((msg.get("term_sheets") or [{}])[0].get("terms")) or {}
    accepted = (msg.get("action") or {}).get("term_sheet_id")
    info = {
        "action": action,
        "sheet": sheet,
        "accepted": accepted,
        "health": round(side.best_for_us, 2) if side and side.best_for_us else None,
        "full_cost": side.dossier.full_cost if side else None,
        "rate": round(side.dossier.interest_rate, 4) if side else None,
        "source": agent.trace[-1].get("source") if agent.trace else None,
    }
    return info


def score_of(case, terms, std, truth, res):
    """The arena's score of this sheet if it closed. Above 1 = beyond C_best, i.e. a price below anything
    this supplier would ever accept (C_best is the best deal it would take), shown as ">1"."""
    if not terms or terms.get("unit_price") is None:
        return None
    span = res["c_open"] - res["c_best"]
    s = (res["c_open"] - eco.cost(case, {**std, **terms}, std, truth)) / span
    return ">1" if s > 1.0005 else round(s, 3)


def sheet_by_id(events, sheet_id):
    for m in events:
        for ts in m.get("term_sheets") or []:
            if ts.get("term_sheet_id") == sheet_id:
                return ts.get("terms") or {}
    return {}


def brief(terms, keys):
    p = terms.get("unit_price")
    extra = [f"{k[:3]} {_short(terms[k])}" for k in keys if k in terms and k != "unit_price"]
    return (f"{p:.2f}" if p is not None else "-") + (f" ({', '.join(extra)})" if extra else "")


def _short(v):
    if isinstance(v, dict):
        return f"clause db {v.get('deadband_pct')}"
    return "none" if v is None else str(v)


def menu_table(case, state, sid, package, spec, std, truth, res, top=12):
    """The priced menu the engine's own estimate gives at this state (H1.3), each option scored with
    the true numbers (evaluation only): at its health price and at its cash-equal price."""
    set_flags(spec)
    agent = ProcuDealAgent(complete=None, package=package)
    agent.decide(case, {sid: state})
    side = agent.negotiator.sides[sid]
    est = side.estimate()
    band = (side.dossier.full_cost_floor, side.dossier.full_cost) if side.dossier.full_cost else None
    standing = (state[-1]["term_sheets"][0]["terms"]) if state[-1].get("term_sheets") else {}
    rows = eco.menu(case, eco.complete_offer(case, standing), side.standard, est, band=band)
    out = [
        f"Menu at this state ({len(rows)} options; engine estimate: full cost {side.dossier.full_cost}, band {band}, rate {side.dossier.interest_rate:.4f}):",
        "",
        "| terms | cash-equal price → score if accepted | health price (range) → score if accepted |",
        "|---|---|---|",
    ]
    for r in rows[:top]:
        terms = ", ".join(f"{k[:3]} {_short(v)}" for k, v in r["terms"].items() if k in case["negotiable"])
        eq = (
            f"{r['equal_value_price']} → {score_of(case, {**r['terms'], 'unit_price': r['equal_value_price']}, std, truth, res)}"
            if r["equal_value_price"]
            else "-"
        )
        hp = "-"
        if r.get("health_price"):
            rng = r.get("health_range")
            hp = (
                f"{r['health_price']}"
                + (f" ({rng[0]}-{rng[1]})" if rng else "")
                + f" → {score_of(case, {**r['terms'], 'unit_price': r['health_price']}, std, truth, res)}"
            )
        out.append(f"| {terms} | {eq} | {hp} |")
    return "\n".join(out)


def replay_run(run, arms, package, stds, rates, fcs, with_menu=False):
    case = audit.CASES[run["case_id"]]
    sids = list((run["session"].get("opening") or {}).keys())
    if len(sids) != 1:
        return None
    sid = sids[0]
    key = (run["case_id"], sid)
    if key not in stds:
        return None
    std = {k: v for k, v in stds[key].items() if not k.startswith("_")}
    res = run["result"]
    truth = {
        "standard": std,
        "interest_rate": st.median(rates[key]) if rates.get(key) else 0.08,
        "full_cost": st.median(fcs[key]) if fcs.get(key) else None,
    }
    if truth["full_cost"] is None:
        truth = None
    events = to_events(run, sid, std, case)
    keys = [f for f in case["negotiable"]]
    rows = []
    for i, m in enumerate(events):
        if m["from"] == "buyer" or m.get("status") in ENDED:
            continue  # the engine is only asked while the thread is open
        state = events[: i + 1]
        nxt = next((x for x in events[i + 1 :] if x["from"] == "buyer"), None)
        rec = ((nxt or {}).get("term_sheets") or [{}])[0].get("terms") if nxt and nxt.get("term_sheets") else None
        if nxt is None:
            rec_txt, rec_score = (res.get("close") or {}).get("type") or ("accept" if res.get("deal") else "end"), None
            if res.get("deal"):
                rec_score = score_of(case, res["terms"], std, truth, res)
        else:
            rec_txt, rec_score = brief(rec or {}, keys), score_of(case, rec or {}, std, truth, res)
        cells = [
            f"{m['term_sheets'][0]['terms'].get('unit_price')}"
            + (f" +{len(m['term_sheets']) - 1} alt" if len(m["term_sheets"]) > 1 else "")
            + f" [{m.get('status')}]",
            f"{rec_txt} → {rec_score}",
        ]
        for _name, spec in arms:
            set_flags(spec)
            d = decide(case, state, sid, package)
            if d["action"] == "accept":
                acc = sheet_by_id(state, d["accepted"])
                txt = f"accept {brief(acc, keys)} → {score_of(case, acc, std, truth, res)}"
            elif d["action"] == "walk_away":
                txt = "walk away"
            else:
                txt = f"{brief(d['sheet'], keys)} → {score_of(case, d['sheet'], std, truth, res)}"
            cells.append(
                f"{txt}; health {d['health']}, fc {d['full_cost']}, rate {d['rate']}"
                + ("" if d["source"] == "engine" else f" [{d['source']}]")
            )
        rows.append(f"| {sum(1 for x in state if x['from'] == 'buyer')} | " + " | ".join(cells) + " |")
    head = f"### {run['case_id'][5:]} · {run.get('note')} · {Path(run['_path']).name if run.get('_path') else ''} · arena score {res.get('score', 0):.3f}"
    cols = (
        "| round | its sheet | we sent → score if accepted | "
        + " | ".join(f"{n}: our move → score if accepted" for n, _ in arms)
        + " |"
    )
    sep = "|---|---|---|" + "---|" * len(arms)
    note = ""
    if truth:
        note = (
            f"True (evaluation only): full cost {truth['full_cost']:.2f}, rate {truth['interest_rate'] * 100:.2f} %. "
        )
    parts = [head, "", note + "Scores use the arena's C_open and C_best of the run.", "", cols, sep, *rows]
    if with_menu:
        first = next(i for i, m in enumerate(events) if m["from"] != "buyer")
        parts += ["", menu_table(case, events[: first + 1], sid, package, arms[-1][1], std, truth, res)]
    return "\n".join(parts)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cases", nargs="+")
    ap.add_argument("--runs", choices=["latest", "all"], default="latest")
    ap.add_argument("--arm", action="append", default=[], help="name=flag,flag (on top of the defaults)")
    ap.add_argument("--note", default="v1.7c", help="only runs whose note contains this (default v1.7c; '' = any)")
    ap.add_argument("--menu", action="store_true", help="also the priced menu at the opening state (last arm)")
    ap.add_argument("--print", action="store_true")
    args = ap.parse_args()
    logging.basicConfig(level=logging.WARNING)
    arms = [("v1.7c", "")] + ([tuple(a.split("=", 1)) for a in args.arm] or [("v1.8", V18)])
    package = DataPackage(audit.KIT / "data" / "package")
    runs = audit.load_runs()
    stds = audit.standards(runs)
    rates = audit.true_rates(runs, stds)
    fcs = audit.true_full_costs(runs, rates, stds)
    out = []
    for c in args.cases:
        cid = c if c.startswith("case:") else f"case:{c}"
        mine = [
            r
            for r in runs
            if r["case_id"] == cid
            and r.get("agent") == "procudeal"
            and (r.get("result") or {}).get("c_open")
            and args.note in (r.get("note") or "")
            and "plan" not in (r.get("note") or "")
        ]
        if args.runs == "latest":
            mine = mine[-1:]
        else:  # one per distinct path of our prices
            seen, uniq = set(), []
            for r in mine:
                path = tuple(
                    round(
                        ((e.get("move") or {}).get("term_sheets") or [{}])[0].get("terms", {}).get("unit_price") or 0, 2
                    )
                    for e in r["_trace"]
                    if e.get("actor") == "buyer"
                )
                if path not in seen:
                    seen.add(path)
                    uniq.append(r)
            mine = uniq
        for r in mine:
            text = replay_run(r, arms, package, stds, rates, fcs, with_menu=args.menu)
            if text:
                out.append(text)
    set_flags("")
    report = (
        "# Offline replay\n\nGenerated by `starter-kit/scripts/replay.py`. Arms: "
        + ", ".join(f"{n} = defaults{' + ' + s if s else ''}" for n, s in arms)
        + ".\n\n"
        + "\n\n".join(out)
        + "\n"
    )
    path = audit.ROOT / "notes" / "analysis" / f"replay-{'-'.join(c.replace('case:', '') for c in args.cases)}.md"
    path.write_text(report, encoding="utf-8")
    print(f"{path.relative_to(audit.ROOT)} ({len(report):,} chars)")
    if args.print:
        print(report)


if __name__ == "__main__":
    main()
