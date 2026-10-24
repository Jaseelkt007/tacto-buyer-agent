"""Evidence: everything the data package knows about one supplier and the parts it supplies.

Every row keeps its citable ID where the table has one, so the zone 0 analysts can read it offline
and the argument library can cite it (docs/research.md). Deterministic and read-only: no arena, no
LLM. A missing table, column or file only leaves its section empty (logged at debug).
"""

import calendar
import logging
import re
from datetime import date
from functools import lru_cache
from pathlib import Path

from ..claims import _months_back, _recent, data_month
from ..dossier import DB_LOCK, document, ids, lookup

log = logging.getLogger("arena")

ROW_LIMIT = 100_000  # the package caps a query at 200 rows by default; evidence wants all of them
ON_TIME = (-5, 2)  # SCORECARD.md: posted from 5 days before to 2 days after the reference date
PEAK_MONTHS = 36  # "since the peak": the series' high over the last three years
WINDOW_MONTHS = 12  # the arena checks two index values at most 12 months apart
LATEST_LINES = 3  # order lines shown per supplier and part
ALIASES = {"sup:70210": ["sup:71999"]}  # KNOWN_ISSUES 5; read from the file when it is there
ALIAS_NOTE = re.compile(r"`?(sup:\d+)`?\s+is the old record of\s+`?(sup:\d+)`?")
PART_REF = re.compile(r"part:[\w-]+")

TOP_SECTIONS = (
    "master",
    "intel",
    "aliases",
    "contracts",
    "negotiation_history",
    "scorecards",
    "quality",
    "deliveries",
    "invoices",
    "spend",
    "documents",
    "related_documents",
    "news",
    "market_news",
)
PART_SECTIONS = (
    "sourcing",
    "should_cost",
    "drivers",
    "price_history",
    "quotes",
    "rfqs",
    "forecasts",
    "orders",
    "part_quality",
)
# What each specialist reads (docs/research.md); part sections render under a heading per part.
SLICES = {
    "economics": ["master", "should_cost", "drivers", "price_history", "quotes", "rfqs", "market_news"],
    "persona": ["master", "intel", "aliases", "documents", "related_documents", "news", "invoices"],
    "contract": ["master", "contracts", "negotiation_history", "sourcing", "spend", "rfqs"],
    "performance": ["scorecards", "quality", "part_quality", "deliveries", "forecasts", "orders"],
}


# --- access: the shared connection is used under the dossier's lock ---------------------------------


def rows(pkg, sql, params=()):
    """All rows of a query; a missing table or column gives none."""
    if getattr(pkg, "db", None) is None:
        return []
    try:
        with DB_LOCK:
            return pkg.query(sql, tuple(params), ROW_LIMIT)
    except Exception as exc:
        log.debug("evidence query failed: %s (%s)", exc, " ".join(sql.split())[:120])
        return []


def one(pkg, sql, params=()):
    return (rows(pkg, sql, params) or [{}])[0]


def fact(pkg, ref):
    """The checked fact behind an ID (facts.json, else its table row), or {}."""
    if not ref:
        return {}
    try:
        return lookup(pkg, ref) or {}
    except Exception as exc:
        log.debug("lookup %s failed: %s", ref, exc)
        return {}


def text(pkg, ref):
    """A document's full text, or "" when the file is missing."""
    try:
        return document(pkg, ref)
    except Exception as exc:
        log.debug("document %s unreadable: %s", ref, exc)
        return ""


def _safe(make, *args, default=list):
    try:
        return make(*args)
    except Exception:
        log.debug("evidence section %s failed", make.__name__, exc_info=True)
        return default()


def _marks(values):
    return ",".join("?" * len(values))


def _month(pkg):
    try:
        return data_month(pkg)
    except Exception:
        log.debug("no data month", exc_info=True)
        return "2026-09"


def window(month):
    """(start, end) of the 12 months up to the data month: start exclusive, end inclusive."""
    y, m = map(int, month.split("-"))
    end = date(y, m, calendar.monthrange(y, m)[1])
    start = date(y - 1, m, calendar.monthrange(y - 1, m)[1])
    return start.isoformat(), end.isoformat()


def _date(value):
    try:
        return date.fromisoformat(str(value)[:10])
    except (TypeError, ValueError):
        return None


def _gap(earlier, later):
    """Months from `earlier` to `later` (YYYY-MM)."""
    y1, m1 = map(int, earlier[:7].split("-"))
    y2, m2 = map(int, later[:7].split("-"))
    return (y2 - y1) * 12 + (m2 - m1)


def _pct(new, old, digits=1):
    try:
        return round((float(new) / float(old) - 1) * 100, digits) if old else None
    except (TypeError, ValueError):
        return None


def per_piece(price, unit):
    try:
        return float(price) / float(unit or 1)
    except (TypeError, ValueError):
        return None


def aliases(pkg, sid):
    """(old records merged into `sid`, the record `sid` was renamed to or None) - KNOWN_ISSUES 5."""
    pairs = []
    for root in (getattr(pkg, "root", None), getattr(pkg, "release", None)):
        try:
            pairs += ALIAS_NOTE.findall((Path(root) / "KNOWN_ISSUES.md").read_text(encoding="utf-8"))
        except (OSError, TypeError):
            pass
    if not pairs:
        pairs = [(old, new) for new, olds in ALIASES.items() for old in olds]
    return sorted({old for old, new in pairs if new == sid}), next((new for old, new in pairs if old == sid), None)


# --- index series ------------------------------------------------------------------------------------


@lru_cache(maxsize=256)
def series_values(pkg, series):
    """((month, value, id), ...) of one series, oldest first: the package and the Sunday release."""
    found = {}
    for r in rows(pkg, "SELECT id, month, value FROM index_values WHERE series_id = ?", (series,)):
        found[r["id"]] = (r["month"], r["value"])
    try:
        for ref in ids(pkg, f"idx:{series}@"):
            f = fact(pkg, ref)
            month = f.get("month") or ref.rsplit("@", 1)[1]
            found[ref] = (month[:7], f.get("value", (found.get(ref) or (None, None))[1]))
    except Exception:
        log.debug("idx ids for %s failed", series, exc_info=True)
    out = []
    for ref, (month, value) in found.items():
        try:
            out.append((month[:7], float(value), ref))
        except (TypeError, ValueError):
            continue
    return tuple(sorted(out))


def series_moves(pkg, series, month=None):
    """Where a series stands: latest value, 12-month change, peak and low over 36 months, the high of
    all the data, and its largest fall and rise over any window of up to 12 months ending at its
    latest month (only those windows are citable)."""
    month = month or _month(pkg)
    vals = series_values(pkg, series)
    if not vals:
        return {}
    last_m, last_v, last_id = vals[-1]
    out = {"last_month": last_m, "last_value": last_v, "last_id": last_id, "recent": _recent(last_m, month)}
    by_month = {m: (v, i) for m, v, i in vals}
    prev = by_month.get(_months_back(last_m, WINDOW_MONTHS))
    if prev and prev[0]:
        out |= {"from_12m_id": prev[1], "from_12m_value": prev[0], "change_12m_pct": _pct(last_v, prev[0])}
    recent = [(m, v, i) for m, v, i in vals if 0 <= _gap(m, last_m) <= PEAK_MONTHS]
    peak, low = max(recent, key=lambda x: x[1]), min(recent, key=lambda x: x[1])
    out |= {
        "peak_month": peak[0],
        "peak_value": peak[1],
        "peak_id": peak[2],
        "change_from_peak_pct": _pct(last_v, peak[1]),
        "low_month": low[0],
        "low_value": low[1],
        "low_id": low[2],
        "change_from_low_pct": _pct(last_v, low[1]),
    }
    top = max(vals, key=lambda x: x[1])  # the high of all the data (the 2022 energy peak, say)
    out |= {"top_month": top[0], "top_value": top[1], "top_id": top[2], "change_from_top_pct": _pct(last_v, top[1])}
    windows = [(_pct(last_v, v), m, v, i) for m, v, i in vals if 1 <= _gap(m, last_m) <= WINDOW_MONTHS and v]
    if windows:
        fall, rise = min(windows), max(windows)
        out |= {
            "max_fall_pct": fall[0],
            "max_fall_from_id": fall[3],
            "max_rise_pct": rise[0],
            "max_rise_from_id": rise[3],
        }
    return out


# --- one part ----------------------------------------------------------------------------------------


def part_evidence(pkg, part, month=None):
    """Everything about one part: master row, sourcing, should-cost, cost drivers with index moves,
    price history, quotes, RFQs, forecasts, orders and quality per supplier."""
    month = month or _month(pkg)
    out = {"part": one(pkg, "SELECT * FROM parts WHERE id = ?", (part,)) or {"id": part}}
    for name, make in (
        ("sourcing", _sourcing),
        ("should_cost", _should_cost),
        ("drivers", _drivers),
        ("price_history", _price_history),
        ("quotes", _quotes),
        ("rfqs", _rfqs),
        ("forecasts", _forecasts),
        ("orders", _orders),
        ("part_quality", _part_quality),
    ):
        out[name] = _safe(make, pkg, part, month)
    return out


def _sourcing(pkg, part, _):
    return rows(
        pkg,
        "SELECT s.supplier_id, u.name, u.country, s.status, s.quota_pct, s.approved_since, s.tooling_owner "
        "FROM sourcing s LEFT JOIN suppliers u ON u.id = s.supplier_id WHERE s.part_id = ? "
        "ORDER BY s.quota_pct DESC, s.supplier_id",
        (part,),
    )


def _should_cost(pkg, part, _):
    out = []
    for r in rows(pkg, "SELECT * FROM should_cost WHERE part_id = ? ORDER BY id", (part,)):
        f = fact(pkg, r["id"])
        out.append({**r, "checked_unit_cost": f.get("unit_cost")})
    return out


def _drivers(pkg, part, month):
    out = []
    drivers = rows(
        pkg,
        "SELECT d.series_id, s.name, d.weight, d.source AS estimate, s.unit, s.frequency, s.formula "
        "FROM cost_drivers d LEFT JOIN index_series s ON s.id = d.series_id WHERE d.part_id = ? "
        "ORDER BY d.weight DESC",
        (part,),
    )
    for d in drivers:
        out.append({**d, **series_moves(pkg, d["series_id"], month)})
    return out


def _price_history(pkg, part, _):
    out, last = [], {}
    for r in rows(
        pkg,
        "SELECT supplier_id, valid_from, valid_to, price, price_unit, currency, basis, event_id "
        "FROM price_conditions WHERE part_id = ? ORDER BY supplier_id, valid_from",
        (part,),
    ):
        prev = last.get((r["supplier_id"], r["price_unit"]))
        out.append({**r, "change_pct": _pct(r["price"], prev) if prev else None})
        last[(r["supplier_id"], r["price_unit"])] = r["price"]
    return out


def _quotes(pkg, part, _):
    return rows(
        pkg,
        "SELECT q.id, q.rfq_id, q.supplier_id, u.name, q.quote_date, q.unit_price, q.price_unit, q.currency, "
        "q.lead_time_days, q.incoterm, q.payment_days, q.validity_days, q.tooling_eur, q.awarded, "
        "q.missing_fields, q.remarks FROM quotes q LEFT JOIN suppliers u ON u.id = q.supplier_id "
        "WHERE q.part_id = ? ORDER BY q.quote_date, q.id",
        (part,),
    )


def _rfqs(pkg, part, _):
    return rows(pkg, "SELECT * FROM rfqs WHERE part_id = ? ORDER BY rfq_date, id", (part,))


def _forecasts(pkg, part, month):
    snaps = rows(
        pkg,
        "SELECT id, snapshot_month, horizon_months, qty_next_12m, uom, shared_with_suppliers "
        "FROM forecasts WHERE part_id = ? ORDER BY snapshot_month",
        (part,),
    )
    out = [{**s, "change_pct": fact(pkg, s["id"]).get("change_pct")} for s in snaps]
    if out:
        lines = rows(
            pkg, "SELECT target_month, qty FROM forecast_lines WHERE fc_id = ? ORDER BY target_month", (out[-1]["id"],)
        )
        start, end = window(month)
        ordered = one(
            pkg,
            "SELECT sum(qty) AS qty FROM po_lines WHERE part_id = ? AND requested_date > ? AND requested_date <= ?",
            (part, start, end),
        ).get("qty")
        out[-1] = {
            **out[-1],
            "months": ", ".join(f"{r['target_month']} {r['qty']}" for r in lines),
            "ordered_last_12m": ordered,  # the base of change_pct: next 12 months' forecast vs this
        }
    return out


def _orders(pkg, part, month):
    start, _end = window(month)
    out = []
    summary = rows(
        pkg,
        "SELECT supplier_id, count(*) AS lines, min(order_date) AS first_order, max(order_date) AS last_order, "
        "sum(qty) AS qty, sum(price_note = 'stale_condition') AS stale_lines, sum(change_type = 'rush') AS rush_lines, "
        "sum(change_type = 'change') AS changed_lines FROM po_lines WHERE part_id = ? GROUP BY supplier_id "
        "ORDER BY qty DESC",
        (part,),
    )
    for s in summary:
        sup = s["supplier_id"]
        latest = rows(
            pkg,
            "SELECT id, order_date, qty, price, price_unit, requested_date, first_confirmed_date, change_type, "
            "price_note FROM po_lines WHERE part_id = ? AND supplier_id = ? ORDER BY order_date DESC, id DESC LIMIT ?",
            (part, sup, LATEST_LINES),
        )
        first = one(
            pkg,
            "SELECT id, order_date, price, price_unit FROM po_lines WHERE part_id = ? AND supplier_id = ? "
            "ORDER BY order_date, id LIMIT 1",
            (part, sup),
        )
        by_year = rows(
            pkg,
            "SELECT substr(order_date, 1, 4) AS year, price_unit, count(*) AS lines, sum(qty) AS qty, "
            "min(price) AS min_price, max(price) AS max_price, round(sum(qty * price) / sum(qty), 2) AS avg_price "
            "FROM po_lines WHERE part_id = ? AND supplier_id = ? GROUP BY year, price_unit ORDER BY year",
            (part, sup),
        )
        qty_12m = one(
            pkg,
            "SELECT sum(qty) AS qty FROM po_lines WHERE part_id = ? AND supplier_id = ? AND order_date > ?",
            (part, sup, start),
        ).get("qty")
        trend = None
        if latest and first and first.get("price_unit") == latest[0].get("price_unit"):
            trend = _pct(latest[0]["price"], first["price"])
        out.append(
            {
                **s,
                "qty_last_12m": qty_12m,
                "first_price": first.get("price"),
                "latest_price": latest[0]["price"] if latest else None,
                "price_unit": latest[0]["price_unit"] if latest else None,
                "price_change_pct": trend,
                "by_year": by_year,
                "latest": latest,
            }
        )
    return out


def _part_quality(pkg, part, month):
    start, end = window(month)
    qns = rows(
        pkg,
        "SELECT supplier_id, count(*) AS qns, sum(supplier_caused) AS supplier_caused, "
        "sum(complaint_qty) AS complaint_qty, sum(cost_recharged_eur) AS recharged_eur, max(qn_date) AS last_qn "
        "FROM quality_notifications WHERE part_id = ? GROUP BY supplier_id",
        (part,),
    )
    received = {
        r["supplier_id"]: r["qty"]
        for r in rows(
            pkg,
            "SELECT supplier_id, sum(qty) AS qty FROM goods_receipts WHERE part_id = ? AND posting_date > ? "
            "AND posting_date <= ? GROUP BY supplier_id",
            (part, start, end),
        )
    }
    complained = {
        r["supplier_id"]: r["qty"]
        for r in rows(
            pkg,
            "SELECT supplier_id, sum(complaint_qty) AS qty FROM quality_notifications WHERE part_id = ? "
            "AND supplier_caused = 1 AND qn_date > ? AND qn_date <= ? GROUP BY supplier_id",
            (part, start, end),
        )
    }
    out = {r["supplier_id"]: dict(r) for r in qns}
    for sup in sorted(set(out) | set(received)):
        row = out.setdefault(sup, {"supplier_id": sup, "qns": 0})
        got, bad = received.get(sup) or 0, complained.get(sup) or 0
        row |= {"received_last_12m": got, "ppm_last_12m": round(bad / got * 1e6) if got else None}
        latest = rows(
            pkg,
            "SELECT id FROM quality_notifications WHERE part_id = ? AND supplier_id = ? ORDER BY qn_date DESC, id DESC "
            "LIMIT ?",
            (part, sup, LATEST_LINES),
        )
        row["latest_qns"] = [r["id"] for r in latest]
    return [out[s] for s in sorted(out)]


# --- one supplier ------------------------------------------------------------------------------------


def supplier_evidence(pkg, sid):
    """Every table row, letter, note and news item about one supplier and its parts, with IDs.
    Old vendor records of the same supplier (KNOWN_ISSUES 5) are merged into its history."""
    month = _month(pkg)
    old, new = aliases(pkg, sid)
    who = [sid, *old]
    ev = {"supplier": sid, "data_month": month}
    ev["master"] = _safe(lambda: one(pkg, "SELECT * FROM suppliers WHERE id = ?", (sid,)), default=dict)
    ev["name"] = ev["master"].get("name") or fact(pkg, sid).get("name") or ""
    ev["intel"] = _safe(lambda: one(pkg, "SELECT * FROM supplier_intel WHERE supplier_id = ?", (sid,)), default=dict)
    ev["aliases"] = _safe(_aliases, pkg, sid, old, new)
    names = [ev["name"]] + [a.get("name") for a in ev["aliases"] if a["id"] in old]
    ev["related_documents"] = _safe(_related_documents, pkg, who, names)
    ev["contracts"] = _safe(_contracts, pkg, who, ev["master"])
    parts = _safe(_supplier_parts, pkg, who, ev["contracts"])
    for d in ev["related_documents"]:  # an RFQ it is invited to: the part is in play
        if d.get("kind") == "rfq":
            parts = sorted(set(parts) | set(PART_REF.findall(str(d.get("part_ids") or ""))))
    ev["parts"] = {p: part_evidence(pkg, p, month) for p in parts}
    _safe(_clause_drivers, pkg, ev, month, default=lambda: None)
    for name, make in (
        ("negotiation_history", _negotiations),
        ("scorecards", _scorecards),
        ("quality", _quality),
        ("deliveries", _deliveries),
        ("invoices", _invoices),
        ("spend", _spend),
        ("documents", _documents),
        ("news", _news),
    ):
        default = dict if name in ("deliveries", "invoices") else list
        ev[name] = _safe(make, pkg, who, month, default=default)
    ev["market_news"] = _safe(
        lambda: rows(pkg, "SELECT * FROM news WHERE supplier_id IS NULL OR supplier_id = '' ORDER BY date, id")
    )
    _safe(_release, pkg, sid, ev, default=lambda: None)
    return ev


def _aliases(pkg, sid, old, new):
    out = []
    for ref in old:
        out.append(
            {**one(pkg, "SELECT * FROM suppliers WHERE id = ?", (ref,)), "id": ref, "relation": f"old record of {sid}"}
        )
    if new:
        out.append(
            {**one(pkg, "SELECT * FROM suppliers WHERE id = ?", (new,)), "id": new, "relation": "current record"}
        )
    return out


def _supplier_parts(pkg, who, contracts):
    q = _marks(who)
    found = set()
    for sql in (
        f"SELECT part_id AS p FROM sourcing WHERE supplier_id IN ({q})",
        f"SELECT DISTINCT part_id AS p FROM po_lines WHERE supplier_id IN ({q})",
        f"SELECT DISTINCT part_id AS p FROM quotes WHERE supplier_id IN ({q})",
        f"SELECT DISTINCT part_id AS p FROM price_conditions WHERE supplier_id IN ({q})",
        f"SELECT DISTINCT part_id AS p FROM negotiation_history WHERE supplier_id IN ({q})",
        f"SELECT DISTINCT part_id AS p FROM should_cost WHERE supplier_id IN ({q})",
        f"SELECT part_ids AS p FROM documents WHERE supplier_id IN ({q})",
    ):
        for r in rows(pkg, sql, who):
            found |= set(PART_REF.findall(str(r.get("p") or "")))
    for c in contracts:
        found |= set(c.get("parts") or [])
    return sorted(found)


def _contracts(pkg, who, master):
    found = rows(pkg, f"SELECT * FROM contracts WHERE supplier_id IN ({_marks(who)}) ORDER BY valid_from, id", who)
    known = {c["id"] for c in found}
    if master.get("contract_id") and master["contract_id"] not in known:
        found.append({"id": master["contract_id"], **fact(pkg, master["contract_id"])})
    out = []
    for c in found:
        clauses = [
            {k: v for k, v in r.items() if k != "contract_id"}
            for r in rows(pkg, "SELECT * FROM contract_clauses WHERE contract_id = ?", (c["id"],))
        ]
        clauses.sort(key=lambda r: tuple(int(x) if x.isdigit() else -1 for x in str(r.get("clause") or "").split(".")))
        body = text(pkg, c["id"])
        listed = re.search(r"^Parts:(.*)$", body, re.M)
        parts = PART_REF.findall(listed.group(1)) if listed else []
        out.append({**c, "parts": parts, "clauses": clauses, "text": body})
    return out


def _clause_drivers(pkg, ev, month):
    """An index clause ties a part's price to a series: add it to the part's drivers when missing."""
    for c in ev["contracts"]:
        for clause in c["clauses"]:
            if clause.get("type") != "index" or not clause.get("series"):
                continue
            for part in c["parts"] or list(ev["parts"]):
                block = ev["parts"].get(part)
                if block is None or any(d.get("series_id") == clause["series"] for d in block["drivers"]):
                    continue
                meta = one(
                    pkg, "SELECT name, unit, frequency, formula FROM index_series WHERE id = ?", (clause["series"],)
                )
                block["drivers"].append(
                    {
                        "series_id": clause["series"],
                        **meta,
                        "weight": clause.get("material_share"),
                        "estimate": f"index clause {clause['id']}",
                        **series_moves(pkg, clause["series"], month),
                    }
                )


def _negotiations(pkg, who, _):
    return rows(
        pkg, f"SELECT * FROM negotiation_history WHERE supplier_id IN ({_marks(who)}) ORDER BY part_id, date", who
    )


def _scorecards(pkg, who, _):
    return rows(pkg, f"SELECT * FROM scorecards WHERE supplier_id IN ({_marks(who)}) ORDER BY quarter", who)


def _quality(pkg, who, _):
    out = []
    for r in rows(
        pkg, f"SELECT * FROM quality_notifications WHERE supplier_id IN ({_marks(who)}) ORDER BY qn_date, id", who
    ):
        out.append({**r, "ppm": fact(pkg, r["id"]).get("ppm")})
    return out


def _delivery_stats(lines):
    """On-time share against the requested and the first confirmed date (KNOWN_ISSUES 1: three dates
    per line), lateness, early deliveries; one goods receipt is one line, as on the scorecard."""
    req, conf = [], []
    for g in lines:
        posted = _date(g["posting_date"])
        for ref, out in (("requested_date", req), ("first_confirmed_date", conf)):
            due = _date(g.get(ref))
            if posted and due:
                out.append((posted - due).days)
    if not req:
        return {}
    late = [d for d in req if d > ON_TIME[1]]
    return {
        "receipts": len(lines),
        "on_time_requested_pct": round(100 * sum(ON_TIME[0] <= d <= ON_TIME[1] for d in req) / len(req), 1),
        "on_time_confirmed_pct": round(100 * sum(ON_TIME[0] <= d <= ON_TIME[1] for d in conf) / len(conf), 1)
        if conf
        else None,
        "late_pct": round(100 * len(late) / len(req), 1),
        "early_pct": round(100 * sum(d < ON_TIME[0] for d in req) / len(req), 1),
        "avg_days_late_when_late": round(sum(late) / len(late), 1) if late else 0,
        "max_days_late": max(req),
    }


def _deliveries(pkg, who, month):
    start, end = window(month)
    q = _marks(who)
    lines = rows(
        pkg,
        "SELECT g.id, g.po_line_id, g.part_id, g.posting_date, g.qty, p.qty AS po_qty, p.requested_date, "
        "p.first_confirmed_date FROM goods_receipts g JOIN po_lines p ON p.id = g.po_line_id "
        f"WHERE g.supplier_id IN ({q}) ORDER BY g.posting_date, g.id",
        who,
    )
    if not lines:
        return {}
    recent = [g for g in lines if start < g["posting_date"][:10] <= end]
    per_line = {}
    for g in lines:
        got = per_line.setdefault(g["po_line_id"], [0, g["po_qty"] or 0, 0])
        got[0] += g["qty"] or 0
        got[2] += 1
    confirmed_late = sum(
        1
        for g in {g["po_line_id"]: g for g in lines}.values()
        if _date(g["first_confirmed_date"])
        and _date(g["requested_date"])
        and _date(g["first_confirmed_date"]) > _date(g["requested_date"])
    )
    open_orders = one(
        pkg,
        f"SELECT count(*) AS lines, sum(qty) AS qty FROM po_lines WHERE supplier_id IN ({q}) "
        "AND id NOT IN (SELECT po_line_id FROM goods_receipts)",
        who,
    )
    by_part = {}
    for g in recent:
        by_part.setdefault(g["part_id"], []).append(g)
    return {
        "note": "on time = posted 5 days before to 2 days after the date; requested vs first confirmed date "
        "differ by 10-30 points (KNOWN_ISSUES 1); partial deliveries count as separate receipts",
        "all": _delivery_stats(lines),
        "last_12m": _delivery_stats(recent),
        "po_lines_received": len(per_line),
        "partial_lines": sum(1 for v in per_line.values() if v[2] > 1),
        "over_delivered_lines": sum(1 for v in per_line.values() if v[0] > v[1]),
        "under_delivered_lines": sum(1 for v in per_line.values() if v[0] < v[1]),
        "qty_variance_pct": _pct(sum(v[0] for v in per_line.values()), sum(v[1] for v in per_line.values()), 2),
        "confirmed_later_than_requested_lines": confirmed_late,
        "open_order_lines": open_orders.get("lines"),
        "open_order_qty": open_orders.get("qty"),
        "by_part_last_12m": [{"part_id": p, **_delivery_stats(g)} for p, g in sorted(by_part.items())],
    }


def _invoices(pkg, who, month):
    start, _end = window(month)
    found = rows(
        pkg,
        "SELECT invoice_date, due_date, paid_date, amount_eur, paid_amount_eur, discount_taken "
        f"FROM invoices WHERE supplier_id IN ({_marks(who)})",
        who,
    )
    if not found:
        return {}
    skonto = one(pkg, "SELECT skonto_days, skonto_pct FROM suppliers WHERE id = ?", (who[0],))
    late, late_12m, disc_late, short = [], [], 0, 0
    for r in found:
        paid, due, issued = _date(r["paid_date"]), _date(r["due_date"]), _date(r["invoice_date"])
        if paid and due:
            late.append((paid - due).days)
            if str(r["invoice_date"]) > start:
                late_12m.append((paid - due).days)
        if r["discount_taken"] and paid and issued and skonto.get("skonto_days"):
            disc_late += (paid - issued).days > skonto["skonto_days"]
        if not r["discount_taken"] and r["paid_amount_eur"] is not None and r["amount_eur"]:
            short += r["paid_amount_eur"] < r["amount_eur"] * 0.999
    return {
        "invoices": len(found),
        "amount_eur": round(sum(r["amount_eur"] or 0 for r in found), 2),
        "unpaid": sum(1 for r in found if not r["paid_date"]),
        "avg_days_paid_after_due": round(sum(late) / len(late), 1) if late else None,
        "avg_days_paid_after_due_last_12m": round(sum(late_12m) / len(late_12m), 1) if late_12m else None,
        "paid_late_pct": round(100 * sum(d > 0 for d in late) / len(late), 1) if late else None,
        "paid_over_10_days_late_pct": round(100 * sum(d > 10 for d in late) / len(late), 1) if late else None,
        "max_days_late": max(late) if late else None,
        "discount_taken": sum(1 for r in found if r["discount_taken"]),
        "discount_taken_after_period": disc_late,
        "short_paid_without_discount": short,  # a possible dispute
    }


def _spend(pkg, who, _):
    return rows(pkg, f"SELECT * FROM spend_cube WHERE supplier_id IN ({_marks(who)}) ORDER BY fiscal_year", who)


def _documents(pkg, who, _):
    out = []
    for r in rows(pkg, f"SELECT * FROM documents WHERE supplier_id IN ({_marks(who)}) ORDER BY date, id", who):
        f = fact(pkg, r["id"])
        out.append(
            {
                **{k: v for k, v in r.items() if k != "file"},
                "notice_given_days": f.get("days"),
                "text": text(pkg, r["id"]),
            }
        )
    return out


@lru_cache(maxsize=8)
def _all_documents(pkg):
    return tuple((r, text(pkg, r["id"])) for r in rows(pkg, "SELECT * FROM documents ORDER BY date, id"))


def _related_documents(pkg, who, names):
    """Documents filed under another supplier that name this one (RFQ invitations, kit memos)."""
    keys = [n for n in names if n] + list(who)
    out = []
    for r, body in _all_documents(pkg):
        if r.get("supplier_id") in who:
            continue
        if any(k in body for k in keys):
            out.append({**{k: v for k, v in r.items() if k != "file"}, "text": body})
    return out


def _news(pkg, who, _):
    return rows(pkg, f"SELECT * FROM news WHERE supplier_id IN ({_marks(who)}) ORDER BY date, id", who)


def _release(pkg, sid, ev):
    """Sunday release items reach only the ID index: add its letters and news about this supplier
    (and market items without a supplier) that the tables above do not list."""
    listed = {r.get("id") for name in ("documents", "related_documents", "news", "market_news") for r in ev[name]}
    for prefix in ("doc:", "news:"):
        for ref in ids(pkg, prefix):
            if ref in listed:
                continue
            f = fact(pkg, ref)
            sup = f.get("supplier") or f.get("supplier_id") or None
            if sup not in (sid, None):
                continue
            row = {
                "id": ref,
                "date": f.get("date"),
                "kind": f.get("type") or f.get("kind") or f.get("topic") or f.get("table"),
                "supplier_id": sup,
                "subject": f.get("title") or f.get("subject") or f.get("headline"),
                "release": True,
                "text": text(pkg, ref),
            }
            for k in ("asked_pct", "asked_price", "effective_date", "days", "topic", "headline"):
                if f.get(k) not in (None, ""):
                    row[k] = f[k]
            if sup is None:
                ev["market_news"].append(row)
            elif prefix == "doc:":
                ev["documents"].append({**row, "notice_given_days": f.get("days")})
            else:
                ev["news"].append({**row, "body": row["text"]})


# --- render ------------------------------------------------------------------------------------------


HIDE = {"file"}  # table columns that only point at a file already read


def _value(v):
    if isinstance(v, float):
        return f"{v:.4f}".rstrip("0").rstrip(".")
    if isinstance(v, list):
        return ", ".join(_value(x) for x in v)
    return " ".join(str(v).split())


def _nested(v):
    return isinstance(v, dict) or (isinstance(v, list) and any(isinstance(x, (dict, list)) for x in v))


def _line(row, drop=None):
    """`[ID] key value; key value`; `drop` hides fields equal to the given value (the supplier itself)."""
    drop = drop or {}
    rid = row.get("id")
    body = "; ".join(
        f"{k} {_value(v)}"
        for k, v in row.items()
        if k not in ("id", "text", *HIDE)
        and v not in (None, "", [], {})
        and not _nested(v)
        and not (k in drop and drop[k] == v)
    )
    return f"[{rid}] {body}" if rid else body


def _block(value, indent="", drop=None):
    """One line per row; nested rows indented under it; a document's text in full below it."""
    if isinstance(value, list):
        return [line for item in value for line in _block(item, indent, drop)] or [indent + "(none)"]
    if not isinstance(value, dict):
        return [indent + _value(value)]
    out = []
    head = _line(value, drop)
    if head:
        out.append(indent + head)
    for k, v in value.items():
        if isinstance(v, dict) and v:
            out.append(f"{indent}  {k}: {_line(v, drop)}")
        elif _nested(v) and v:
            out.append(f"{indent}  {k}:")
            out += _block(v, indent + "    ", drop)
    if value.get("text") and not value.get("clauses"):  # a contract's clauses carry its text
        out += [indent + "    " + t for t in str(value["text"]).splitlines() if t.strip()]
    return out or [indent + "(none)"]


def _move(d, key, ref_key, label):
    if d.get(key) is None:
        return ""
    return f"{label} {d[key]:+.1f}% (from {d[ref_key]})"


def _drivers_block(drivers):
    """One compact line per cost driver: weight, latest value and its moves, with the index IDs."""
    out = []
    for d in drivers:
        parts = [
            f"[{d.get('series_id')}] {d.get('name') or ''}",
            f"weight {_value(d.get('weight'))} ({d.get('estimate') or 'estimate'})",
            f"unit {d.get('unit')}" if d.get("unit") else "",
            f"latest {_value(d.get('last_value'))} in {d.get('last_month')} ({d.get('last_id')})"
            + ("" if d.get("recent", True) else " - too old to cite"),
            _move(d, "change_12m_pct", "from_12m_id", "12 months"),
            _move(d, "max_fall_pct", "max_fall_from_id", "largest fall within 12 months")
            if (d.get("max_fall_pct") or 0) < 0
            else "",
            _move(d, "max_rise_pct", "max_rise_from_id", "largest rise within 12 months")
            if (d.get("max_rise_pct") or 0) > 0
            else "",
            _move(d, "change_from_peak_pct", "peak_id", f"since the {PEAK_MONTHS}-month peak")
            if d.get("peak_id")
            else "",
            _move(d, "change_from_low_pct", "low_id", f"since the {PEAK_MONTHS}-month low") if d.get("low_id") else "",
            _move(d, "change_from_top_pct", "top_id", "since the high of all the data")
            if d.get("top_id") and d.get("top_id") != d.get("peak_id")
            else "",
            f"formula {d['formula']}" if d.get("formula") else "",
        ]
        if d.get("last_value") is None:
            parts.append("no values in the data")
        out.append("; ".join(p for p in parts if p))
    return out or ["(none)"]


def _part_heading(part, block):
    row = dict(block.get("part") or {})
    desc = row.pop("description", "") or ""
    row.pop("id", None)
    return f"## {part} {desc} ({_line(row)})"


def render(evidence, sections=None):
    """Compact plain text for a prompt: a heading per section, one line per row, IDs in brackets.
    `sections` picks a subset (see SLICES); part sections render under a heading per part."""
    wanted = list(sections) if sections else list(TOP_SECTIONS + PART_SECTIONS)
    top = [s for s in wanted if s in TOP_SECTIONS]
    per_part = [s for s in wanted if s in PART_SECTIONS]
    drop = {"supplier_id": evidence.get("supplier")}
    head = (
        f"# Evidence: {evidence.get('supplier')} {evidence.get('name', '')} (data as of {evidence.get('data_month')})"
    )
    out = [head]
    for name in top:
        out += [f"## {name}", *_block(evidence.get(name) or [], drop=drop)]
    for part, block in (evidence.get("parts") or {}).items() if per_part else ():
        out.append(_part_heading(part, block))
        for name in per_part:
            lines = _drivers_block(block.get(name) or []) if name == "drivers" else _block(block.get(name) or [])
            out += [f"### {name}", *lines]
    return "\n".join(out)
