"""ProcuDeal v1.8: the rule-audit fixes (docs/findings.md section 10) on synthetic cases.

quote_cap, measured_rate and health_refresh are methods that work for any supplier from what its own
session shows; no practice supplier's measured number is in the code or in these tests' expectations.
"""

import copy

import pytest
from test_procudeal_v17 import CASE, SID, supplier_msg

from arena_kit.agents.procudeal import economics as eco
from arena_kit.agents.procudeal import policy as po
from arena_kit.agents.procudeal.dossier import Dossier
from arena_kit.cost import supplier_value


@pytest.fixture
def flags(monkeypatch):
    """Every flag on (whatever PROCUDEAL_OFF says); a test may switch some off."""
    monkeypatch.setattr(po, "FLAGS", dict.fromkeys(po.FEATURES, True))
    return po.FLAGS


STABILISE = copy.deepcopy(CASE)
STABILISE["buyer"].update(
    {"category_goal": "stabilise", "sustainable_margin_pct": 2.0, "relationship_eur_per_point": 20000}
)
STANDARD = {**CASE["fixed_terms"], "payment_days": 30, "contract_months": 24}


def sheet_pair(case, rate, price=44.0):
    """Its main sheet at 90 days and the alternative at 30 days that is worth the same to it at `rate`."""
    est = {"standard": STANDARD, "interest_rate": rate}
    main = {"unit_price": price, "payment_days": 90, "contract_months": 24}
    alt = {"payment_days": 30, "contract_months": 24}
    alt["unit_price"] = round(eco.price_for_value(case, alt, est, supplier_value(case, main, est)), 4)
    return main, alt


def two_sheet_msg(main, alt, n=0, body="We have reviewed your offer and can adjust our Angebot as follows."):
    m = supplier_msg(main["unit_price"], n=n, body=body, **{k: v for k, v in main.items() if k != "unit_price"})
    m["term_sheets"].append({"term_sheet_id": f"offer:T1-{n}-a", "terms": alt})
    return m


# ---------- measured_rate ----------
@pytest.mark.parametrize("rate", [0.03, 0.068, 0.12])
def test_implied_rate_recovers_the_rate_behind_two_sheets(rate):
    main, alt = sheet_pair(CASE, rate)
    assert eco.implied_rate(CASE, main, alt, STANDARD) == pytest.approx(rate, abs=2e-4)


def test_implied_rate_needs_sheets_that_differ_only_in_payment_days():
    main, alt = sheet_pair(CASE, 0.068)
    assert eco.implied_rate(CASE, main, {**alt, "contract_months": 36}, STANDARD) is None
    assert eco.implied_rate(CASE, main, {**main}, STANDARD) is None  # identical sheets say nothing


def test_measured_rate_replaces_the_owner_type_rule(flags):
    main, alt = sheet_pair(CASE, 0.068)
    n = po.Negotiator(CASE)
    n.decide({SID: [supplier_msg(45.0, payment_days=30, contract_months=24)]})
    side = n.sides[SID]
    assert not side.dossier.rate_measured
    events = [supplier_msg(45.0, payment_days=30, contract_months=24), {"from": "buyer", "term_sheets": []}]
    events.append(two_sheet_msg(main, alt, n=1))
    n.observe(side, events)
    assert side.dossier.rate_measured
    assert side.dossier.interest_rate == pytest.approx(0.068, abs=2e-3)  # its reference terms, not STANDARD
    rate = side.dossier.interest_rate
    side.last.asks.add("payment")
    n.react(side, events)  # a later ask for faster payment adds no premium on top of its own price for time
    assert side.dossier.interest_rate == rate


def test_measured_rate_off_keeps_the_rule(flags):
    flags["measured_rate"] = False
    main, alt = sheet_pair(CASE, 0.068)
    n = po.Negotiator(CASE)
    n.decide({SID: [supplier_msg(45.0, payment_days=30, contract_months=24)]})
    side, rule = n.sides[SID], n.sides[SID].dossier.interest_rate
    n.observe(
        side, [supplier_msg(45.0, payment_days=30, contract_months=24), {"from": "buyer"}, two_sheet_msg(main, alt, 1)]
    )
    assert side.dossier.interest_rate == rule and not side.dossier.rate_measured


# ---------- quote_cap ----------
def test_quote_cap_uses_the_sustainable_margin_and_the_floor():
    d = Dossier("sup:T1", full_cost=374.95, full_cost_floor=356.20)
    d.cap_by_quote(370.96, 0.5)
    assert d.full_cost == pytest.approx(369.11, abs=0.01)
    d = Dossier("sup:T1", full_cost=374.95, full_cost_floor=356.20)
    d.cap_by_quote(300.0, 0.5)
    assert d.full_cost == 356.20  # never below the should-cost band
    d = Dossier("sup:T1", full_cost=100.0)
    d.cap_by_quote(120.0, 2.0)
    assert d.full_cost == 100.0  # a quote far above the estimate caps nothing


def test_quote_cap_ignores_later_prices(flags):
    n = po.Negotiator(STABILISE)
    first = supplier_msg(45.0, payment_days=30, contract_months=24)
    n.decide({SID: [first]})
    side = n.sides[SID]
    cost = side.dossier.full_cost
    n.observe(side, [first, {"from": "buyer"}, supplier_msg(35.0, n=1, payment_days=30, contract_months=24)])
    assert side.dossier.full_cost == cost  # a low later price is no proof of a low full cost
    flags["quote_cap"] = False
    n = po.Negotiator(STABILISE)
    n.decide({SID: [first]})
    side = n.sides[SID]
    n.observe(side, [first, {"from": "buyer"}, supplier_msg(35.0, n=1, payment_days=30, contract_months=24)])
    assert side.dossier.full_cost < cost  # v1.7c: every price it offers caps the estimate


def test_c_open_has_no_phantom_relationship_charge(flags):
    """At its own quote the supplier keeps at least the sustainable margin, so C_open at setup equals the
    arena's C_open (no relationship charge) even when should-cost is above the quote."""
    case = copy.deepcopy(STABILISE)
    n = po.Negotiator(case)
    quote = supplier_msg(45.0, payment_days=30, contract_months=24)
    n.decide({SID: [quote]})
    side = n.sides[SID]
    side.dossier.full_cost = 47.0  # an estimate above the quote
    side.dossier.cap_by_quote(45.0, case["buyer"]["sustainable_margin_pct"])
    opening = {**side.reference, "unit_price": 45.0, "payment_days": 30, "contract_months": 24}
    with_estimate = eco.cost(case, opening, side.standard, side.estimate())
    assert with_estimate == pytest.approx(eco.cost(case, opening, side.standard), abs=1.0)


# ---------- health_refresh ----------
def test_health_price_follows_the_estimate(flags):
    main, alt = sheet_pair(STABILISE, 0.12, price=45.0)
    n = po.Negotiator(STABILISE)
    first = supplier_msg(45.0, payment_days=30, contract_months=24)
    n.decide({SID: [first]})
    side = n.sides[SID]
    n.observe(side, [first, {"from": "buyer"}, two_sheet_msg(main, alt, n=1)])
    assert side.dossier.rate_measured
    fresh = eco.cheapest_price(STABILISE, side.mix, side.standard, side.estimate())
    assert side.best_for_us == pytest.approx(fresh, abs=0.01)


@pytest.mark.parametrize("refresh", [True, False])
def test_health_price_after_a_lower_estimate(flags, refresh):
    """v1.7c bug: a lower price lowered the full-cost estimate, but the health price kept its setup value."""
    flags.update(quote_cap=False, measured_rate=False, health_refresh=refresh)
    n = po.Negotiator(STABILISE)
    first = supplier_msg(45.0, payment_days=30, contract_months=24)
    n.decide({SID: [first]})
    side = n.sides[SID]
    setup_cost, setup_best = side.dossier.full_cost, side.best_for_us
    n.observe(side, [first, {"from": "buyer"}, supplier_msg(38.0, n=1, payment_days=30, contract_months=24)])
    assert side.dossier.full_cost < setup_cost
    fresh = eco.cheapest_price(STABILISE, side.mix, side.standard, side.estimate())
    if refresh:
        assert side.best_for_us == pytest.approx(fresh, abs=0.01) and fresh < setup_best
    else:
        assert side.best_for_us == setup_best  # stale


# ---------- H1.3: the complete menu ----------
def test_menu_prices_every_allowed_mix():
    est = {"standard": STANDARD, "interest_rate": 0.07, "full_cost": 40.0}
    standing = {"unit_price": 45.0, "payment_days": 30, "contract_months": 24}
    rows = eco.menu(STABILISE, standing, STANDARD, est, band=(38.0, 42.0))
    opts = STABILISE["term_options"]
    assert len(rows) == len(opts["payment_days"]) * len(opts["contract_months"])
    assert {(r["terms"]["payment_days"], r["terms"]["contract_months"]) for r in rows} == {
        (p, m) for p in opts["payment_days"] for m in opts["contract_months"]
    }
    for r in rows:
        assert r["health_price"] == eco.cheapest_price(STABILISE, r["terms"], STANDARD, est)
        low, high = r["health_range"]
        assert low <= r["health_price"] <= high  # a higher full cost needs a higher healthy price
    best = [min(c for c in (r["c_at_equal"], r["c_at_health"]) if c is not None) for r in rows]
    assert best == sorted(best)


def test_menu_without_relationship_goal_has_no_health_price():
    est = {"standard": STANDARD, "interest_rate": 0.07, "full_cost": 40.0}
    rows = eco.menu(CASE, {"unit_price": 45.0, "payment_days": 30, "contract_months": 24}, STANDARD, est)
    assert rows and all("health_price" not in r for r in rows)
    same = next(r for r in rows if r["terms"] == {"payment_days": 30, "contract_months": 24})
    assert same["equal_value_price"] == pytest.approx(45.0, abs=0.01)  # its own terms: its own price


# ---------- phase 2: the labelled packet ----------
from arena_kit.agents.procudeal import context as cx  # noqa: E402


def test_verdicts_and_stock_lines_from_its_email():
    body = (
        "We checked the price history data you cited; it holds, but it does not change our calculation. "
        "We checked the volume change data you cited; it holds and we took it into account."
    )
    assert cx.verdicts(body) == {"order_history": "no change", "volume_change": "moved"}
    stock = next(iter(cx.STOCK), None)
    if stock:  # knowledge/stock_lines.json present
        line = stock.replace("#", "30")
        assert cx.marked_text(f"{line} Our copper cost is real.").startswith("~ ")


def test_packet_labels_options_and_ids(flags):
    n = po.Negotiator(STABILISE)
    first = supplier_msg(45.0, payment_days=30, contract_months=24)
    move = n.decide({SID: [first]})
    pk = cx.build(n, {SID: [first]}, move)
    body = pk["text"].split("## OPTIONS")[0]
    for line in body.splitlines():
        if line and not line.startswith(("## ", "a", "(", "  -", "Its side", "Prior")):
            assert line[:3] in ("[A]", "[D]", "[E]", "[S]", "[Z]") or line.startswith("[us]"), line
    assert "E0" in pk["options"] and pk["options"]["E0"]["rungs"]["engine"] == move["sheets"][0]["unit_price"]
    side = n.sides[SID]
    for oid, opt in pk["options"].items():
        if oid == "E0":
            continue
        health = eco.cheapest_price(STABILISE, opt["terms"], side.standard, side.estimate())
        assert all(p >= health - 0.01 for p in opt["rungs"].values())  # never a dominated price
    for c in pk["claims"].values():
        assert c in side.bank or c in (move.get("claims") or [])
    assert "back office" not in pk["text"].lower()


# ---------- phase 2: the tactician's answer, checked by code ----------
from arena_kit.agents.procudeal import tactician as ta  # noqa: E402


def _packet_and_engine(flags):
    n = po.Negotiator(STABILISE)
    first = supplier_msg(45.0, payment_days=30, contract_months=24)
    move = n.decide({SID: [first]})
    return n, cx.build(n, {SID: [first]}, move), move


def test_tactician_counter_uses_code_prices(flags):
    n, pk, engine = _packet_and_engine(flags)
    oid = next(o for o in pk["options"] if o != "E0")
    rung = next(iter(pk["options"][oid]["rungs"]))
    answer = {"read": "", "action": "counter", "option": oid, "rung": rung, "claims": ["nope"], "reason": "r"}
    answer["message"] = "Thank you for your offer; we propose the attached terms for a stable supply."
    move, why = ta.to_move(n, pk, answer, engine)
    assert move is not engine and why.startswith("ok")
    assert move["sheets"][0]["unit_price"] == round(pk["options"][oid]["rungs"][rung], 2)
    assert move["claims"] == [] and "nope" in move["why"]["claims_dropped"]


def test_tactician_invalid_answers_keep_the_engine_move(flags):
    n, pk, engine = _packet_and_engine(flags)
    bad = [
        {"action": "counter", "option": "o99", "rung": "health", "claims": []},
        {"action": "counter", "option": "E0", "rung": "made_up", "claims": []},
        {"action": "accept", "option": "offer:none", "rung": "", "claims": []},
        {"action": "walk", "option": "", "rung": "", "claims": []},
        None,
    ]
    for answer in bad:
        move, why = ta.to_move(n, pk, answer, engine)
        assert move is engine, why
    pk["status"] = "final_offer"
    move, _ = ta.to_move(n, pk, {"action": "counter", "option": "E0", "rung": "engine", "claims": []}, engine)
    assert move is engine  # never push past a final offer


# ---------- phase 3: the tactician in the live loop (a fake model, no API) ----------
import time as _time  # noqa: E402

from arena_kit.agents.procudeal import ProcuDealAgent  # noqa: E402


def _fake(answer_fn):
    def ask(packet, **_):
        return answer_fn(packet), 0.01, None

    return ask


def test_live_move_replaced_and_bookkept(flags, monkeypatch):
    def choose(pk):
        oid = next(o for o in pk["options"] if o != "E0" and pk["options"][o]["terms"]["contract_months"] == 36)
        rung = next(iter(pk["options"][oid]["rungs"]))
        return {"action": "counter", "option": oid, "rung": rung, "claims": [], "reason": "test"}

    monkeypatch.setattr(ta, "ask", _fake(choose))
    agent = ProcuDealAgent(complete=None)
    first = supplier_msg(45.0, payment_days=30, contract_months=24)
    decision = agent.decide(STABILISE, {SID: [first]})
    sheet = decision["message"]["term_sheets"][0]["terms"]
    side = agent.negotiator.sides[SID]
    assert sheet["contract_months"] == 36  # the model's option went out
    assert side.ours[-1] == sheet["unit_price"] and side.last_main == sheet
    assert side.mix["contract_months"] == 36  # the fallback continues on the terms we sent
    assert side.pending["price"] == sheet["unit_price"] and side.pending["keys"] == ()
    assert not side.kinds_used  # the engine's claims were undone, the model sent none
    entry = agent.trace[-1]
    assert entry["hybrid"]["used"] is True and entry["source"] == "engine"


def test_live_failure_sends_the_engine_move(flags, monkeypatch):
    first = supplier_msg(45.0, payment_days=30, contract_months=24)
    flags["tactician"] = False
    plain = ProcuDealAgent(complete=None).decide(STABILISE, {SID: [first]})
    flags["tactician"] = True
    monkeypatch.setattr(ta, "ask", lambda packet, **_: (None, 25.0, "no answer within 25s"))
    agent = ProcuDealAgent(complete=None)
    decision = agent.decide(STABILISE, {SID: [first]})
    assert decision["message"]["term_sheets"] == plain["message"]["term_sheets"]
    assert agent.trace[-1]["hybrid"]["used"] is False


def test_tactician_deadline_is_wall_clock(monkeypatch):
    def slow(*a, **k):
        _time.sleep(1.0)
        return {}

    monkeypatch.setattr(ta.llm, "ask", slow)
    t0 = _time.monotonic()
    answer, secs, err = ta.ask({"text": "x"}, timeout=0.2)
    assert answer is None and "0s" in err and _time.monotonic() - t0 < 0.6


def test_rungs_never_step_back(flags):
    n = po.Negotiator(STABILISE)
    first = supplier_msg(45.0, payment_days=30, contract_months=24)
    move = n.decide({SID: [first]})
    ours = move["sheets"][0]
    events = [
        first,
        {"from": "buyer", "term_sheets": [{"terms": ours}], "body": ""},
        supplier_msg(44.0, n=1, **{k: v for k, v in ours.items() if k != "unit_price"}),
    ]
    move = n.decide({SID: events})
    pk = cx.build(n, {SID: events}, move)
    side, est = n.sides[SID], n.sides[SID].estimate()
    last = side.pending["main"] if side.pending else ours  # our previous sheet (before this move)
    floor = cx.worth(STABILISE, last, last["unit_price"], est, {})
    for oid, opt in pk["options"].items():
        if oid == "E0":
            continue
        for price in opt["rungs"].values():
            assert cx.worth(STABILISE, opt["terms"], price, est, {}) >= floor - 1e-6
