# ruff: noqa: E501 - packet lines are prose the model reads; they read best unwrapped
"""Hybrid context (v2.0 phase 2): one labelled packet per thread for the judgment call.

The modules stay code and become the model's eyes and calculator; every item says where it comes
from, so the model can tell a fact from an estimate (docs/findings.md sections 9-10):
  A  arena: the case file and the published cost formula - exact
  D  data: a record in the data package, with its ID - exact (should-cost has a +-5 % band)
  E  our estimate: value, range and how we got it
  S  the supplier: what it wrote or sent in this session - its claim, not a fact
  Z  our offline model's reading of its records (zone 0) - an interpretation, each with its IDs
Never in a packet: our tuned constants, our claim ranking and the regex signals (R), and anything
the arena shows only after a case ends (back office, the supplier's reasons). The rule engine's own
move is one labelled option: the model keeps it or picks another option code has priced.

`build(neg, threads, move)` -> {"text": what the model reads, "options": {id: {"terms", "rungs"}},
"claims": {id: Claim}, "accept": {sheet_id: C}, "sid": ...}; the ids are what code validates.
"""

import json
import re
from pathlib import Path

from ...cost import RELATIONSHIP_GOALS, complete_offer, cost_breakdown
from ...play import latest, moves_left, standing
from . import economics as eco
from . import signals as sg

KNOWLEDGE = Path(__file__).resolve().parents[3] / "knowledge"
TOP_OPTIONS = 6  # menu options shown besides the engine's mix and its own
FEEDBACK = re.compile(r"[Ww]e checked the (.+?) you cited[;,:] (.+?)(?:\.|$)", re.M)
VERDICT_KIND = {  # the arena's wording in a reply -> our claim kind
    "rival quote data": "rival_offer",
    "volume change data": "volume_change",
    "index change data": "index_change",
    "delivery record data": "delivery_record",
    "delivery scorecard data": "delivery_record",
    "should cost data": "should_cost",
    "price history data": "order_history",
    "quality record data": "quality_record",
    "quality data": "quality_record",
    "notice period data": "notice_period",
}


def _load(name):
    try:
        return json.loads((KNOWLEDGE / name).read_text())
    except (OSError, ValueError):
        return None


STOCK = {s for s in (_load("stock_lines.json") or {}).get("lines", [])}


def dossier(sid):
    """Zone 0 dossier of a supplier, or None (a supplier the offline run never saw)."""
    return _load(f"suppliers/{sid.replace(':', '_')}.json")


def eur(x):
    return f"€{x:,.2f}" if x is not None else "-"


def big(x):
    return f"€{x:,.0f}"


def terms_text(case, terms):
    out = []
    for f in case["negotiable"]:
        if f == "unit_price" or f not in terms:
            continue
        v = terms[f]
        if f == "index_clause":
            out.append(
                f"clause {v['series']} {round(v['material_share'] * 100)} % db {v['deadband_pct']:g} %"
                if v
                else "no clause"
            )
        elif f == "payment_days":
            out.append(f"pay {v} d")
        elif f == "contract_months":
            out.append(f"{v} months")
        elif f == "volume_per_year":
            out.append(f"vol {v:,}")
        elif f == "lead_time_days":
            out.append(f"lead {v} d")
        else:
            out.append(f"{f} {v}")
    return ", ".join(out)


def mask(sentence):
    return re.sub(r"\d[\d.,]*", "#", sentence.strip())


def marked_text(body):
    """Its e-mail, each stock line (one the arena's bots write to everyone) prefixed with '~'."""
    lines = []
    for s in re.split(r"(?<=[.!?])\s+|\n+", body or ""):
        s = s.strip()
        if s:
            lines.append(("~ " if mask(s) in STOCK else "") + s)
    return " ".join(lines)


def verdicts(body):
    """Its verdict per claim kind in one reply: {our kind: "moved" | "no change"} (live, from its e-mail)."""
    out = {}
    for kind, said in FEEDBACK.findall(body or ""):
        k = VERDICT_KIND.get(kind.strip())
        if k:
            out[k] = "moved" if "took it into account" in said or "took them into account" in said else "no change"
    return out


def its_drivers(events):
    """The cost drivers it states in its e-mails (latest statement per series) - S items."""
    out = {}
    for m in events:
        if m.get("from") != "buyer":
            out.update({d.series: d for d in sg.drivers(m)})
    return out


def protection(terms, drivers):
    """E: what an index clause on these terms is worth to it, as a share of the price - the protection
    beyond the deadband on the exposure it states itself (`economics.clause_value_rate`)."""
    clause = (terms or {}).get("index_clause")
    d = drivers.get(clause["series"]) if clause else None
    return eco.clause_value_rate(clause, d) if d else 0.0


def worth(case, terms, price, est, drivers):
    """E: what a sheet is worth to it per unit: its cash value plus the clause's protection on the
    exposure it states (the engine's other per-sheet extras are left out, so nothing counts twice)."""
    plain = {k: v for k, v in est.items() if k != "extras"}
    return eco.value(case, {**terms, "unit_price": price}, plain) * (1 + protection(terms, drivers))


# ---------- sections ----------
def case_lines(neg, side):
    case, b = neg.case, neg.case["buyer"]
    alt = b.get("alternative") or {}
    at = alt.get("terms") or {}
    lines = [
        f"[A] {case['case_id']} · {case.get('type')} · goal {b.get('category_goal')} · parts {', '.join(case.get('parts', []))}"
        f" · need {b['need_per_year']:,}/yr · horizon {b['horizon_years']:g} yr · today's price {eur(b.get('current_unit_price'))}",
        f"[A] Score: the lower our total cost C, the better. C_open (the best opening quote) = {big(neg.c_open)}."
        + (
            f" No deal = our alternative ({alt.get('ref')}: {eur(at.get('unit_price'))}, {at.get('payment_days')} d payment, lead {at.get('lead_time_days')} d), C = {big(eco.alternative_cost(case))}."
            if at.get("unit_price")
            else " No deal and no alternative scores 0."
        ),
        f"[A] Our cost of money {b.get('interest_rate', 0.08) * 100:g} %/yr; reference payment {b.get('reference_payment_days')} d;"
        f" lead time we need {b.get('need_lead_time_days')} d; must-haves: {', '.join(map(str, b.get('must_haves') or [])) or 'none'}.",
    ]
    if b.get("category_goal") in RELATIONSHIP_GOALS and b.get("relationship_eur_per_point"):
        lines.append(
            f"[A] Relationship charge: C rises {big(b['relationship_eur_per_point'])} per margin point (per year) the deal leaves it below"
            f" {b['sustainable_margin_pct']:g} % margin (quadratic over the first 5 points). So the cheapest deal for us is not the lowest price:"
            " each option shows its health price, where our C is lowest."
        )
    if "index_clause" in case["negotiable"]:
        paths = ", ".join(f"{k} {v * 100:+g} %" for k, v in (b.get("index_paths") or {}).items())
        lines.append(
            f"[A] An index clause costs us the expected index move beyond its deadband ({paths or 'none given'}) plus index risk {b.get('index_risk_pct', 0):g} %, on its material share."
        )
    opts = []
    for f in case["negotiable"]:
        if f == "unit_price":
            continue
        vals = case.get("term_options", {}).get(f) or []
        opts.append(f"{f} {{{', '.join(terms_text(case, {f: v}) for v in vals)}}}")
    fixed = ", ".join(f"{k} {v}" for k, v in case.get("fixed_terms", {}).items())
    lines.append(f"[A] Negotiable: unit_price, {'; '.join(opts)}. Fixed: {fixed or 'none'}.")
    return lines


def supplier_lines(neg, side, events, zone0=True):
    d = side.dossier
    lines = [
        f"[D] {d.name or side.sid} ({side.sid}), {d.country or '?'}, owner type {d.owner_type or '?'}; contract {d.contract_id or 'none on record'}."
    ]
    if d.full_cost is not None:
        band = f"{eur(d.full_cost_floor)}-{eur(d.full_cost)}" if d.full_cost_floor else "unknown"
        how = d.full_cost_source.replace(
            "+quote cap",
            ", capped by its opening quote at the sustainable margin (an assumption: it held in every practice case we could check)",
        )
        lines.append(
            f"[E] Its full cost: estimate {eur(d.full_cost)}/unit, range {band}. Source: {how}; the data's should-cost carries about ±5 %."
        )
    if d.rate_measured:
        lines.append(
            f"[E] Its cost of money: {d.interest_rate * 100:.2f} %/yr, measured from two of its own sheets that differ only in payment days."
        )
    else:
        lines.append(
            f"[E] Its cost of money: unknown until two of its sheets differ only in payment days. The prices below assume"
            f" {d.interest_rate * 100:.1f} %/yr (our owner-type guess, which missed by up to 3 points in practice)."
        )
    if "index_clause" in neg.case["negotiable"]:
        drivers = its_drivers(events)
        for clause in [c for c in neg.case.get("term_options", {}).get("index_clause") or [] if c]:
            d = drivers.get(clause["series"])
            if d:
                rates = ", ".join(
                    f"db {c['deadband_pct']:g} % = {protection({'index_clause': c}, drivers) * 100:.1f} %"
                    for c in neg.case["term_options"]["index_clause"]
                    if c and c["series"] == clause["series"]
                )
                lines.append(
                    f"[E] Its value of an index clause on {d.series}: the protection beyond the deadband on the exposure it states"
                    f" ({d.share_pct:g} % of its cost, +{d.rise_pct:g} %): {rates} of the price. Method checked against suppliers' own"
                    " deadband pricing (12 sheet pairs in two practice cases: within 0.4 points)."
                )
                break
    z = dossier(side.sid) if zone0 else None
    if z:
        s = z.get("strategy") or {}
        for n in s.get("needs") or []:
            lines.append(
                f"[Z] Need: {n.get('need')} ({n.get('strength')}): {n.get('detail')} ({', '.join(n.get('evidence') or [])})"
            )
        for c in s.get("constraints") or []:
            if c.get("kind") == "sells_below_cost" or "should-cost" in (c.get("detail") or ""):
                continue  # code owns the cost estimate (the E line above); no second opinion on it
            lines.append(f"[Z] Constraint: {c.get('kind')}: {c.get('detail')} ({', '.join(c.get('evidence') or [])})")
    elif zone0:
        lines.append("[Z] No offline reading of this supplier.")
    return lines


def thread_lines(neg, side, events):
    case = neg.case
    lines, ours = [], 0
    for m in events:
        if m.get("from") == "buyer":
            ours += 1
            sheets = m.get("term_sheets") or []
            if sheets:
                t = sheets[0].get("terms") or {}
                lines.append(
                    f"[us] Message {ours}: {eur(t.get('unit_price'))}, {terms_text(case, t)}; refs {', '.join(m.get('refs') or []) or 'none'}."
                )
            continue
        sheets = m.get("term_sheets") or []
        desc = []
        for ts in sheets:
            t = ts.get("terms") or {}
            c = eco.cost(case, t, side.standard, side.estimate()) if t.get("unit_price") is not None else None
            desc.append(
                f"{ts.get('term_sheet_id')}: {eur(t.get('unit_price'))}, {terms_text(case, t)} → our C {big(c) if c else '-'}"
            )
        label = "Its quote" if ours == 0 else f"Reply to our message {ours}"
        lines.append(f"[S] {label} (status {m.get('status')}): " + " | ".join(desc))
        drivers = sg.drivers(m)
        if drivers:
            lines.append(
                "[S] It states: "
                + "; ".join(
                    f"{x.series} rose {x.rise_pct:g} % in twelve months and is {x.share_pct:g} % of its cost"
                    for x in drivers
                )
                + "."
            )
        v = verdicts(m.get("body"))
        if v:
            lines.append("[S] Its verdict on our claims: " + "; ".join(f"{k}: {w}" for k, w in v.items()) + ".")
        results = m.get("claim_results") or []
        if results:
            lines.append(
                "[A] Arena check of our claims: "
                + ", ".join(f"#{r.get('index')} {r.get('result')}" for r in results)
                + "."
            )
    last = latest(events)
    lines.append(
        f"[S] Its latest e-mail (~ = a stock line the arena's bots write to everyone): {marked_text(last.get('body'))}"
    )
    return lines


def argument_lines(neg, side, move):
    """What we may cite (sentences and figures built by code from the data) as it stood before the
    engine's move picked its claims, and its side of the facts."""
    p = side.pending or {}  # what the engine's move just added (kept for a rollback on a late send)
    keys, kinds, refs = p.get("keys", ()), p.get("kinds", frozenset()), p.get("refs", frozenset())
    used, heard, cited = side.used - set(keys), side.kinds_used - set(kinds), neg.used_refs - set(refs)
    picked = {c.key for c in (move or {}).get("claims") or []}
    pool = list((move or {}).get("claims") or []) + [c for c in side.bank if c.key not in picked]
    claims, lines = {}, []
    for c in pool:
        if c.key in used or c.kind in heard or c.kind in neg.dead_kinds or set(c.refs) & cited:
            continue
        cid = f"a{len(claims) + 1}"
        claims[cid] = c
        lines.append(f"{cid} [D, {c.kind}] {c.sentence}" + ("  (E0 cites it)" if c.key in picked else ""))
        if len(claims) >= 12:
            break
    if not claims:
        lines.append("(none left that this supplier has not heard)")
    if heard:
        lines.append(
            f"(kinds this supplier has heard already: {', '.join(sorted(heard))}; each kind once, each ID once per case)"
        )
    z = dossier(side.sid)
    parts = set(neg.case.get("parts", []))
    theirs = [
        a
        for a in (z or {}).get("arguments") or []
        if a.get("side") == "for_them" and a.get("checkable") and a.get("part") in parts
    ]
    if theirs:
        lines.append("Its side of the facts (D, checkable, support its position - do not cite them):")
        lines += [f"  - [{a['kind']}] {a['sentence']}" for a in theirs[:8]]
    return lines, claims


def code_price(neg, side, terms, main, its_sheet, drivers, health):
    """The price code sets on these terms - the model picks the terms, not the price (phase 3: the
    engine's anchor and steps beat the model's on price). (price, how) or (None, why):
      - the engine's own terms: the engine's price;
      - relationship goals, when the supplier gains at our health price against its own sheet: the
        health price (a deal there is likely and our C is lowest there);
      - otherwise: the price worth to the supplier what the engine's move is worth to it, so the
        engine's anchor and concession steps carry over to these terms."""
    case, est = neg.case, side.estimate()
    if main and all(main.get(k) == v for k, v in terms.items()):
        return main["unit_price"], "the engine's price"
    target = worth(case, its_sheet, its_sheet["unit_price"], est, drivers) if its_sheet else None
    if health and target and worth(case, terms, health, est, drivers) >= target - 1e-6:
        return (
            health,
            "our health price: worth more to it than its own sheet, so likely accepted, and our C is lowest there",
        )
    if not main:
        return None, "no engine move to match"
    level = worth(case, main, main["unit_price"], est, drivers)
    plain = {k: v for k, v in est.items() if k != "extras"}
    price = eco.price_for_value(case, terms, plain, level / (1 + protection(terms, drivers)))
    if not price or price <= 0:
        return None, "no positive price"
    return round(price, 2), "worth to it what the engine's move is worth to it (the engine's level, on these terms)"


def option_lines(neg, side, move, its_sheet, drivers):
    case, std, est = neg.case, side.standard, side.estimate()
    main = (move.get("sheets") or [None])[0] if move else None
    standing_terms = complete_offer(case, its_sheet) if its_sheet else None
    band = (side.dossier.full_cost_floor, side.dossier.full_cost) if side.dossier.full_cost else None
    rows = eco.menu(case, standing_terms, std, est, band=band) if standing_terms else []
    keep = rows[:TOP_OPTIONS]
    wants = [side.mix, {k: v for k, v in (standing_terms or {}).items() if k != "unit_price"}]
    for f in case["negotiable"]:  # every allowed value of every field shows at least once, at its best mix
        for v in case.get("term_options", {}).get(f) or []:
            if not any(r["terms"].get(f) == v for r in keep):
                best = next((r for r in rows if r["terms"].get(f) == v), None)
                if best:
                    keep.append(best)
    for want in wants:
        row = next((r for r in rows if all(r["terms"].get(k) == v for k, v in want.items() if k in r["terms"])), None)
        if row and row not in keep:
            keep.append(row)
    target = worth(case, its_sheet, its_sheet["unit_price"], est, drivers) if its_sheet else None
    options, lines = {}, []

    def describe(terms, price, how):
        c = eco.cost_at(case, terms, price, std, est)
        gain = worth(case, terms, price, est, drivers) / target - 1 if target else None
        return c, f"{eur(price)} ({how}) → our C {big(c)}" + (
            f", to it {gain * 100:+.1f} % vs its own sheet" if gain is not None else ""
        )

    if main:
        terms = {k: v for k, v in main.items() if k != "unit_price"}
        options["E0"] = {"terms": terms, "price": main["unit_price"]}
        _, txt = describe(terms, main["unit_price"], "the rule engine's move: rules tuned on practice cases, a default")
        lines.append(f"E0 {terms_text(case, main)}: {txt}")
    for i, r in enumerate(keep, 1):
        terms = r["terms"]
        if main and all(main.get(k) == v for k, v in terms.items()):
            continue  # the same terms as E0
        price, how = code_price(neg, side, terms, main, its_sheet, drivers, r.get("health_price"))
        if price is None:
            continue
        c, txt = describe(terms, price, how)
        if c >= neg.limit:
            continue  # no better than C_open or the alternative
        oid = f"o{i}"
        options[oid] = {"terms": terms, "price": price}
        extra = ""
        if terms.get("index_clause"):
            bd = cost_breakdown(case, {**terms, "unit_price": price}, std, est)
            extra = f"; the clause costs us {big(bd['index_clause'] + bd['index_risk'])} over the horizon"
        if r.get("health_price"):
            lo, hi = r.get("health_range") or (None, None)
            extra += f"; health price {eur(r['health_price'])}" + (
                f" (range {eur(lo)}-{eur(hi)} over its full-cost range)" if lo else ""
            )
        lines.append(f"{oid} {terms_text(case, terms)}: {txt}{extra}")
    lines.append(
        "(You choose the terms; code sets the price shown. 'to it' = how much more (+) or less (-) the sheet is worth to it than its"
        " own standing sheet [E: its cash value plus, for a clause, the protection on the exposure it states; contract length or lead"
        " time it may value are not counted]. health = the price where our C is lowest on those terms [A formula on E inputs].)"
    )
    return lines, options


def pace_lines(neg, side, events, options):
    """S/E: its moves so far on our current terms, and how many rounds its pace needs to reach each
    option's lowest rung on those terms - a property of this thread, computed by code."""
    prices = [p for p in side.theirs if p and p != float("inf")]
    left = moves_left(neg.case, events)
    if len(prices) < 2:
        return [
            f"[S] Its price on our terms so far: {', '.join(eur(p) for p in prices) or '-'} (one reply: no pace yet). Messages we may still send: {left}."
        ]
    steps = [a - b for a, b in zip(prices, prices[1:], strict=False)]
    pace = sum(steps[-2:]) / len(steps[-2:])
    lines = [
        f"[S] Its price on our terms so far: {' → '.join(eur(p) for p in prices)}; recent pace {eur(pace)} per reply. Messages we may still send: {left}."
    ]
    e0 = options.get("E0")
    if pace > 0 and e0 and e0["price"] < prices[-1]:
        lines.append(
            f"[E] At that pace, reaching our current proposal {eur(e0['price'])} takes about {(prices[-1] - e0['price']) / pace:.0f} replies."
        )
    return lines


def accept_lines(neg, side, events):
    out, lines = {}, []
    for ts in latest(events).get("term_sheets") or []:
        t = ts.get("terms") or {}
        if t.get("unit_price") is None:
            continue
        ok, why = eco.accept_check(neg.case, t, side.standard, side.estimate(), neg.c_open)
        if ok:
            out[ts["term_sheet_id"]] = eco.cost(neg.case, t, side.standard, side.estimate())
            lines.append(f"{ts['term_sheet_id']}: passes the accept check ({why}).")
    if not lines:
        lines.append("No standing sheet passes the accept check.")
    return lines, out


def build(neg, threads, move, zone0=True):
    """The packet for the thread the engine answers now (`move["supplier_id"]`); `zone0` = with the
    offline dossier's [Z] lines."""
    sid = move["supplier_id"]
    side, events = neg.sides[sid], threads[sid]
    _, its_sheet = standing(events)
    status = latest(events).get("status")
    arg_lines, claims = argument_lines(neg, side, move)
    opt_lines, options = option_lines(neg, side, move, its_sheet, its_drivers(events))
    acc_lines, accept = accept_lines(neg, side, events)
    pace = pace_lines(neg, side, events, options)
    sections = [
        ("CASE", case_lines(neg, side)),
        ("SUPPLIER", supplier_lines(neg, side, events, zone0)),
        ("THREAD", thread_lines(neg, side, events)),
        ("ARGUMENTS WE MAY CITE (figures checked by code; the arena checks at most 3 per message)", arg_lines),
        ("OPTIONS (code-priced; every price is on that option's terms)", opt_lines),
        ("ACCEPT", acc_lines),
        (
            "STATE",
            [
                f"Its status: {status}."
                + (
                    " It called this its final offer: going below it risks a walk-away."
                    if status == "final_offer"
                    else ""
                )
            ]
            + pace,
        ),
    ]
    text = "\n\n".join(f"## {title}\n" + "\n".join(lines) for title, lines in sections)
    return {"text": text, "options": options, "claims": claims, "accept": accept, "sid": sid, "status": status}
