"""stated_limit (N): a limit the supplier states in an open reply makes it ready like a final offer
(no arena, no quota). The phrases are from recorded supplier replies."""

import pytest

from arena_kit.agents.procudeal import policy as po
from arena_kit.agents.procudeal import signals as sg

# a small synthetic case (the same one the other procudeal tests use)
SID = "sup:T1"
CLAUSE = {"series": "AS-14404", "material_share": 0.45, "deadband_pct": 0, "base_month": "2026-08"}
OPENING = (
    "We offer a price of €6.05 per unit. Regarding our cost structure, AS-14404 rose 5.9 % in twelve months "
    "and is 45 % of our cost. Furthermore, LCI-C rose 2.7 % in twelve months and is 20 % of our cost."
)
CASE = {
    "case_id": "case:TB",
    "type": "renewal",
    "parts": ["part:T1"],
    "negotiable": ["unit_price", "payment_days", "index_clause"],
    "fixed_terms": {
        "volume_per_year": 90000,
        "contract_months": 24,
        "lead_time_days": 42,
        "incoterm": "DAP",
        "tooling_eur": 0,
        "ppm_commitment": 0,
    },
    "term_options": {"payment_days": [30, 60, 90], "index_clause": [None, CLAUSE, {**CLAUSE, "deadband_pct": 5}]},
    "round_limit": 10,
    "buyer": {
        "need_per_year": 90000,
        "horizon_years": 2,
        "current_unit_price": 5.45,
        "fallback_unit_price": 5.72,
        "interest_rate": 0.08,
        "reference_payment_days": 60,
        "need_lead_time_days": 42,
        "category_goal": "leverage",
        "fallback_risk_pct": 3,
        "index_paths": {"AS-14404": 0.06},
        "index_risk_pct": 1,
        "freight_eur_per_unit": {"EXW": 0.1, "FCA": 0.05, "DAP": 0.0},
        "must_haves": [],
        "alternative": {"kind": "none", "ref": None, "terms": {}},
    },
}


def msg(body=OPENING):
    return {
        "from": "sales@T1",
        "status": "open",
        "body": body,
        "attachments": [],
        "claim_results": [],
        "signals": {},
        "term_sheets": [
            {"term_sheet_id": "offer:T1-0", "terms": {"unit_price": 6.05, "payment_days": 30, "index_clause": None}}
        ],
    }


def side_for(case, events):
    n = po.Negotiator(case)
    n.setup({SID: events})
    return n, n.sides[SID]


LIMITS = [
    "Please note that this represents our limit under the requested 90-day payment terms.",
    "We appreciate your latest proposal, but we have reached the absolute limit of our flexibility.",
    "Thanks for the new offer, but we really cannot go below €45.50 for these terms.",
    "Like I said, without faster payment we just can't go below 45.50 EUR.",
    "€46.00 is the best we can do for 300 ppm and zero chargebacks.",
    "29.00 is the absolute bottom line for me.",
    "I can't go any lower than 29.50.",
]
NOT_LIMITS = [  # it went lower after each of these
    "Please understand that our flexibility is reaching its limit, and we ask you to move too.",
    "Please note that we are reaching the limit of our flexibility under these extended terms.",
    "However, the extended payment term of 90 days carries financing costs that limit our room.",
    "We can drop the price to 45.50 EUR for the 300 ppm.",
]


@pytest.mark.parametrize("text", LIMITS)
def test_limit_phrases(text):
    assert "limit" in sg.read({"body": text}).traits


@pytest.mark.parametrize("text", NOT_LIMITS)
def test_soft_phrases_are_not_limits(text):
    assert "limit" not in sg.read({"body": text}).traits


def ready_after(monkeypatch, body, on=True):
    monkeypatch.setattr(po, "FLAGS", po.parse_off("" if on else "stated_limit"))
    n, side = side_for(CASE, [msg()])
    side.ours, side.theirs = [5.10], [6.05, 5.80]  # far apart: no other reason to be ready
    reply = {**msg(body), "status": "open"}
    side.last = sg.read(reply)
    return n.ready(side, [msg(), reply])


def test_stated_limit_is_ready(monkeypatch):
    assert ready_after(monkeypatch, LIMITS[0]) == "it states its limit"


def test_stated_limit_off_keeps_negotiating(monkeypatch):
    assert not ready_after(monkeypatch, LIMITS[0], on=False)


def test_soft_phrase_keeps_negotiating(monkeypatch):
    assert not ready_after(monkeypatch, NOT_LIMITS[0])


def test_not_before_our_first_counter(monkeypatch):
    monkeypatch.setattr(po, "FLAGS", po.parse_off(""))
    n, side = side_for(CASE, [msg(LIMITS[0])])
    side.last = sg.read({"body": LIMITS[0]})
    assert not n.ready(side, [msg(LIMITS[0])])  # its opening quote is never taken as a limit
