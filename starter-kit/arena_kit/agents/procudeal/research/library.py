"""Argument library: every verifiable argument about one supplier and the parts it supplies.

A checkable item is one sentence with our figure next to its IDs, computed by code exactly as the
arena checks it (api.md, "What counts"); the analysts only pick argument IDs (docs/research.md).
Context the arena does not check (clause texts, notes, past negotiations, rival quotes) carries
`checkable: False` and a figure-free sentence, or none. `side`: `for_us` weakens the supplier's
case, `for_them` is an argument it can bring - the red team needs both.
"""

import hashlib
import json
import logging
import re
from datetime import date, timedelta

from ..claims import _recent
from ..dossier import CASH_SIGNS, COUNTRY_COST, FULL_SIGNS, HEDGED_SIGNS, WORK_SIGNS, skonto_rate
from . import evidence as ev

log = logging.getLogger("arena")

US, THEM = "for_us", "for_them"
FLAT_PCT = 0.5  # an index move below this is flat: it weakens a price increase, nothing more
OTD_TARGET = 95.0  # company.md: the quality agreement's on-time delivery target
QN_REFS = 6  # quality notifications in one sentence at most (the arena takes their mean ppm)
ORDER_LINES = 3  # order lines per order-history sentence (the arena checks 2-8)
STANDARD_PAYMENT_DAYS = 60  # company policy
WEAK_CREDIT, CREDIT_DROP, WEAK_EQUITY = 300, 30, 15.0  # credit index: higher is worse
LATE_PAYMENT_DAYS = 3.0
SMALL_SHARE_PCT, BIG_SHARE_PCT = 2.0, 10.0  # our spend as a share of its turnover
NOTE_CHARS = 700

STALE_COSTING = re.compile(
    r"spreadsheet|last updated|not followed|since the \d{4} peak|does the costing|where we get our index", re.I
)
LOYALTY = re.compile(
    r"partnership|kept supplying|old price|reliabl|many years|loyal|below full cost|keep the volume", re.I
)
SCARCITY = re.compile(
    r"allocat|shortage|fully booked|backlog|cannot confirm|longer delivery|forced to adjust|price increase", re.I
)
US_SIGNS = (
    ("asks for faster payment / values cash", CASH_SIGNS),
    ("looks for work", WORK_SIGNS),
    ("material bought forward at fixed prices", HEDGED_SIGNS),
    ("its costing is out of date", STALE_COSTING),
)
THEM_SIGNS = (
    ("capacity full", FULL_SIGNS),
    ("invokes the relationship / past sacrifices", LOYALTY),
    ("scarcity or a price increase", SCARCITY),
)
NEWS_SIDE = {
    "free_capacity": (US, "it advertises free capacity: it wants work"),
    "short_time_work": (US, "short-time work: its plant is under-used, it wants work"),
    "credit_watch": (US, "under pressure with its banks: it values cash and volume (and is a supply risk)"),
    "credit_downgrade": (US, "rating lowered: it values cash (and is a supply risk)"),
    "restructuring": (US, "restructuring after losses: it values cash and volume (and is a supply risk)"),
    "succession": (US, "owner seeks a successor: stable volume helps its value; continuity risk"),
    "energy_contract": (US, "power price fixed long term: energy rises do not reach its cost"),
    "new_plant": (US, "new capacity to fill: it wants work"),
    "noise": (US, "no lever: noise"),
    "renamed": (US, "no lever: a change of name"),
    "full_order_book": (THEM, "fully booked: it does not need our volume"),
    "big_order": (THEM, "a large new order fills its capacity"),
    "allocation": (THEM, "it allocates volumes: supply is scarce"),
    "chip_shortage": (THEM, "component shortage: longer lead times, scarce supply"),
    "refocus": (THEM, "it focuses on larger accounts: we may matter less to it"),
    "new_owner": (THEM, "a new owner reviews prices with all customers"),
    "approvals": (THEM, "extended approvals make it harder to replace"),
}
CLAUSE_SIDE = {"price": US, "quality": US, "term": US, "delivery": THEM, "payment": THEM}
PERCENT = re.compile(r"([+\-−])\s?(\d+(?:[.,]\d+)?)\s?%")


def argument_library(pkg, sid, evidence=None):
    """Every argument about supplier `sid` and its parts: checkable ones (figures as the arena
    checks them) and context items, both sides. `evidence`: a supplier_evidence() result to reuse."""
    e = evidence if evidence is not None else ev.supplier_evidence(pkg, sid)
    out = []
    for make in KINDS:
        try:
            out += make(pkg, sid, e)
        except Exception:  # one broken kind never costs the others
            log.exception("argument kind %s failed for %s", make.__name__, sid)
    return _finish(pkg, out)


def _arg(kind, part, refs, figures, sentence, checkable, side, note, key=""):
    digest = hashlib.sha1(json.dumps([kind, part, sorted(refs), key], ensure_ascii=False).encode()).hexdigest()[:8]
    return {
        "arg_id": f"{kind}:{part.split(':', 1)[1] if part else 'all'}:{digest}",
        "kind": kind,
        "part": part,
        "refs": list(refs),
        "figures": figures,
        "sentence": sentence,
        "checkable": checkable,
        "side": side,
        "note": note,
    }


def _finish(pkg, items):
    """Only refs that exist; a checkable item with an unknown ref is dropped; unique arg IDs."""
    out, seen, taken = [], set(), set()
    for a in items:
        known = [r for r in a["refs"] if ev.fact(pkg, r)]
        if a["checkable"] and (not known or len(known) != len(a["refs"])):
            log.debug("argument %s dropped: unknown refs %s", a["arg_id"], set(a["refs"]) - set(known))
            continue
        if any(r in a["sentence"] for r in set(a["refs"]) - set(known)):
            a["sentence"] = ""
        a["refs"] = known
        key = (a["kind"], a["part"], tuple(sorted(known)), a["sentence"], a["note"])
        if key in seen:
            continue
        seen.add(key)
        base, n = a["arg_id"], 2
        while a["arg_id"] in taken:
            a["arg_id"], n = f"{base}-{n}", n + 1
        taken.add(a["arg_id"])
        out.append(a)
    return out


# --- helpers -----------------------------------------------------------------------------------------


def _as_of(e):
    return date.fromisoformat(ev.window(e.get("data_month") or "2026-09")[1])


def _label(name):
    """An index name for a sentence: no parenthesis and no digits next to the checked figure."""
    label = (name or "").split(" (")[0].strip()
    if any(ch.isdigit() for ch in label):
        label = re.sub(r"\s*\d[\d.,/-]*", "", label).strip(" ,;:")
    return label or "The index"


def _per(unit):
    unit = int(unit or 1)
    return " per unit" if unit == 1 else f" per {unit} units"


def _plain(body):
    """A document's text without its title and byline, on one line."""
    lines = [t for t in body.splitlines() if t.strip() and not t.startswith("#")]
    if lines and re.match(r"^[\w ]+ - \d{4}-\d{2}-\d{2} - ", lines[0]):
        lines = lines[1:]
    text = " ".join(" ".join(lines).replace("**", "").split())
    return text if len(text) <= NOTE_CHARS else text[: NOTE_CHARS - 3] + "..."


def _signals(body):
    us = [label for label, rx in US_SIGNS if rx.search(body)]
    them = [label for label, rx in THEM_SIGNS if rx.search(body)]
    return us, them


def _current_price(sid, block):
    """Its price for the part now, per piece: the open price condition, else the latest order, else
    its latest quote. (price, price_unit, per piece, source)"""
    conds = [r for r in block.get("price_history", []) if r.get("supplier_id") == sid and r.get("price")]
    if conds:
        r = conds[-1]
        return r["price"], r["price_unit"], ev.per_piece(r["price"], r["price_unit"]), f"price from {r['valid_from']}"
    for o in block.get("orders", []):
        if o.get("supplier_id") == sid and o.get("latest_price"):
            return (
                o["latest_price"],
                o["price_unit"],
                ev.per_piece(o["latest_price"], o["price_unit"]),
                f"order of {o['last_order']}",
            )
    quotes = [q for q in block.get("quotes", []) if q.get("supplier_id") == sid and q.get("unit_price")]
    if quotes:
        q = quotes[-1]
        return q["unit_price"], q["price_unit"], ev.per_piece(q["unit_price"], q["price_unit"]), f"quote {q['id']}"
    return None, None, None, "no price found"


def _first_part(doc):
    found = ev.PART_REF.findall(str(doc.get("part_ids") or ""))
    return found[0] if len(found) == 1 else None


# --- checkable kinds ---------------------------------------------------------------------------------


def _notice(pkg, sid, e):
    """A price letter's notice against the contract's price clause (the arena checks both days)."""
    clauses = [c for k in e.get("contracts", []) for c in k.get("clauses", []) if c.get("type") == "price"]
    out = []
    for d in e.get("documents", []):
        f = ev.fact(pkg, d["id"])
        given = f.get("days")
        if not given or f.get("supplier") != sid:
            continue
        for c in clauses:
            agreed = ev.fact(pkg, c["id"]).get("days")
            if not agreed:
                continue
            short = given < agreed
            link = "while" if short else "and"
            sentence = (
                f"Your letter gives {given} days' notice ({d['id']}), {link} our framework agreement requires "
                f"{agreed} days ({c['id']})."
            )
            note = (
                f"Letter of {f.get('date')} asks {f.get('asked_pct')}% (EUR {f.get('asked_price')}) from "
                f"{f.get('effective_date')} with {given} days' notice; clause {c['id']} needs {agreed}. "
                + ("Too short: the change cannot take effect as asked." if short else "It gave enough notice.")
            )
            if "calendar year" in (c.get("text") or "") and str(f.get("effective_date") or "")[5:] != "01-01":
                note += " The clause fixes prices per calendar year, and the letter asks for a change within it."
            figures = {"given": given, "agreed": agreed, "effective_date": f.get("effective_date")}
            figures |= {"asked_pct": f.get("asked_pct"), "asked_price": f.get("asked_price")}
            out.append(
                _arg(
                    "notice_period",
                    _first_part(d),
                    [d["id"], c["id"]],
                    figures,
                    sentence,
                    True,
                    US if short else THEM,
                    note,
                )
            )
    return out


def _index(pkg, sid, e):
    """Index pairs of each cost driver (and index clause series): one series, at most 12 months
    apart, ending within the last 12 months of the data - the 12-month change, the largest fall and
    the largest rise; peaks further back are context."""
    month = e.get("data_month") or "2026-09"
    out = []
    for part, block in e.get("parts", {}).items():
        for d in block.get("drivers", []):
            last = d.get("last_id")
            if not last:
                continue
            f1 = ev.fact(pkg, last)
            m1, v1 = (f1.get("month") or last.rsplit("@", 1)[1])[:7], f1.get("value")
            if v1 is None:
                continue
            label, weight, series = _label(d.get("name") or d["series_id"]), d.get("weight"), d["series_id"]
            starts = [("12 months", d.get("from_12m_id"))]
            if (d.get("max_fall_pct") or 0) <= -FLAT_PCT:
                starts.append(("largest fall within 12 months", d.get("max_fall_from_id")))
            if (d.get("max_rise_pct") or 0) >= FLAT_PCT:
                starts.append(("largest rise within 12 months", d.get("max_rise_from_id")))
            starts += [
                ("since the 36-month peak", d.get("peak_id")),
                ("since the high of all the data", d.get("top_id")),
            ]
            seen = {last}
            for window, start in starts:
                if not start or start in seen:
                    continue
                seen.add(start)
                f0 = ev.fact(pkg, start)
                m0, v0 = (f0.get("month") or start.rsplit("@", 1)[1])[:7], f0.get("value")
                if not v0:
                    continue
                change = (v1 / v0 - 1) * 100
                apart = ev._gap(m0, m1)
                figures = {"series": series, "from_month": m0, "to_month": m1, "from_value": v0, "to_value": v1}
                figures |= {"change_pct": round(change, 1), "weight": weight, "window": window}
                if weight:
                    figures["weighted_pct"] = round(weight * change, 2)
                share = f"{weight:.0%} of the part's cost" if weight else "weight unknown"
                note = f"{series} ({d.get('name')}): {change:+.1f}% {window} ({m0} to {m1}); {share}"
                if weight:
                    note += f", so about {weight * change:+.2f}% on the price"
                if window.startswith("since") and abs(change) < FLAT_PCT:
                    continue  # at its peak: nothing to say
                if 1 <= apart <= ev.WINDOW_MONTHS and _recent(m1, month):
                    side = THEM if change >= FLAT_PCT else US
                    sentence = f"{label} changed {change:+.1f}% from {m0} to {m1} ({start}, {last})."
                    out.append(_arg("index_change", part, [start, last], figures, sentence, True, side, note + "."))
                elif window.startswith("since"):
                    note += f". Not checkable: {apart} months apart; cite the 12-month change instead."
                    out.append(
                        _arg("index_peak", part, [start, last], figures, "", False, US if change < 0 else THEM, note)
                    )
    return out


def _should_cost(pkg, sid, e):
    """`cost:` estimates of each part (the arena checks the estimate), against its price now."""
    out = []
    country = (e.get("master") or {}).get("country")
    for part, block in e.get("parts", {}).items():
        price, unit, price_pp, source = _current_price(sid, block)
        for r in block.get("should_cost", []):
            f = ev.fact(pkg, r["id"])
            cost = f.get("unit_cost")
            if cost is None:
                continue
            cu = int(f.get("price_unit") or r.get("price_unit") or 1)
            own, generic = r.get("supplier_id") == sid, not r.get("supplier_id")
            factor = COUNTRY_COST.get(country, 1.0) if generic else 1.0
            cost_pp = cost / cu * factor
            margin = ev._pct(price_pp, cost_pp) if price_pp else None
            whose = "its own plant" if own else "a German cost base" if generic else f"the plant of {r['supplier_id']}"
            note = f"Should-cost EUR {cost:.2f}{_per(cu)} ({whose}, error about {r.get('confidence_pct')}%)"
            if generic and factor != 1.0:
                note += f"; x {factor} for {country} = EUR {cost_pp * cu:.2f}"
            if margin is not None:
                note += f"; its price EUR {price:.2f}{_per(unit)} ({source}) is {margin:+.1f}% against it"
                note += " This is an uncertain estimate, not proof of actual margin or a price floor."
            else:
                note += "; no current price of this supplier found."
            sentence = (
                f"Our bottom-up cost model puts the full cost of this part at EUR {cost:.2f}{_per(cu)} ({r['id']})."
            )
            figures = {"unit_cost": cost, "price_unit": cu, "estimate_of": r.get("supplier_id") or "DE cost base"}
            figures |= {"price": price, "price_unit_of_price": unit, "margin_pct": margin}
            side = THEM if margin is not None and margin < 0 else US
            out.append(_arg("should_cost", part, [r["id"]], figures, sentence, True, side, note))
    return out


def _scorecard(pkg, sid, e):
    """The latest rolling scorecard: on-time delivery and ppm (the arena checks the row's values)."""
    cards = [s for s in e.get("scorecards", []) if s.get("supplier_id") == sid]
    if not cards:
        return []
    sc = cards[-1]
    f = ev.fact(pkg, sc["id"])
    peers = ev.rows(pkg, "SELECT otd_pct, ppm FROM scorecards WHERE quarter = ?", (sc["quarter"],))
    otd_med = _median([p["otd_pct"] for p in peers if p.get("otd_pct") is not None])
    ppm_med = _median([p["ppm"] for p in peers if p.get("ppm") is not None])
    year_ago = next((c for c in cards if c["quarter"] == _quarter_back(sc["quarter"], 4)), None)
    out = []
    otd = f.get("otd_pct")
    if otd is not None:
        note = (
            f"Rolling 12 months to {sc.get('period_end')}: {otd}% on time against the requested date "
            f"({f.get('otd_confirmed_pct')}% against its own confirmed date); target {OTD_TARGET:.0f}%; "
            f"peers' median {otd_med}%; class {sc.get('class')} {sc.get('colour')}."
        )
        if year_ago:
            note += f" A year earlier {year_ago.get('otd_pct')}%."
        sentence = f"Your rolling scorecard shows on-time delivery of {otd:.1f}% ({sc['id']})."
        figures = {"otd_pct": otd, "quarter": sc["quarter"], "target_pct": OTD_TARGET, "peer_median_pct": otd_med}
        out.append(
            _arg("delivery_record", None, [sc["id"]], figures, sentence, True, US if otd < OTD_TARGET else THEM, note)
        )
    ppm = f.get("ppm")
    if ppm is not None:
        note = (
            f"Rolling 12 months to {sc.get('period_end')}: {ppm} ppm from {sc.get('qn_count')} complaints; peers' "
            f"median {ppm_med} ppm; 8D reports overdue {sc.get('open_8d_overdue')}."
        )
        if year_ago:
            note += f" A year earlier {year_ago.get('ppm')} ppm."
        sentence = f"Your rolling scorecard shows {int(ppm)} ppm defects ({sc['id']})."
        side = US if ppm > 0 and ppm >= (ppm_med or 0) else THEM
        figures = {"ppm": ppm, "quarter": sc["quarter"], "peer_median_ppm": ppm_med}
        out.append(_arg("quality_record", None, [sc["id"]], figures, sentence, True, side, note))
    return out


def _median(values):
    values = sorted(values)
    if not values:
        return None
    mid = len(values) // 2
    return values[mid] if len(values) % 2 else round((values[mid - 1] + values[mid]) / 2, 1)


def _quarter_back(quarter, k):
    y, q = int(quarter[:4]), int(quarter[-1])
    n = y * 4 + q - 1 - k
    return f"{n // 4}Q{n % 4 + 1}"


def _quality_notifications(pkg, sid, e):
    """Its supplier-caused complaints on each part in the last 12 months (the arena takes the mean ppm)."""
    start, _end = ev.window(e.get("data_month") or "2026-09")
    out = []
    for part in e.get("parts", {}):
        qns = [
            q
            for q in e.get("quality", [])
            if q.get("part_id") == part
            and q.get("supplier_id") == sid
            and q.get("supplier_caused")
            and str(q.get("qn_date")) > start
        ]
        qns = [
            q
            for q in sorted(qns, key=lambda q: (q["qn_date"], q["id"]), reverse=True)
            if ev.fact(pkg, q["id"]).get("ppm") is not None
        ]
        if not qns:
            continue
        cited = qns[:QN_REFS]
        ppms = [ev.fact(pkg, q["id"])["ppm"] for q in cited]
        mean = round(sum(ppms) / len(ppms))
        refs = [q["id"] for q in cited]
        if len(refs) == 1:
            sentence = f"Our latest quality notification on this part records {mean} ppm ({refs[0]})."
        else:
            sentence = f"Our recent quality notifications on this part average {mean} ppm ({', '.join(refs)})."
        defects = sorted({q.get("defect") for q in qns if q.get("defect")})
        fees = sum(q.get("cost_recharged_eur") or 0 for q in qns)
        open_8d = sum(1 for q in qns if not q.get("d8_date"))
        note = (
            f"{len(qns)} supplier-caused complaints on this part in the last 12 months ({', '.join(defects)}); "
            f"EUR {fees} recharged; {open_8d} without a closed 8D. Per-lot ppm is jumpy (KNOWN_ISSUES 10): "
            "the scorecard's rolling ppm is the fairer figure."
        )
        figures = {"ppm_mean": mean, "ppms": ppms, "complaints_12m": len(qns)}
        out.append(_arg("quality_notification", part, refs, figures, sentence, True, US, note))
    return out


def _orders(pkg, sid, e):
    """Order history: 2-8 of our order lines of one part (the arena checks the order prices).
    Latest lines anchor what we pay; the earliest show how its price moved."""
    out = []
    for part in e.get("parts", {}):
        picks = {}
        for name, order in (("latest", "DESC"), ("earliest", "ASC")):
            found = ev.rows(
                pkg,
                "SELECT id FROM po_lines WHERE supplier_id = ? AND part_id = ? "
                "AND (price_note IS NULL OR price_note != 'stale_condition') "
                f"ORDER BY order_date {order}, id {order} LIMIT ?",
                (sid, part, ORDER_LINES),
            )
            lines = [(r["id"], ev.fact(pkg, r["id"])) for r in found]
            lines = [(i, f) for i, f in lines if f.get("unit_price") and f.get("part") == part]
            units = {int(f.get("price_unit") or 1) for _, f in lines}
            if len(lines) >= 2 and len(units) == 1:
                picks[name] = (lines, units.pop())
        if "latest" not in picks:
            continue
        avg = {k: sum(f["unit_price"] for _, f in v[0]) / len(v[0]) for k, v in picks.items()}
        for name, (lines, unit) in picks.items():
            refs = [i for i, _ in lines]
            prices = [f["unit_price"] for _, f in lines]
            dates = [f.get("date") for _, f in lines]
            if name == "earliest" and set(refs) & set(i for i, _ in picks["latest"][0]):
                continue
            if len(set(prices)) == 1:
                what = "Our latest orders" if name == "latest" else "Our earliest orders on record"
                sentence = f"{what} for this part were all at EUR {prices[0]:.2f}{_per(unit)} ({', '.join(refs)})."
            elif name == "latest":
                sentence = f"Our recent orders for this part show the prices we have been paying ({', '.join(refs)})."
            else:
                sentence = f"Our earlier orders for this part show the prices we paid then ({', '.join(refs)})."
            if name == "latest":
                side, note = (
                    US,
                    f"What we pay now: {prices}{_per(unit)} ({dates[-1]} to {dates[0]}); anchors any increase.",
                )
            else:
                change = ev._pct(avg["latest"], avg["earliest"]) or 0.0
                side = THEM if change < 0 else US
                note = (
                    f"Earliest orders {prices}{_per(unit)} ({dates[0]} to {dates[-1]}); now {change:+.1f}% against them"
                )
                note += (
                    " - it has already cut its price since." if side == THEM else " - its price has not fallen since."
                )
            figures = {"unit_prices": prices, "price_unit": unit, "dates": dates}
            out.append(_arg("order_history", part, refs, figures, sentence, True, side, note, key=name))
    return out


def _forecast(pkg, sid, e):
    """The latest forecast change of each part (the arena checks the recorded change)."""
    out = []
    for part, block in e.get("parts", {}).items():
        snaps = [s for s in block.get("forecasts", []) if ev.fact(pkg, s["id"]).get("change_pct") is not None]
        if not snaps:
            continue
        s = snaps[-1]
        f = ev.fact(pkg, s["id"])
        change = f["change_pct"]
        if change > 0:
            sentence = f"Our demand forecast for this part has risen {change:.1f}% ({s['id']})."
        else:
            sentence = f"Our demand forecast for this part has changed {change:+.1f}% ({s['id']})."
        ordered = next(
            (x.get("ordered_last_12m") for x in block.get("forecasts", []) if x.get("ordered_last_12m")), None
        )
        note = (
            f"Snapshot {s.get('snapshot_month')}: {f.get('volume_per_year') or s.get('qty_next_12m')} for the next "
            f"12 months against {ordered} ordered in the last 12 months (requested dates); shared with suppliers: "
            f"{bool(s.get('shared_with_suppliers'))}. "
            + "Supplier willingness to trade for volume is unknown; the forecast alone does not establish it."
        )
        figures = {
            "change_pct": change,
            "volume_per_year": f.get("volume_per_year"),
            "snapshot": s.get("snapshot_month"),
        }
        out.append(_arg("volume_change", part, [s["id"]], figures, sentence, True, US if change > 0 else THEM, note))
    return out


def _news(pkg, sid, e):
    """News about this supplier (the arena checks that it is about it)."""
    out = []
    for n in e.get("news", []):
        f = ev.fact(pkg, n["id"])
        if f.get("supplier") != sid:
            continue
        topic = n.get("topic") or f.get("topic") or ""
        headline = n.get("headline") or f.get("headline") or ""
        side, why = NEWS_SIDE.get(topic, (None, ""))
        if side is None:
            us, them = _signals(f"{headline} {n.get('body') or ''}")
            side, why = (THEM, ", ".join(them)) if len(them) > len(us) else (US, ", ".join(us) or "unclassified")
        if headline and not any(ch.isdigit() for ch in headline):
            sentence = f'We have noted the press report "{headline}" ({n["id"]}).'
        else:
            sentence = f"We have noted the recent press report about your company ({n['id']})."
        note = f"{n.get('date')} {topic}: {headline}. {n.get('body') or ''} -> {why}."
        out.append(_arg("news", None, [n["id"]], {"topic": topic, "date": n.get("date")}, sentence, True, side, note))
    return out


# --- context kinds (not checked by the arena) ----------------------------------------------------------


def _clauses(pkg, sid, e):
    """Each framework clause as context: what it fixes, with a figure-free sentence."""
    out = []
    as_of = _as_of(e)
    for k in e.get("contracts", []):
        parts = k.get("parts") or [None]
        part = parts[0] if len(parts) == 1 else None
        for c in k.get("clauses", []):
            kind, body = c.get("type"), c.get("text") or ""
            if kind in (None, "scope"):
                continue
            side, note = CLAUSE_SIDE.get(kind, US), f"{c['id']} ({kind}): {body}"
            figures = {"type": kind, "days": c.get("days")}
            sentence = ""
            if kind == "price":
                sentence = (
                    "Our framework agreement fixes prices for each calendar year."
                    if "calendar year" in body
                    else "Our framework agreement sets out how prices may change."
                )
            elif kind == "index":
                moves = ev.series_moves(pkg, c.get("series"), e.get("data_month")) if c.get("series") else {}
                change = moves.get("change_12m_pct")
                side = US if change is not None and change < 0 else THEM
                sentence = "Our framework agreement ties the price to an agreed index formula."
                figures |= {"series": c.get("series"), "material_share": c.get("material_share")}
                figures |= {"deadband_pct": c.get("deadband_pct"), "series_change_12m_pct": change}
                note += f" The series moved {change:+.1f}% in 12 months." if change is not None else ""
            elif kind == "term":
                end, days = ev._date(k.get("valid_to")), c.get("days")
                if end and days:
                    deadline = end - timedelta(days=days)
                    figures |= {"valid_to": k.get("valid_to"), "notice_deadline": deadline.isoformat()}
                    note += f" To stop the renewal, notice by {deadline.isoformat()} " + (
                        "(still open: a credible exit)." if deadline >= as_of else "(passed: it renews)."
                    )
                sentence = "Our framework agreement renews only unless either side gives notice."
            elif kind == "payment":
                note += f" Our standard is {STANDARD_PAYMENT_DAYS} days; shorter terms are its benefit."
                sentence = "Our framework agreement sets the payment terms."
            elif kind == "quality":
                sentence = "Our framework agreement includes the quality agreement with its delivery target."
            elif kind == "delivery":
                sentence = "Our framework agreement sets the delivery terms and the standard lead time."
            out.append(_arg("contract_clause", part, [c["id"]], figures, sentence, False, side, note))
    return out


def _documents(pkg, sid, e):
    """Letters, e-mails, call and meeting notes, memos: what each says and which way it points."""
    out = []
    for d in e.get("documents", []):
        body, kind = d.get("text") or "", d.get("kind") or ""
        us, them = _signals(body)
        side = THEM if len(them) > len(us) else US
        note = f"{kind} {d.get('date')} by {d.get('author') or '?'}: {_plain(body)}"
        if us:
            note += f" [for us: {', '.join(us)}]"
        if them:
            note += f" [for them: {', '.join(them)}]"
        subject = " ".join((d.get("subject") or "").split())
        clean = subject and not any(ch.isdigit() for ch in subject)
        ours = str(d.get("author") or "").startswith("Hollerau")
        figures = {"doc_kind": kind, "date": d.get("date"), "signals_us": us, "signals_them": them}
        if d.get("asked_pct") is not None or d.get("asked_price") is not None:
            figures |= {k: d.get(k) for k in ("asked_pct", "asked_price", "effective_date", "notice_given_days")}
            note = (
                f"Price letter: asks {d.get('asked_pct')}% to EUR {d.get('asked_price')} "
                f"from {d.get('effective_date')}. " + note
            )
            out.append(_arg("price_letter", _first_part(d), [d["id"]], figures, "", False, THEM, note))
            continue
        if kind in ("call_note", "meeting_note"):
            what = "call" if kind == "call_note" else "meeting"
            sentence = f'We would also welcome your view on the points from our {what} about "{subject}" ({d["id"]}).'
            if HEDGED_SIGNS.search(body):
                sentence = (
                    f"In our {what} ({d['id']}) you told us your material is bought forward at fixed prices, "
                    "so recent index rises do not reach your cost yet."
                )
            elif not clean:
                sentence = ""
            out.append(_arg("call_note", _first_part(d), [d["id"]], figures, sentence, False, side, note))
            continue
        if kind == "memo":  # internal: never cited to the supplier
            out.append(_arg("correspondence", _first_part(d), [d["id"]], figures, "", False, side, "Internal. " + note))
            continue
        word = {"email": "e-mail", "rfq": "request for quotation"}.get(kind, kind or "message")
        sentence = f'We refer to {"our" if ours else "your"} {word} "{subject}" ({d["id"]}).' if clean else ""
        out.append(_arg("correspondence", _first_part(d), [d["id"]], figures, sentence, False, side, note))
    return out


def _history(pkg, sid, e):
    """Past renewals per part: what it asked against what it settled, and the notes on them."""
    out = []
    by_part = {}
    for r in e.get("negotiation_history", []):
        by_part.setdefault(r.get("part_id"), []).append(r)
    for part, events in by_part.items():
        priced = [r for r in events if r.get("asked_pct") is not None and r.get("settled_pct") is not None]
        if priced:
            asked = sum(r["asked_pct"] for r in priced) / len(priced)
            settled = sum(r["settled_pct"] for r in priced) / len(priced)
            last = priced[-1]
            note = (
                f"{len(priced)} renewals: asked {asked:+.1f}% on average, settled {settled:+.1f}% "
                f"(gap {asked - settled:.1f} pp); last {last.get('date')}: asked {last['asked_pct']:+.1f}%, "
                f"settled {last['settled_pct']:+.1f}%. "
                + ("It usually settles well below its ask." if settled < asked else "It usually gets what it asks.")
            )
            figures = {"events": [[r.get("event_id"), r.get("date"), r["asked_pct"], r["settled_pct"]] for r in priced]}
            figures |= {"mean_asked_pct": round(asked, 2), "mean_settled_pct": round(settled, 2)}
            side = US if settled < asked else THEM
            out.append(_arg("negotiation_pattern", part, [], figures, "", False, side, note, key=f"pattern {part}"))
        notes = {}
        for r in events:
            if (r.get("note") or "").strip():
                notes.setdefault(r["note"].strip(), []).append(r.get("event_id"))
        for text, events_ in notes.items():
            side = THEM if LOYALTY.search(text) else US
            note = f"Recorded on {len(events_)} event(s) ({', '.join(events_)}): {text}."
            out.append(_arg("negotiation_note", part, [], {"events": events_}, "", False, side, note, key=text))
    return out


def _sourcing(pkg, sid, e):
    """Relationship, tooling and alternatives per part."""
    out = []
    as_of = _as_of(e)
    for part, block in e.get("parts", {}).items():
        rows = block.get("sourcing", [])
        own = next((r for r in rows if r.get("supplier_id") == sid), None)
        others = [r for r in rows if r.get("supplier_id") != sid and r.get("status") in ("active", "qualified")]
        if own:
            since = ev._date(own.get("approved_since"))
            years = round((as_of - since).days / 365.25, 1) if since else None
            note = (
                f"Approved since {own.get('approved_since')} ({years} years), "
                f"status {own.get('status')}, quota {own.get('quota_pct')}%."
            )
            out.append(
                _arg(
                    "relationship",
                    part,
                    [part],
                    {"years": years, "quota_pct": own.get("quota_pct")},
                    "",
                    False,
                    THEM,
                    note,
                )
            )
            tooling = own.get("tooling_owner") or ""
            if tooling:
                ours = tooling.lower().startswith("hollerau")
                note = (
                    "We own the tooling: the part can move to another source."
                    if ours
                    else "It owns the tooling: moving the part needs new tooling."
                )
                out.append(_arg("tooling", part, [part], {"owner": tooling}, "", False, US if ours else THEM, note))
        if others:
            names = "; ".join(
                f"{r['supplier_id']} {r.get('name')} ({r.get('country')}, {r.get('status')}, "
                f"quota {r.get('quota_pct')}%)"
                for r in others
            )
            note = f"Other approved sources: {names}."
            figures = {"alternatives": [r["supplier_id"] for r in others]}
            out.append(_arg("sourcing_position", part, [part], figures, "", False, US, note))
        elif own:
            note = "No other approved source for this part: it is our single source."
            out.append(_arg("sourcing_position", part, [part], {"alternatives": []}, "", False, THEM, note))
    return out


def _price_trend(pkg, sid, e):
    """Its price conditions over time per part (not citable; its order lines are)."""
    out = []
    for part, block in e.get("parts", {}).items():
        conds = [r for r in block.get("price_history", []) if r.get("supplier_id") == sid and r.get("price")]
        if len(conds) < 2 or len({r["price_unit"] for r in conds}) != 1:
            continue
        first, last = conds[0], conds[-1]
        change = ev._pct(last["price"], first["price"])
        steps = ", ".join(f"{r['valid_from'][:4]} {r['price']:.2f}" for r in conds)
        side = THEM if change <= -FLAT_PCT else US
        note = f"Price{_per(last['price_unit'])}: {steps} ({change:+.1f}% since {first['valid_from'][:4]}). " + (
            "It has already cut its price over the years." if side == THEM else "Its price has not fallen."
        )
        figures = {"prices": [[r["valid_from"], r["price"]] for r in conds], "change_pct": change}
        out.append(_arg("price_trend", part, [], figures, "", False, side, note, key=f"trend {part}"))
    return out


def _rival_quotes(pkg, sid, e):
    """Other suppliers' latest quotes and current prices for its parts: checkable only when a case
    lists the quote (its refs or our alternative); citing it reveals it."""
    out = []
    for part, block in e.get("parts", {}).items():
        _price, _unit, own_pp, source = _current_price(sid, block)
        latest = {}
        for q in block.get("quotes", []):
            if q.get("supplier_id") != sid and q.get("unit_price"):
                latest[q["supplier_id"]] = q
        for q in latest.values():
            pp = ev.per_piece(q["unit_price"], q["price_unit"])
            diff = ev._pct(pp, own_pp) if own_pp else None
            note = (
                f"{q['supplier_id']} {q.get('name')} quoted EUR {q['unit_price']:.2f}{_per(q['price_unit'])} on "
                f"{q.get('quote_date')} ({q.get('incoterm') or '?'}, {q.get('payment_days')} days, lead time "
                f"{q.get('lead_time_days')} days, tooling {q.get('tooling_eur')})"
            )
            note += f"; {diff:+.1f}% against its own price ({source})." if diff is not None else "."
            note += " Checkable only when the case lists this quote."
            figures = {"unit_price": q["unit_price"], "price_unit": q["price_unit"], "supplier": q["supplier_id"]}
            figures |= {"date": q.get("quote_date"), "vs_its_price_pct": diff}
            side = US if diff is not None and diff < 0 else THEM
            out.append(_arg("rival_quote", part, [q["id"]], figures, "", False, side, note))
        for o in block.get("orders", []):
            if o.get("supplier_id") == sid or not o.get("latest"):
                continue
            pp = ev.per_piece(o["latest_price"], o["price_unit"])
            diff = ev._pct(pp, own_pp) if own_pp else None
            refs = [line["id"] for line in o["latest"]]
            note = (
                f"We also buy this part from {o['supplier_id']} at EUR {o['latest_price']:.2f}{_per(o['price_unit'])} "
                f"(order of {o.get('last_order')})"
            )
            note += f"; {diff:+.1f}% against its own price." if diff is not None else "."
            note += " Its order lines are citable as order history (same part); citing them reveals the rival's price."
            figures = {"unit_price": o["latest_price"], "price_unit": o["price_unit"], "supplier": o["supplier_id"]}
            figures["vs_its_price_pct"] = diff
            side = US if diff is not None and diff < 0 else THEM
            out.append(_arg("rival_price", part, refs, figures, "", False, side, note))
    return out


def _payment(pkg, sid, e):
    """How we pay it, and what its cash discount says about the value of cash to it."""
    out = []
    inv = e.get("invoices") or {}
    if inv.get("invoices"):
        avg = inv.get("avg_days_paid_after_due_last_12m")
        avg = inv.get("avg_days_paid_after_due") if avg is None else avg
        late = (avg or 0) > LATE_PAYMENT_DAYS or (inv.get("paid_over_10_days_late_pct") or 0) > 10
        note = (
            f"{inv['invoices']} invoices; we pay {avg} days after due on average (last 12 months), "
            f"{inv.get('paid_late_pct')}% late, {inv.get('paid_over_10_days_late_pct')}% over 10 days late, max "
            f"{inv.get('max_days_late')}; discounts taken {inv.get('discount_taken')} "
            f"({inv.get('discount_taken_after_period')} after the period); "
            f"short-paid {inv.get('short_paid_without_discount')}. "
            + ("It can complain that we pay late." if late else "We pay reliably: a fair customer.")
        )
        figures = {
            k: inv.get(k) for k in ("avg_days_paid_after_due", "avg_days_paid_after_due_last_12m", "paid_late_pct")
        }
        out.append(_arg("payment_behaviour", None, [], figures, "", False, THEM if late else US, note, key="invoices"))
    m = e.get("master") or {}
    if m.get("skonto_pct"):
        rate = skonto_rate(m.get("skonto_pct"), m.get("skonto_days"))
        note = (
            f"It offers {m['skonto_pct']}% cash discount for payment within {m.get('skonto_days')} days "
            f"(net {m.get('payment_days')}): cash is worth about {rate:.0%} a year to it - "
            "trade faster payment for price."
        )
        figures = {"skonto_pct": m["skonto_pct"], "skonto_days": m.get("skonto_days"), "implied_rate": round(rate, 3)}
        out.append(_arg("cash_discount", None, [], figures, "", False, US, note, key="skonto"))
    return out


def _health(pkg, sid, e):
    """Its finances from the public register (supplier_intel)."""
    i = e.get("intel") or {}
    if not i:
        return []
    credit, ago, equity = i.get("credit_index"), i.get("credit_index_12m_ago"), i.get("equity_ratio_pct")
    weak = bool(
        (credit and credit >= WEAK_CREDIT)
        or (credit and ago and credit - ago >= CREDIT_DROP)
        or (equity is not None and equity < WEAK_EQUITY)
    )
    note = (
        f"{i.get('legal_form')}, founded {i.get('founded')}, {i.get('owner_type')} owned"
        + (f" (parent {i['group_parent']})" if i.get("group_parent") else "")
        + f", {i.get('staff')} staff, turnover {i.get('turnover_eur') or i.get('turnover_band')}; equity ratio "
        f"{equity}%, credit index {credit} (12 months ago {ago}; higher is worse); audit {i.get('vda63_grade')}. "
        + (
            "Weak: it values cash and volume - and is a supply risk (stabilise cases charge for squeezing it)."
            if weak
            else "Sound: it can afford to walk away."
        )
    )
    figures = {"credit_index": credit, "credit_index_12m_ago": ago, "equity_ratio_pct": equity, "weak": weak}
    return [_arg("supplier_health", None, [sid], figures, "", False, US if weak else THEM, note, key="intel")]


def _dependency(pkg, sid, e):
    """Our spend against its turnover: how much it needs us."""
    spend = e.get("spend") or []
    turnover = (e.get("intel") or {}).get("turnover_eur")
    if not spend:
        return []
    year = max(r["fiscal_year"] for r in spend)
    ours = sum(r.get("spend_eur") or 0 for r in spend if r["fiscal_year"] == year)
    if not turnover:
        band = re.findall(r"\d+", str((e.get("intel") or {}).get("turnover_band") or ""))
        turnover = (int(band[0]) + int(band[1])) / 2 * 1e6 if len(band) >= 2 else None
    share = round(ours / turnover * 100, 1) if turnover else None
    note = f"Our spend {year}: EUR {ours:,.0f}" + (f", about {share}% of its turnover." if share is not None else ".")
    if share is not None:
        note += (
            " We are an important customer."
            if share >= BIG_SHARE_PCT
            else " We are a small customer to it."
            if share < SMALL_SHARE_PCT
            else ""
        )
    side = THEM if share is not None and share < SMALL_SHARE_PCT else US
    figures = {"fiscal_year": year, "spend_eur": round(ours, 2), "turnover_eur": turnover, "share_pct": share}
    return [_arg("dependency", None, [], figures, "", False, side, note, key="spend")]


def _market_news(pkg, sid, e):
    """Market news (no supplier): context only - the arena checks news as being about the supplier."""
    out = []
    for n in e.get("market_news", []):
        body = f"{n.get('headline') or n.get('subject') or ''}. {n.get('body') or n.get('text') or ''}"
        sign = PERCENT.search(body)
        side = THEM if sign and sign.group(1) == "+" else US
        note = f"{n.get('date')} market: {' '.join(body.split())} Do not cite it as about this supplier."
        out.append(_arg("market_news", None, [n["id"]], {"date": n.get("date")}, "", False, side, note))
    return out


KINDS = (
    _notice,
    _index,
    _should_cost,
    _scorecard,
    _quality_notifications,
    _orders,
    _forecast,
    _news,
    _clauses,
    _documents,
    _history,
    _sourcing,
    _price_trend,
    _rival_quotes,
    _payment,
    _health,
    _dependency,
    _market_news,
)
