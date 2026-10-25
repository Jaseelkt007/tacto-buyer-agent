"""Fictional supplier economics. No buyer policy, dossier or scoring inputs."""

import itertools
import json
import math
from copy import deepcopy
from dataclasses import asdict, dataclass
from datetime import date


def finite_tree(value):
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("non-finite financial value")
    if isinstance(value, dict):
        for item in value.values():
            finite_tree(item)
    if isinstance(value, list):
        for item in value:
            finite_tree(item)


@dataclass(frozen=True)
class Profile:
    unit_cost: float
    annual_fixed_cost: float
    finance_rate: float
    minimum_margin: float
    opening_markup: float
    capacity: int
    normal_capacity: int
    overtime_per_unit: float
    commitment_credit: float
    hedge_until: str
    material_share: float
    unhedged_reserve: float
    hedged_index_reserve: float
    final_round: int
    priorities: str
    opening_email: str
    commitment_penalty: float = 0.0
    final_markup: float = 0.0
    concession_power: float = 1.0

    def __post_init__(self):
        finite_tree(asdict(self))
        for name in ("unit_cost", "capacity", "normal_capacity", "final_round"):
            if getattr(self, name) <= 0:
                raise ValueError(f"{name} must be positive")
        for name in (
            "annual_fixed_cost",
            "finance_rate",
            "opening_markup",
            "overtime_per_unit",
            "commitment_credit",
            "unhedged_reserve",
            "hedged_index_reserve",
            "commitment_penalty",
            "final_markup",
        ):
            if getattr(self, name) < 0:
                raise ValueError(f"{name} cannot be negative")
        if not 0 <= self.minimum_margin < 1 or not 0 <= self.material_share <= 1:
            raise ValueError("margin/share must be fractions")
        if self.commitment_credit >= self.unit_cost or self.normal_capacity > self.capacity:
            raise ValueError("invalid capacity or commitment credit")
        if self.final_markup > self.opening_markup or self.concession_power <= 0:
            raise ValueError("invalid concession schedule")
        date.fromisoformat(self.hedge_until)


@dataclass(frozen=True)
class Action:
    id: str
    kind: str
    terms_json: str
    public_reason: str

    @property
    def terms(self):
        return json.loads(self.terms_json)

    def view(self):
        return {"id": self.id, "kind": self.kind, "terms": self.terms, "reason": self.public_reason}


class SupplierPolicy:
    def __init__(self, context, profile):
        self.context, self.profile = deepcopy(context), profile
        self.standard = deepcopy(context["standard"])
        self.fields = context["negotiable"]
        for terms in self.combinations():
            self.complete(terms)

    def complete(self, terms):
        finite_tree(terms)
        out = {**self.standard, **self.context["fixed_terms"], **terms}
        for key in ("payment_days", "volume_per_year", "contract_months"):
            value = out[key]
            if isinstance(value, bool) or not isinstance(value, int | float) or value < 0:
                raise ValueError(f"invalid {key}")
        if out["volume_per_year"] <= 0 or out["contract_months"] <= 0:
            raise ValueError("positive volume and duration required")
        return out

    def combinations(self):
        fields = [f for f in self.fields if f != "unit_price"]
        options = [self.context["term_options"].get(f) or [self.standard[f]] for f in fields]
        return [dict(zip(fields, combo, strict=True)) for combo in itertools.product(*options)]

    def floor(self, terms):
        """Minimum cent price: production + reserve + cash funding + minimum gross margin."""
        t, p = self.complete(terms), self.profile
        volume, months = t["volume_per_year"], t["contract_months"]
        if volume > p.capacity:
            return None
        start = date.fromisoformat(t["effective_date"])
        end_month = start.year * 12 + start.month - 1 + int(months)
        end = date(end_month // 12, end_month % 12 + 1, 1)
        hedge_end = date.fromisoformat(p.hedge_until)
        covered_days = max(0, min((hedge_end - start).days + 1, (end - start).days))
        covered = covered_days / (end - start).days
        credit = p.commitment_credit * min(max(months - 12, 0) / 12, 1)
        penalty = p.commitment_penalty * max(months - 12, 0) / 12
        cost = p.unit_cost + p.annual_fixed_cost / volume - credit + penalty
        cost += p.overtime_per_unit * max(0, volume - p.normal_capacity) / volume
        if t.get("index_clause"):
            cost += p.unit_cost * p.material_share * p.hedged_index_reserve * covered
        else:
            cost += p.unit_cost * p.material_share * p.unhedged_reserve * (1 - covered)
        floor = cost * math.exp(p.finance_rate * t["payment_days"] / 360) / (1 - p.minimum_margin)
        return math.ceil((floor - 1e-10) * 100) / 100

    def feasible(self, terms):
        price = terms.get("unit_price")
        if isinstance(price, bool) or not isinstance(price, int | float) or not math.isfinite(price):
            return False
        floor = self.floor(terms)
        return floor is not None and price >= floor

    def opening(self):
        terms = {f: self.standard[f] for f in self.fields if f != "unit_price"}
        floor = self.floor(terms)
        if floor is None:
            raise ValueError("opening terms exceed supplier capacity")
        terms["unit_price"] = math.ceil(floor * (1 + self.profile.opening_markup) * 100) / 100
        return terms

    def menu(self, round_number, standing, buyer_sheets, final=False):
        actions = []

        def add(kind, terms, reason):
            if terms and not self.feasible(terms):
                raise ValueError("attempted to publish an infeasible supplier action")
            frozen = json.dumps(terms, sort_keys=True, allow_nan=False)
            if not any(a.kind == kind and a.terms_json == frozen for a in actions):
                actions.append(Action(f"a{len(actions)}", kind, frozen, reason))

        for terms in buyer_sheets:
            if self.feasible(terms):
                add("agree", terms, "We can agree to this package. Please confirm your order.")
        if final:
            add("walk", {}, "Our final offer was not accepted. We are ending this discussion.")
            return actions
        add("hold", standing, "Our current package remains available.")
        remaining = max(0, 1 - round_number / self.profile.final_round)
        p = self.profile
        markup = p.final_markup + (p.opening_markup - p.final_markup) * remaining**p.concession_power
        # Full discrete term domain: the model can choose meaningful terms, not just tone.
        for combination in self.combinations():
            floor = self.floor(combination)
            if floor is None:
                continue
            for concession in sorted({markup, p.final_markup + (markup - p.final_markup) / 2}):
                price = math.ceil(floor * (1 + concession) * 100 - 1e-8) / 100
                terms = {**combination, "unit_price": price}
                kind = "final" if round_number >= self.profile.final_round else "counter"
                add(kind, terms, "We can offer the attached package as a whole; its terms are linked.")
        if round_number >= self.profile.final_round:
            actions = [a for a in actions if a.kind != "hold"]
        return actions

    def supplier_view(self):
        return {
            "supplier_id": self.context["supplier_id"],
            "parts": self.context["parts"],
            "enquiry": {
                key: deepcopy(self.context[key]) for key in ("fixed_terms", "standard", "negotiable", "term_options")
            },
            "priorities": self.profile.priorities,
            "private_assumptions": asdict(self.profile),
        }
