"""Supplier dossier: what the data package says about one supplier before the case starts.

Feeds the economics (its full cost and what money is worth to it) and the claims. Everything
here is read from the data by supplier and part; nothing depends on a case or supplier ID.
"""

import logging
import re
import threading
from dataclasses import dataclass, field

log = logging.getLogger("arena")
DB_LOCK = threading.Lock()  # one SQLite connection is shared by cases running in parallel


def query(package, sql, params=()):
    with DB_LOCK:
        return package.query(sql, params)


def document(package, ref):
    with DB_LOCK:
        return package.document(ref)


def ids(package, prefix):
    with DB_LOCK:  # the first call builds the package's ID index over the shared connection
        return package.ids(prefix)


def lookup(package, ref):
    with DB_LOCK:
        return package.lookup(ref)


# What a year of money is worth to a supplier, by owner type: groups finance cheaply, founders do not.
OWNER_RATE = {"group": 0.05, "private": 0.07, "family": 0.075, "founder": 0.10}
DEFAULT_RATE = 0.075
CASH_PREMIUM = 0.05  # a supplier that asks for faster payment values cash this much more
# Full cost relative to a German cost base (company policy, should-cost rule of thumb).
COUNTRY_COST = {"DE": 1.0, "AT": 1.05, "CH": 1.1, "CZ": 0.82, "PL": 0.82, "HU": 0.82, "TR": 0.75, "CN": 0.7}
# Without any should-cost estimate: assume the quote carries about this margin over full cost.
ASSUMED_MARGIN = 0.10
# Should-cost error bands (company.md): own plant about 5 %, German cost base 5-15 %.
OWN_PLANT_BAND, GENERIC_BAND = 0.95, 0.85
CASH_SIGNS = re.compile(
    r"overdue invoices|pay (?:our )?invoices|cash discount|liquidity|payment within \d+|pay(?:ing)? faster"
    r"|faster payment|cash flow|skonto",
    re.I,
)
# ("order intake" left out in v1.7: the data says "Order intake is very strong" of full suppliers)
WORK_SIGNS = re.compile(r"new customers|free capacity|short[- ]time work|utili[sz]ation (?:is )?low", re.I)
FULL_SIGNS = re.compile(
    r"capacity utili[sz]ation|cannot confirm your (?:full )?forecast|fully booked|at capacity", re.I
)
# Its material is bought forward at fixed prices: an index rise does not reach its cost yet (v1.7).
HEDGED_SIGNS = re.compile(r"bought (?:their|our) [\w ,-]{1,60} forward|covered at fixed prices|not our reality", re.I)
SKONTO_CAP = 0.20  # the cost of money a cash discount implies, at most (v1.7, rich_value)


@dataclass
class Dossier:
    supplier_id: str
    name: str = ""
    country: str = ""
    owner_type: str = ""
    contract_id: str = ""
    interest_rate: float = DEFAULT_RATE
    cash_need: bool = False
    wants_work: bool = False
    capacity_full: bool = False
    hedged: bool = False
    ppm: float | None = None  # its latest scorecard ppm
    skonto_rate: float = 0.0  # the cost of money its cash discount implies
    full_cost: float | None = None
    full_cost_source: str = "none"
    full_cost_floor: float = 0.0  # the estimate's error band: offers never push it below this
    rate_measured: bool = False  # measured_rate: interest_rate comes from its own sheets
    notes: list[str] = field(default_factory=list)

    def estimate(self, standard, rich=False):
        """The supplier estimate the kit's cost functions take. `rich` (v1.7): with its real ppm."""
        est = {"standard": standard or {}, "interest_rate": self.interest_rate, "full_cost": self.full_cost}
        if rich and self.ppm is not None:
            est["ppm"] = self.ppm
        return est

    def cap_by_quote(self, price, sustainable_pct=None):
        """quote_cap (v1.8): its opening quote leaves it at least the sustainable margin, so the quote
        caps the full cost. An assumption (it held in every practice case we could measure); later
        prices do not cap it, because suppliers do close below their full cost (P02 v1.4, clause)."""
        if not price:
            return
        share = 1 - (sustainable_pct if sustainable_pct is not None else 0.5) / 100
        capped = max(round(price * share, 2), self.full_cost_floor)
        if self.full_cost is None or capped < self.full_cost:
            self.full_cost = capped
            self.full_cost_source += "+quote cap"

    def bound_full_cost(self, price):
        """A supplier never sells below its floor, so every price it offers caps its full cost."""
        if price and (self.full_cost is None or price * 0.995 < self.full_cost):
            capped = max(round(price * 0.995, 2), self.full_cost_floor)
            if self.full_cost is None or capped < self.full_cost:
                self.full_cost = capped
                self.full_cost_source += "+bounded"


def build(case, supplier_id, package, quote_price=None, rich=False):
    """`rich` (v1.7, flag rich_value): its cost of money is at least what its cash discount implies."""
    d = Dossier(supplier_id)
    if package is None or package.db is None:
        d.full_cost, d.full_cost_source = _from_quote(quote_price)
        return d
    one = lambda sql, *p: (query(package, sql, p) or [{}])[0]  # noqa: E731
    s = one("SELECT name, country, contract_id, skonto_pct, skonto_days FROM suppliers WHERE id = ?", supplier_id)
    d.name, d.country, d.contract_id = s.get("name") or "", s.get("country") or "", s.get("contract_id") or ""
    d.owner_type = (
        one("SELECT owner_type FROM supplier_intel WHERE supplier_id = ?", supplier_id).get("owner_type") or ""
    )
    d.interest_rate = OWNER_RATE.get(d.owner_type, DEFAULT_RATE)
    d.skonto_rate = skonto_rate(s.get("skonto_pct"), s.get("skonto_days"))
    sc = one("SELECT ppm FROM scorecards WHERE supplier_id = ? ORDER BY quarter DESC LIMIT 1", supplier_id)
    d.ppm = sc.get("ppm")

    texts = []
    for row in query(package, "SELECT id, subject FROM documents WHERE supplier_id = ? ORDER BY date", (supplier_id,)):
        try:
            texts.append(f"{row['subject']}\n{document(package, row['id'])}")
        except (FileNotFoundError, ValueError):
            texts.append(row["subject"] or "")
    for row in query(package, "SELECT headline, body FROM news WHERE supplier_id = ?", (supplier_id,)):
        texts.append(f"{row['headline']}\n{row['body'] or ''}")
    blob = "\n".join(texts)
    d.cash_need = bool(CASH_SIGNS.search(blob))
    d.capacity_full = bool(FULL_SIGNS.search(blob))
    d.wants_work = bool(WORK_SIGNS.search(blob)) and not d.capacity_full  # a full plant does not look for work
    d.hedged = bool(HEDGED_SIGNS.search(blob))
    if d.cash_need:
        d.interest_rate += CASH_PREMIUM
        d.notes.append("asks for faster payment / cash")
    if rich and d.skonto_rate > d.interest_rate:
        d.notes.append(f"cash discount implies {d.skonto_rate:.0%} cost of money")
        d.interest_rate = d.skonto_rate
    if d.wants_work:
        d.notes.append("looks for work")
    if d.capacity_full:
        d.notes.append("capacity full")

    d.full_cost, d.full_cost_source = _full_cost(package, case, supplier_id, d.country)
    if d.full_cost is not None:  # suppliers do go below full cost (e.g. for a clause): keep the error band
        d.full_cost_floor = round(
            d.full_cost * (OWN_PLANT_BAND if "its plant" in d.full_cost_source else GENERIC_BAND), 2
        )
    if d.full_cost is None:
        d.full_cost, d.full_cost_source = _from_quote(quote_price)
    return d


def skonto_rate(pct, days):
    """The yearly cost of money a cash discount implies, halved and capped: `pct` % for paying within
    `days` days (days below 10 count as 10)."""
    try:
        pct, days = float(pct or 0), float(days or 0)
    except (TypeError, ValueError):
        return 0.0
    if pct <= 0:
        return 0.0
    return min(SKONTO_CAP, pct * 360 / max(days, 10) / 2 / 100)


def _full_cost(package, case, supplier_id, country):
    if len(case.get("parts", [])) != 1:
        return None, "none"
    part = case["parts"][0]
    rows = query(package, "SELECT id, supplier_id, unit_cost FROM should_cost WHERE part_id = ?", (part,))
    own = [r for r in rows if r["supplier_id"] == supplier_id]
    if own:
        return own[0]["unit_cost"], f"should-cost of its plant ({own[0]['id']})"

    generic = [r for r in rows if not r["supplier_id"]]
    if generic:
        factor = COUNTRY_COST.get(country, 1.0)
        return round(generic[0]["unit_cost"] * factor, 2), f"should-cost DE x {factor} ({generic[0]['id']})"
    return None, "none"


def _from_quote(price):
    if not price:
        return None, "none"
    return round(price * (1 - ASSUMED_MARGIN), 2), f"quote less {ASSUMED_MARGIN:.0%}"
