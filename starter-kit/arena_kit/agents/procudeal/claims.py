"""Claims: one-sentence arguments, each with its figure next to the data IDs the arena checks.

Every figure is computed here from the data the way the arena checks it (api.md, "What counts"),
so a claim is never contradicted. The arena checks at most three per message; one per sentence.
"""

import logging
from dataclasses import dataclass, field

log = logging.getLogger("arena")
MIN_INDEX_FALL = -0.5  # % - smaller moves are not worth a claim
DATA_MONTH = "2026-09"  # the data package is as of 2026-09-30


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
    for make in (_notice, _index_falls, _should_cost, _scorecard, _forecast):
        try:
            bank += make(case, dossier, package, our_price_ref)
        except Exception:  # a broken claim must never cost the case
            log.exception("claim %s failed", make.__name__)
    seen, out = set(), []
    for c in sorted(bank, key=lambda c: -c.strength):
        if c.key not in seen and all(package.lookup(r) or r in case.get("facts", {}) for r in c.refs):
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
    return case.get("facts", {}).get(ref) or package.lookup(ref) or {}


def _notice(case, d, package, _):
    """A price letter that gives less notice than the contract requires."""
    doc = case.get("trigger_doc")
    letter = _fact(case, package, doc) if doc else {}
    if not d.contract_id or letter.get("supplier") != d.supplier_id or not letter.get("days"):
        return []
    clauses = [k for k in package.ids(d.contract_id + "#") if (_fact(case, package, k).get("type") == "price")]
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
    for part in case.get("parts", []):
        drivers = package.query("SELECT series_id, weight FROM cost_drivers WHERE part_id = ?", (part,))
        for drv in drivers:
            series = drv["series_id"]
            meta = (package.query("SELECT name FROM index_series WHERE id = ?", (series,)) or [{}])[0]
            rows = package.query(
                "SELECT id, month, value FROM index_values WHERE series_id = ? ORDER BY month DESC LIMIT 13",
                (series,),
            )
            if len(rows) < 2:
                continue
            last = rows[0]
            if not _recent(last["month"]):
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
    rows = package.query("SELECT id, supplier_id, unit_cost FROM should_cost WHERE part_id = ?", (case["parts"][0],))
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
    ids = package.ids(f"sc:{d.supplier_id.split(':')[1]}@")
    if not ids:
        return []
    ref = ids[-1]
    sc = _fact(case, package, ref)
    if case["buyer"].get("category_goal") == "quality_first" and sc.get("ppm"):
        text = f"Your rolling scorecard shows {int(sc['ppm'])} ppm defects ({ref})."
        return [Claim("quality_record", text, [ref], 6, {"ppm": sc["ppm"]})]
    if sc.get("otd_pct") is not None and sc["otd_pct"] < 90:
        text = f"Your rolling scorecard shows on-time delivery of {sc['otd_pct']:.1f}% ({ref})."
        return [Claim("delivery_record", text, [ref], 4, {"otd_pct": sc["otd_pct"]})]
    return []


def _forecast(case, d, package, _):
    out = []
    for part in case.get("parts", []):
        ids = package.ids(f"fc:{part.split(':')[1]}@")
        if not ids:
            continue
        ref = ids[-1]
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
