"""Claims: one-sentence arguments, each with its figure next to the data IDs the arena checks.

Every figure is computed here from the data the way the arena checks it (api.md, "What counts"),
so a claim is never contradicted. The arena checks at most three per message; one per sentence.
"""

import logging
import re
import threading
from dataclasses import dataclass, field

from .dossier import HEDGED_SIGNS as HEDGED_NOTE
from .dossier import document, ids, lookup, query

log = logging.getLogger("arena")
MIN_INDEX_FALL = -0.5  # % - smaller moves are not worth a claim
DATA_MONTH = "2026-09"  # only when the data names no month at all (package v1 is as of 2026-09-30)
ORDER_LINES = 3  # order history: the most recent lines of this part from this supplier
NOTE_KINDS = ("call_note", "meeting_note")
SCHEDULE_KINDS = {"order_history", "call_note"}  # levers added with the v1.7 lever schedule
_MONTHS, _MONTHS_LOCK = {}, threading.Lock()
# Its own letter: "our nickel and alloys requirement is covered at fixed prices until March 2027."
HEDGE_LETTER = re.compile(r"our ([\w ,-]{1,60}?) requirement is covered at fixed prices until (\w+ \d{4})", re.I)
MONTHS = ("january february march april may june july august september october november december").split()


@dataclass
class Claim:
    kind: str
    sentence: str
    refs: list[str]
    strength: int  # higher first
    figures: dict = field(default_factory=dict)

    @property
    def key(self):
        return " ".join(sorted(self.refs))


def build_bank(case, dossier, package, our_price_ref=None):
    """Every claim the data supports against this supplier, strongest first."""
    if package is None or package.db is None:
        return []
    bank = []
    for make in (_notice, _hedge_letter, _index_falls, _should_cost, _scorecard, _forecast, _order_history, _call_note):
        try:
            bank += make(case, dossier, package, our_price_ref)
        except Exception:  # a broken claim must never cost the case
            log.exception("claim %s failed", make.__name__)
    seen, out = set(), []
    for c in sorted(bank, key=lambda c: -c.strength):
        if c.key not in seen and all(lookup(package, r) or r in case.get("facts", {}) for r in c.refs):
            seen.add(c.key)
            out.append(c)
    return out


def rival_claim(offer_id, unit_price):
    """Another bidder's offer in this session (RFQ): checked against its price, same part."""
    return Claim(
        "rival_offer",
        f"Another supplier has offered EUR {unit_price:.2f} per unit for this part ({offer_id}).",
        [offer_id],
        8,
        {"unit_price": unit_price},
    )


def _fact(case, package, ref):
    return case.get("facts", {}).get(ref) or lookup(package, ref) or {}


def data_month(package):
    """The latest month in the data: index values in the SQLite file and every `idx:` ID the package
    (or the Sunday release) exposes. Index windows must end within the 12 months before it."""
    key = id(package)
    with _MONTHS_LOCK:
        if key in _MONTHS and _MONTHS[key][0] is package:
            return _MONTHS[key][1]
    months = []
    try:
        months += [r["m"] for r in query(package, "SELECT max(month) AS m FROM index_values") if r.get("m")]
    except Exception:  # a package without the table
        log.exception("no index_values table")
    months += [i.rsplit("@", 1)[1][:7] for i in ids(package, "idx:") if "@" in i]
    months = [m for m in months if len(m) == 7 and m[4] == "-" and m.replace("-", "").isdigit()]
    month = max(months, default=DATA_MONTH)
    with _MONTHS_LOCK:
        _MONTHS[key] = (package, month)  # the package stays referenced, so its id is never reused
    return month


def _notice(case, d, package, _):
    """A price letter that gives less notice than the contract requires."""
    doc = case.get("trigger_doc")
    letter = _fact(case, package, doc) if doc else {}
    if not d.contract_id or letter.get("supplier") != d.supplier_id or not letter.get("days"):
        return []
    clauses = [k for k in ids(package, d.contract_id + "#") if (_fact(case, package, k).get("type") == "price")]
    out = []
    for clause in clauses:
        agreed = _fact(case, package, clause).get("days")
        if agreed and letter["days"] < agreed:
            out.append(
                Claim(
                    "notice_period",
                    f"Your letter gives {letter['days']} days' notice ({doc}), while our framework agreement "
                    f"requires {agreed} days ({clause}).",
                    [doc, clause],
                    7,
                    {"given": letter["days"], "agreed": agreed},
                )
            )
    return out


def _months_back(month, k):
    y, m = map(int, month.split("-"))
    m -= k
    while m <= 0:
        m, y = m + 12, y - 1
    return f"{y:04d}-{m:02d}"


def _index_falls(case, d, package, _):
    """For each cost driver of the part: its largest fall over any window of up to 12 months that
    ends at the series' latest month."""
    out = []
    latest = data_month(package)
    for part in case.get("parts", []):
        drivers = query(package, "SELECT series_id, weight FROM cost_drivers WHERE part_id = ?", (part,))
        for drv in drivers:
            series = drv["series_id"]
            meta = (query(package, "SELECT name FROM index_series WHERE id = ?", (series,)) or [{}])[0]
            rows = query(
                package,
                "SELECT id, month, value FROM index_values WHERE series_id = ? ORDER BY month DESC LIMIT 13",
                (series,),
            )
            if len(rows) < 2:
                continue
            last = rows[0]
            if not _recent(last["month"], latest):
                continue
            best = None
            for k in range(1, 13):
                prev = next((r for r in rows if r["month"] == _months_back(last["month"], k)), None)
                if prev and prev["value"]:
                    change = (last["value"] / prev["value"] - 1) * 100
                    if best is None or change < best[0]:
                        best = (change, prev)
            if best and round(best[0], 1) <= MIN_INDEX_FALL:
                change, prev = best
                name = meta.get("name") or series
                out.append(
                    Claim(
                        "index_change",
                        f"{name} changed {change:+.1f}% from {prev['month']} to {last['month']} "
                        f"({prev['id']}, {last['id']}).",
                        [prev["id"], last["id"]],
                        5 + (drv["weight"] or 0),
                        {"change_pct": round(change, 1), "weight": drv["weight"]},
                    )
                )
    return out


def _recent(month, latest=DATA_MONTH):
    y, m = map(int, month.split("-"))
    ly, lm = map(int, latest.split("-"))
    return (ly - y) * 12 + (lm - m) <= 11


def _should_cost(case, d, package, price_ref):
    if len(case.get("parts", [])) != 1:
        return []
    rows = query(package, "SELECT id, supplier_id, unit_cost FROM should_cost WHERE part_id = ?", (case["parts"][0],))
    row = next((r for r in rows if r["supplier_id"] == d.supplier_id), None) or next(
        (r for r in rows if not r["supplier_id"]), None
    )
    if not row or (price_ref and row["unit_cost"] >= 0.98 * price_ref):
        return []
    return [
        Claim(
            "should_cost",
            f"Our bottom-up cost model puts the full cost of this part at EUR {row['unit_cost']:.2f} per unit "
            f"({row['id']}).",
            [row["id"]],
            6,
            {"unit_cost": row["unit_cost"]},
        )
    ]


def _scorecard(case, d, package, _):
    refs = ids(package, f"sc:{d.supplier_id.split(':')[1]}@")
    if not refs:
        return []
    ref = refs[-1]
    sc = _fact(case, package, ref)
    if case["buyer"].get("category_goal") == "quality_first" and sc.get("ppm"):
        text = f"Your rolling scorecard shows {int(sc['ppm'])} ppm defects ({ref})."
        return [Claim("quality_record", text, [ref], 6, {"ppm": sc["ppm"]})]
    if sc.get("otd_pct") is not None and sc["otd_pct"] < 90:
        text = f"Your rolling scorecard shows on-time delivery of {sc['otd_pct']:.1f}% ({ref})."
        return [Claim("delivery_record", text, [ref], 4, {"otd_pct": sc["otd_pct"]})]
    return []


def _hedge_letter(case, d, package, _):
    """Its own letter says its material is covered at fixed prices beyond the data month: the index
    rises in its quote do not reach its cost before then. The letter's date is the checked figure;
    the end of the cover sits in its own sentence without an ID."""
    rows = query(
        package,
        "SELECT id, date FROM documents WHERE supplier_id = ? AND kind = 'letter' ORDER BY date DESC, id DESC",
        (d.supplier_id,),
    )
    for row in rows:
        try:
            found = HEDGE_LETTER.search(" ".join(document(package, row["id"]).split()))
        except (FileNotFoundError, ValueError, UnicodeDecodeError):
            continue
        if not found:
            continue
        material, until = found.group(1).strip(), found.group(2)
        month, year = until.split()
        if month.lower() not in MONTHS or f"{year}-{MONTHS.index(month.lower()) + 1:02d}" <= data_month(package):
            continue  # the cover has run out: market moves reach its cost again
        text = (
            f"In your letter of {row['date']} ({row['id']}) you told us your {material} requirement is covered "
            f"at fixed prices. That cover runs until {until}, so the index rises in your quote do not reach "
            "your cost before then."
        )
        return [Claim("hedge", text, [row["id"]], 7, {"date": row["date"], "until": until, "material": material})]
    return []


def hedged_index(claim, hedge):
    """Is this index claim about the material its letter says is hedged? ("alloys" ~ "Alloy surcharge
    1.4404", "copper" ~ "Copper notation"): a word of the material, singular, in the claim."""
    words = {w.rstrip("s") for w in re.findall(r"[a-z]{4,}", hedge.figures.get("material", "").lower())}
    return claim.kind == "index_change" and any(w in claim.sentence.lower() for w in words)


def _forecast(case, d, package, _):
    out = []
    for part in case.get("parts", []):
        refs = ids(package, f"fc:{part.split(':')[1]}@")
        if not refs:
            continue
        ref = refs[-1]
        fc = _fact(case, package, ref)
        if fc.get("change_pct") and fc["change_pct"] > 0:
            out.append(
                Claim(
                    "volume_change",
                    f"Our demand forecast for this part has risen {fc['change_pct']:.1f}% ({ref}).",
                    [ref],
                    4,
                    {"change_pct": fc["change_pct"]},
                )
            )
    return out


def _order_history(case, d, package, price_ref):
    """Our latest orders of this part from this supplier, below its quote (v1.7). The arena checks
    the order prices: the figure is the recorded one, per the part's price unit."""
    if len(case.get("parts", [])) != 1 or not price_ref:
        return []
    part = case["parts"][0]
    rows = query(
        package,
        "SELECT id FROM po_lines WHERE supplier_id = ? AND part_id = ? ORDER BY order_date DESC, id DESC LIMIT ?",
        (d.supplier_id, part, ORDER_LINES),
    )
    facts = [(r["id"], _fact(case, package, r["id"])) for r in rows]
    facts = [(i, f) for i, f in facts if f.get("unit_price") and f.get("part") == part]
    if len(facts) < 2:
        return []
    prices = [f["unit_price"] for _, f in facts]
    units = {int(f.get("price_unit") or 1) for _, f in facts}
    if len(units) != 1 or max(prices) >= price_ref:  # no argument if we paid as much or more
        return []
    unit = units.pop()
    per = f" per {unit} units" if unit != 1 else " per unit"
    refs = [i for i, _ in facts]
    if len(set(prices)) == 1:
        text = f"Our last {len(refs)} orders for this part were at EUR {prices[0]:.2f}{per} ({', '.join(refs)})."
    else:  # several prices in one sentence could be read as one wrong figure: let the data speak
        text = f"Our recent orders for this part show the prices we have been paying ({', '.join(refs)})."
    return [Claim("order_history", text, refs, 3, {"unit_prices": prices})]


def _call_note(case, d, package, _):
    """A call or meeting note with this supplier (v1.7): context for the reader, not a check, so the
    sentence carries no figure at all. The most recent note first; a lever when nothing checkable is left."""
    rows = query(
        package,
        "SELECT id, kind, subject FROM documents WHERE supplier_id = ? AND kind IN (?, ?) ORDER BY date DESC, id DESC",
        (d.supplier_id, *NOTE_KINDS),
    )
    for row in rows:
        subject = " ".join((row.get("subject") or "").split())
        if not subject or any(ch.isdigit() for ch in subject):
            continue
        what = "call" if row["kind"] == "call_note" else "meeting"
        text = f'We would also welcome your view on the points from our {what} about "{subject}" ({row["id"]}).'
        try:
            if HEDGED_NOTE.search(document(package, row["id"])):
                text = (
                    f"In our {what} ({row['id']}) you told us your material is bought forward at fixed prices, "
                    "so recent index rises do not reach your cost yet."
                )
        except (FileNotFoundError, ValueError, UnicodeDecodeError):
            pass
        return [Claim("call_note", text, [row["id"]], 1)]
    return []
