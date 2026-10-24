"""ProcuDeal v1.7: flags, bug fixes and the changes A-H, on small synthetic cases (no arena, no quota)."""

import copy
import json
from pathlib import Path

import pytest

from arena_kit.agents.procudeal import claims as cl
from arena_kit.agents.procudeal import economics as eco
from arena_kit.agents.procudeal import policy as po
from arena_kit.agents.procudeal import quote as qt
from arena_kit.agents.procudeal import signals as sg
from arena_kit.agents.procudeal.dossier import skonto_rate
from arena_kit.cost import supplier_value, total_cost
from arena_kit.docs import quote_terms, read_document

FIXTURES = Path(__file__).parent / "fixtures"
PACKAGE = Path(__file__).resolve().parents[1] / "data" / "package"

CASE = {
    "case_id": "case:T17",
    "type": "renewal",
    "parts": ["part:T1"],
    "negotiable": ["unit_price", "payment_days", "contract_months"],
    "fixed_terms": {
        "volume_per_year": 4000,
        "lead_time_days": 42,
        "incoterm": "DAP",
        "index_clause": None,
        "tooling_eur": 0,
        "ppm_commitment": 0,
    },
    "term_options": {"payment_days": [14, 30, 60, 90], "contract_months": [12, 24, 36]},
    "round_limit": 10,
    "buyer": {
        "need_per_year": 4000,
        "horizon_years": 2,
        "current_unit_price": 43.20,
        "fallback_unit_price": 46.00,
        "interest_rate": 0.08,
        "reference_payment_days": 60,
        "need_lead_time_days": 42,
        "category_goal": "leverage",
        "fallback_risk_pct": 3,
        "freight_eur_per_unit": {"EXW": 1.90, "FCA": 1.20, "DAP": 0.0},
        "must_haves": [],
        "alternative": {"kind": "none", "ref": None, "terms": {}},
    },
}
SID = "sup:T1"


def supplier_msg(price, n=0, status="open", body="Thank you for your enquiry.", results=None, **terms):
    return {
        "from": "sales@T1",
        "status": status,
        "body": body,
        "term_sheets": [{"term_sheet_id": f"offer:T1-{n}", "terms": {"unit_price": price, **terms}}],
        "claim_results": results or [],
        "attachments": [],
        "signals": {"reply_delay_days": 3},
    }


def buyer_msg(price, body="", **terms):
    return {"from": "buyer", "body": body, "term_sheets": [{"terms": {"unit_price": price, **terms}}], "refs": []}


@pytest.fixture
def flags(monkeypatch):
    """All v1.7 flags on (whatever PROCUDEAL_OFF says); a test may switch some off."""
    monkeypatch.setattr(po, "FLAGS", dict.fromkeys(po.FEATURES, True))
    return po.FLAGS


def claim(kind, ref, strength=5):
    return cl.Claim(kind, f"A {kind} argument ({ref}).", [ref], strength)


# ---------- flags ----------
def test_procudeal_off_parsing():
    assert po.parse_off("") == dict.fromkeys(po.FEATURES, True)
    got = po.parse_off(" single_sheet , patience,,nonsense ")
    assert not got["single_sheet"] and not got["patience"] and got["lever_schedule"]
    assert set(got) == set(po.FEATURES)


def test_trace_records_flags(flags):
    from arena_kit.agents.procudeal import ProcuDealAgent

    flags["patience"] = False
    agent = ProcuDealAgent(complete=None)
    agent.decide(CASE, {SID: [supplier_msg(44.0, payment_days=30, contract_months=12)]})
    assert agent.trace[0]["features_off"] == ["patience"] and agent.trace[0]["source"] == "engine"


# ---------- bug fixes ----------
def test_tolerant_quote_parser_keeps_good_lines():
    text = read_document("quote.pdf", (FIXTURES / "quote.pdf").read_bytes())
    assert qt.sections(text) == quote_terms(text)  # same result as the kit on a clean quote
    broken = text.replace("Payment terms (days net) 30", "Payment terms (days net) thirty")
    with pytest.raises(ValueError):
        quote_terms(broken)
    got = qt.sections(broken)
    assert "payment_days" not in got["standard"] and got["standard"]["ppm_commitment"] == 900
    assert got["fixed"]["volume_per_year"] == 4000 and got["stated"]["unit_price"] == 43.2


def test_unknown_incoterm_counts_as_costliest():
    events = [{"from": "s", "attachments": [{"name": "quote.pdf", "text": "Our standard terms\nIncoterm CIF Hamburg"}]}]
    assert qt.standard_terms(CASE, events) == {"incoterm": "EXW"}


class FakePackage:
    db = object()

    def __init__(self, sql_month, ids):
        self.sql_month, self._ids = sql_month, ids

    def query(self, sql, params=()):
        return [{"m": self.sql_month}]

    def ids(self, prefix):
        return sorted(i for i in self._ids if i.startswith(prefix))


def test_data_month_comes_from_the_data():
    assert cl.data_month(FakePackage("2026-09", ["idx:A@2026-08", "idx:B@2026-09"])) == "2026-09"
    # a release that extends a series moves the data month on
    assert cl.data_month(FakePackage("2026-09", ["idx:A@2026-10", "doc:x"])) == "2026-10"
    assert cl._recent("2025-11", "2026-10") and not cl._recent("2025-10", "2026-10")


def test_claims_and_price_roll_back_after_a_late_send(flags):
    n = po.Negotiator(CASE)
    threads = {SID: [supplier_msg(44.0, payment_days=30, contract_months=12)]}
    n.setup(threads)
    side = n.sides[SID]
    side.bank = [claim("should_cost", "cost:T1"), claim("volume_change", "fc:T1@2026-09")]
    move = n.decide(threads)
    assert side.ours == [move["why"]["price"]] and len(move["claims"]) == 2
    # the kit appends our late message and the arena's answer (play.RemoteTable.missed)
    late = {
        "from": "arena",
        "status": "open",
        "body": "(late)",
        "term_sheets": [{"term_sheet_id": "offer:T1-0", "terms": {}}],
    }
    threads[SID] += [{**buyer_msg(move["why"]["price"]), "from": "buyer"}, late]
    again = n.decide(threads)
    assert side.ours == [again["why"]["price"]]  # the late price was taken back
    assert {c.key for c in again["claims"]} == {"cost:T1", "fc:T1@2026-09"}  # unused again, sent again


def test_resume_rebuilds_the_negotiation():
    threads = {
        SID: [
            supplier_msg(44.0, payment_days=30, contract_months=12),
            buyer_msg(36.0, "Our data (cost:T1) shows ...", payment_days=60, contract_months=24),
            supplier_msg(42.0, 1, payment_days=60, contract_months=24),
            buyer_msg(37.5, payment_days=60, contract_months=24),
            supplier_msg(41.0, 2, payment_days=60, contract_months=24),
        ]
    }
    n = po.Negotiator(CASE)
    n.setup(threads)
    side = n.sides[SID]
    assert side.ours == [36.0, 37.5] and len(side.theirs) == 3 and side.replies == 3
    move = n.decide(threads)
    assert 37.5 <= move["why"]["price"] < 41.0  # goes on from our last offer, not from the anchor


# ---------- A: lever schedule ----------
def test_lever_schedule_one_new_kind_per_round(flags):
    n = po.Negotiator(CASE)
    n.setup({SID: [supplier_msg(44.0)]})
    side = n.sides[SID]
    side.bank = [
        claim("index_change", "idx:A@2025-09", 7),
        claim("index_change", "idx:B@2025-09", 6),
        claim("should_cost", "cost:T1", 6),
        claim("delivery_record", "sc:T1@2026Q3", 4),
        claim("order_history", "po:1", 3),
        claim("call_note", "doc:N1", 1),
    ]
    first = n.pick_claims(side, [])
    assert [c.kind for c in first] == ["index_change", "should_cost", "delivery_record"]
    side.ours.append(30.0)
    later = [n.pick_claims(side, []) for _ in range(3)]
    assert [[c.kind for c in round_] for round_ in later] == [["order_history"], ["call_note"], []]
    assert not n.fresh_lever(side)


def test_dead_kind_is_dropped_for_the_case(flags):
    n = po.Negotiator(CASE)
    n.setup({SID: [supplier_msg(44.0)]})
    side = n.sides[SID]
    side.sent_claims = [claim("index_change", "idx:A@2025-09"), claim("should_cost", "cost:T1")]
    n.read_results(side, {"claim_results": [{"index": 0, "result": "irrelevant"}, {"index": 1, "result": "verified"}]})
    assert n.dead_kinds == {"index_change"}
    assert not n.lever_ok(side, claim("index_change", "idx:C@2025-09"), [])


# ---------- B: one main sheet + need trade ----------
def test_single_sheet_with_one_need_trade(flags):
    n = po.Negotiator(CASE)
    asks_payment = "Faster payment is welcome; we can reflect it in the price."
    threads = {SID: [supplier_msg(44.0, body=asks_payment, payment_days=60, contract_months=24)]}
    n.decide(threads)
    side = n.sides[SID]
    side.dossier.interest_rate = 0.20  # cash is dear for it: paying early is worth more to it than to us
    main = {"unit_price": 40.0, "payment_days": 60, "contract_months": 24}
    trade, why = n.need_trade(side, main)
    changed = [k for k in main if k != "unit_price" and main[k] != trade[k]]
    assert changed == ["payment_days"] and trade["payment_days"] < 60  # one field, faster payment
    est = side.estimate()
    assert supplier_value(CASE, trade, est) == pytest.approx(supplier_value(CASE, main, est), abs=0.02)
    assert total_cost(CASE, trade) < total_cost(CASE, main) - po.TRADE_GAIN
    assert why["field"] == "payment_days" and ("payment_days", trade["payment_days"]) in side.trades
    again = n.need_trade(side, main)  # never the same trade twice
    assert again is None or again[0]["payment_days"] != trade["payment_days"]


def test_no_menu_without_a_need(flags):
    n = po.Negotiator(CASE)
    threads = {SID: [supplier_msg(44.0, payment_days=60, contract_months=24)]}
    assert len(n.decide(threads)["sheets"]) == 1
    flags["single_sheet"] = False
    assert len(po.Negotiator(CASE).decide(threads)["sheets"]) > 1  # v1.6c: equal-cost packages


# ---------- C: strict accept ----------
def test_strict_accept_waits_while_a_lever_is_left(flags):
    n = po.Negotiator(CASE)
    events = [supplier_msg(44.0), buyer_msg(40.0), supplier_msg(40.1, 1)]
    n.setup({SID: events[:1]})
    side = n.sides[SID]
    side.ours, side.theirs = [40.0], [44.0, 40.1]
    side.bank = [claim("should_cost", "cost:T1")]
    assert n.ready(side, events) is False
    side.used.add("cost:T1")
    assert n.ready(side, events) == "within half a percent of our offer"
    flags["strict_accept"] = False
    side.used.clear()
    assert n.ready(side, events) == "within half a percent of our offer"


# ---------- D: proactive clause ----------
P02_OPENING = (
    "We offer a price of €370.96 per unit, Zahlungsziel 30 days net, no Preisgleitklausel. Regarding our cost "
    "structure, CU-NOTATION rose 47.7 % in twelve months and is 20 % of our cost. Furthermore, LCI-C rose 2.7 % "
    "in twelve months and is 20 % of our cost."
)
CLAUSES = [
    {"series": "CU-NOTATION", "material_share": 0.2, "deadband_pct": d, "base_month": "2026-08"} for d in (0, 3, 5)
]


def clause_case():
    c = copy.deepcopy(CASE)
    c["negotiable"] = ["unit_price", "payment_days", "index_clause"]
    c["fixed_terms"].pop("index_clause")
    c["fixed_terms"]["contract_months"] = 24
    c["term_options"] = {"payment_days": [30, 60, 90], "index_clause": [None, *CLAUSES]}
    c["buyer"].update(index_paths={"CU-NOTATION": 0.05}, index_risk_pct=4)
    return c


def test_driver_regex_and_negated_clause():
    drivers = sg.drivers({"body": P02_OPENING})
    assert [(d.series, d.rise_pct, d.share_pct) for d in drivers] == [("CU-NOTATION", 47.7, 20.0), ("LCI-C", 2.7, 20.0)]
    assert "clause" not in sg.read({"body": P02_OPENING}).asks  # "no Preisgleitklausel" is not an ask


def test_proactive_clause_widest_deadband_unless_hedged(flags):
    c = clause_case()
    strategic = copy.deepcopy(c)
    strategic["buyer"]["category_goal"] = "stabilise"
    n = po.Negotiator(strategic)
    n.setup({SID: [supplier_msg(370.96, body=P02_OPENING, payment_days=30)]})
    assert n.sides[SID].clause is None  # held at its health price, the clause would only cost us
    n = po.Negotiator(c)
    n.setup({SID: [supplier_msg(370.96, body=P02_OPENING, payment_days=30)]})
    side = n.sides[SID]
    assert side.clause == CLAUSES[2] and side.mix["index_clause"] == CLAUSES[2]
    assert side.driver.series == "CU-NOTATION"
    # its protection (0.2 x (47.7 - 5) %) beats our cost (0.2 x (0 + 4) %): a lower price on our mix
    assert eco.clause_value_rate(CLAUSES[2], side.driver) == pytest.approx(0.0854)
    assert eco.clause_cost_rate(c, CLAUSES[2]) == pytest.approx(0.008)
    hedged = po.Negotiator(c)
    hedged.setup({SID: [supplier_msg(370.96, body=P02_OPENING, payment_days=30)]})
    hedged.sides[SID].dossier.hedged = True
    quote = {"unit_price": 370.96, "payment_days": 30}
    assert hedged.clause_trade(hedged.sides[SID], {"body": P02_OPENING}, sg.Reading(), quote) == (None, None)
    flags["proactive_clause"] = False
    off = po.Negotiator(c)
    off.setup({SID: [supplier_msg(370.96, body=P02_OPENING, payment_days=30)]})
    assert off.sides[SID].clause is None and not off.sides[SID].mix.get("index_clause")


def test_clause_cost_rate_matches_cost_breakdown():
    c = clause_case()
    terms = {"unit_price": 100.0, "payment_days": 60}
    extra = eco.cost(c, {**terms, "index_clause": CLAUSES[0]}) - eco.cost(c, {**terms, "index_clause": None})
    units = 4000 * 2
    assert extra / units == pytest.approx(100.0 * eco.clause_cost_rate(c, CLAUSES[0]), rel=1e-6)


# ---------- E: friendly ties ----------
def test_friendly_tie_prefers_the_longest_contract():
    supplier = {"standard": {"payment_days": 60, "incoterm": "DAP"}, "interest_rate": 0.08}
    quote = {"unit_price": 43.20, "payment_days": 60, "contract_months": 24}
    plain = eco.plan_terms(CASE, quote, {}, supplier)
    friendly = eco.plan_terms(CASE, quote, {}, supplier, friendly=True)
    # 24 and 36 months cost the same over a 2-year horizon
    assert plain[0][1]["contract_months"] == 24 and friendly[0][1]["contract_months"] == 36
    assert friendly[0][0] <= plain[0][0] + max(eco.TIE_EUR, eco.TIE_SHARE * plain[0][0])


# ---------- F: patience ----------
def test_patience_budget_caps_concessions(flags):
    n = po.Negotiator(CASE)
    n.setup({SID: [supplier_msg(44.0, payment_days=30, contract_months=12)]})
    side = n.sides[SID]
    side.budget_share, side.ours, side.theirs = 0.25, [36.0, 37.5], [44.0, 43.0, 42.9]  # budget 0.25 x 8 = 2
    # 30 % of the gap would be +1.62; half of what is left of the budget (2.0 - 1.5) is 0.25
    assert n.next_price(side) == pytest.approx(37.75) and side.budget == pytest.approx(2.0)
    flags["patience"] = False
    assert n.next_price(side) == pytest.approx(37.5 + 0.3 * (42.9 - 37.5), abs=0.01)


def test_persona_anchor_floor_for_near_cost(flags):
    n = po.Negotiator(CASE)
    n.setup({SID: [supplier_msg(44.0, payment_days=60, contract_months=24)]})
    side = n.sides[SID]
    side.dossier.full_cost, side.dossier.full_cost_source = 43.5, "should-cost of its plant (cost:T1)"
    assert n.persona(side, {"unit_price": 44.0}) == ["near_cost"]


# ---------- G: silence ----------
def test_clarify_signal():
    assert (
        "clarify" in sg.read({"body": "We need to clarify this internally - we will come back to you on price."}).traits
    )
    assert "clarify" not in sg.read({"body": "We have clarified this internally and can move further."}).traits


def test_silence_resends_our_sheet_once(flags):
    n = po.Negotiator(CASE)
    threads = {SID: [supplier_msg(44.0, payment_days=60, contract_months=24)]}
    first = n.decide(threads)
    clarify = {**supplier_msg(44.0, 1), "body": "We need to clarify this internally.", "term_sheets": []}
    threads[SID] += [{**first, "from": "buyer", "term_sheets": [{"terms": first["sheets"][0]}]}, clarify]
    hold = n.decide(threads)
    assert hold.get("hold") and hold["sheets"] == [first["sheets"][0]] and hold["claims"] == []
    threads[SID] += [{"from": "buyer", "term_sheets": [{"terms": hold["sheets"][0]}]}, clarify]
    assert not n.decide(threads).get("hold")  # it still clarifies: we move again


# ---------- H: rich value ----------
def test_skonto_rate():
    assert skonto_rate(2, 10) == pytest.approx(0.20)  # 36 % halved, capped at 20 %
    assert skonto_rate(1, 30) == pytest.approx(0.06)
    assert skonto_rate(None, None) == 0.0 and skonto_rate(0, 14) == 0.0


def test_overtime_for_faster_delivery(flags):
    c = copy.deepcopy(CASE)
    c["negotiable"] = ["unit_price", "lead_time_days"]
    c["fixed_terms"].pop("lead_time_days")
    c["term_options"] = {"lead_time_days": [28, 42]}
    n = po.Negotiator(c)
    n.setup({SID: [supplier_msg(44.0, lead_time_days=42)]})
    side = n.sides[SID]
    est = side.estimate()
    slow, fast = {"unit_price": 40.0, "lead_time_days": 42}, {"unit_price": 40.0, "lead_time_days": 28}
    assert eco.value(c, slow, est) - eco.value(c, fast, est) == pytest.approx(40.0 * po.OVERTIME * 14)


# ---------- the real data package (skipped without it) ----------
@pytest.mark.skipif(not (PACKAGE / "world.sqlite").is_file(), reason="data package not unpacked")
def test_new_levers_on_the_data_package():
    from arena_kit.agents.procudeal.dossier import build
    from arena_kit.data import DataPackage

    package = DataPackage(PACKAGE)
    c = {**copy.deepcopy(CASE), "parts": ["part:310010"], "trigger_doc": None}
    d = build(c, "sup:70110", package, 138.55)
    bank = {x.kind: x for x in cl.build_bank(c, d, package, 138.55)}
    assert "order_history" in bank and all(r.startswith("po:") for r in bank["order_history"].refs)
    note = bank["call_note"]
    sentence = note.sentence.replace(note.refs[0], "")
    assert not any(ch.isdigit() for ch in sentence)  # context, not a check: no figure at all
    assert json.dumps(note.figures) == "{}"


def test_clause_that_breaks_a_must_have_is_not_proposed(flags):
    c = clause_case()
    c["buyer"]["must_haves"] = [{"field": "index_clause", "op": "==", "value": None}]
    n = po.Negotiator(c)
    n.setup({SID: [supplier_msg(370.96, body=P02_OPENING, payment_days=30)]})
    side = n.sides[SID]
    assert side.clause is None and side.driver is None and side.plan and side.mix["payment_days"] == 90


# ---------- review fixes ----------
def test_final_offer_is_never_pushed_after_a_new_offer_id(flags):
    """The arena gives every reply a new offer ID: a final offer that stands keeps its status."""
    n = po.Negotiator(CASE)
    final = supplier_msg(41.0, 1, status="final_offer", payment_days=60, contract_months=24)
    events = [supplier_msg(44.0), buyer_msg(38.0), final]
    n.setup({SID: events[:1]})
    side = n.sides[SID]
    n.observe(side, events)
    again = {**supplier_msg(41.0, 2, payment_days=60, contract_months=24), "status": "open"}
    events += [{"from": "buyer", "term_sheets": [], "body": po.KEEPALIVE_TEXT}, again]
    assert n.status(side, events) == "final_offer"
    flags["keepalive"] = False
    assert n.status(side, events) == "open"


def test_no_price_to_a_supplier_at_final_offer(flags):
    """RFQ, every thread ready, none acceptable: the agreed one may get a price, the final one never."""
    c = copy.deepcopy(CASE)
    c["buyer"]["alternative"] = {"kind": "quote", "ref": "quote:X", "terms": {"unit_price": 30.0}}
    final = {**supplier_msg(43.0, 1, status="final_offer"), "from": "sales@T1"}
    agreed = {**supplier_msg(43.5, 1, status="agreed"), "from": "sales@T2"}
    threads = {
        SID: [supplier_msg(44.0), buyer_msg(38.0), final],
        "sup:T2": [{**supplier_msg(44.5), "from": "sales@T2"}, buyer_msg(38.5), agreed],
    }
    for _ in range(3):
        move = po.Negotiator(c).decide(threads)
        assert move["supplier_id"] == "sup:T2" or move.get("action", {}).get("type") == "walk_away"


def test_rival_at_the_same_price_is_not_a_new_lever(flags):
    n = po.Negotiator(CASE)
    n.setup({SID: [supplier_msg(44.0)], "sup:T2": [supplier_msg(42.0)]})
    side = n.sides[SID]
    n.board = {
        "sup:T2": (300_000, "offer:T2-1", {"unit_price": 42.0}),
        SID: (330_000, "offer:T1-1", {"unit_price": 44.0}),
    }
    first = n.pick_claims(side, [], leader="sup:T2")
    assert [c.kind for c in first][:1] == ["rival_offer"]
    n.board["sup:T2"] = (300_000, "offer:T2-2", {"unit_price": 42.0})  # same price, new ID
    assert n.rival(side, "sup:T2") is None
    n.board["sup:T2"] = (299_000, "offer:T2-3", {"unit_price": 41.9})
    assert n.rival(side, "sup:T2") is not None


def test_keepalive_only_for_an_acceptable_ready_thread(flags):
    n = po.Negotiator(CASE)
    threads = {SID: [supplier_msg(44.0)], "sup:T2": [supplier_msg(42.0, status="agreed")]}
    n.setup(threads)
    n.rfq = True
    n.sides["sup:T2"].reply_at = 0.0  # waited for ever
    ready = {SID: False, "sup:T2": "agreed"}
    n.acceptable = set()
    assert n.keepalive(threads, list(threads), ready, SID) is None
    n.acceptable = {"sup:T2"}
    move = n.keepalive(threads, list(threads), ready, SID)
    assert move["supplier_id"] == "sup:T2" and move["sheets"] == [] and move["note"]


def test_demanded_clause_beats_a_cheaper_alternative_deadband(flags):
    """P08: it demands its 0-deadband clause and offers a 5-deadband alternative that is cheaper for us
    at its prices; we keep the clause it demanded and negotiate the price."""
    c = clause_case()
    c["buyer"]["index_paths"] = {"CU-NOTATION": 0.06}
    n = po.Negotiator(c)
    threads = {SID: [supplier_msg(6.05, payment_days=30)]}
    n.decide(threads)
    reply = supplier_msg(
        5.45, 1, body="We can offer a Preisgleitklausel on CU-NOTATION.", payment_days=90, index_clause=CLAUSES[0]
    )
    reply["term_sheets"].append(
        {"term_sheet_id": "offer:T1-1-a", "terms": {"unit_price": 5.46, "payment_days": 90, "index_clause": CLAUSES[2]}}
    )
    threads[SID] += [buyer_msg(5.0, payment_days=90, index_clause=None), reply]
    move = n.decide(threads)
    assert all(s["index_clause"] == CLAUSES[0] for s in move["sheets"])
    flags["proactive_clause"] = False  # v1.6c: the cheaper alternative's terms become ours
    n = po.Negotiator(c)
    n.decide({SID: threads[SID][:1]})
    assert n.decide(threads)["why"]["mix"]["index_clause"] == CLAUSES[2]
