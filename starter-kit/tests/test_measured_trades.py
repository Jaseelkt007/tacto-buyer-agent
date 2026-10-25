from test_procudeal_v17 import CASE, SID, supplier_msg

from arena_kit.agents.procudeal import context, policy, tactician, trades


def test_quoted_trade_uses_one_current_message_and_identical_other_terms():
    before = {"unit_price": 40, "contract_months": 24, "payment_days": 30}
    after = {**before, "contract_months": 36}
    event = {"from": SID, "term_sheets": [
        {"term_sheet_id": "a", "terms": {**before, "unit_price": 50}},
        {"term_sheet_id": "b", "terms": {**after, "unit_price": 48}}]}
    result = trades.quoted_price(CASE, before, after, {}, [event])
    assert result[0] == 38.4 and "a → b" in result[1]
    assert trades.quoted_price(CASE, before, {**after, "payment_days": 60}, {}, [event]) is None
    assert trades.quoted_price(CASE, before, after, {}, [event, {"from": SID, "term_sheets": []}]) is None
    event["term_sheets"][1]["terms"]["payment_days"] = 90
    assert trades.quoted_price(CASE, before, after, {}, [event]) is None


def test_unknown_trade_value_is_not_zero_and_does_not_offer_a_discount(monkeypatch):
    monkeypatch.setattr(policy, "FLAGS", policy.parse_off("", "measured_trades,grounded_dossier"))
    n = policy.Negotiator(CASE)
    events = [supplier_msg(45)]
    move = n.decide({SID: events})
    packet = context.build(n, {SID: events}, move)
    assert set(packet["options"]) == {"E0"}
    assert "UNKNOWN" in packet["text"]
    assert "likely accepted" not in packet["text"]
    assert "No current source-grounded dossier" in packet["text"]


def test_open_status_cannot_be_accepted_on_an_unmeasured_prediction(monkeypatch):
    monkeypatch.setattr(policy, "FLAGS", policy.parse_off("", "measured_trades"))
    n = policy.Negotiator(CASE)
    events = [supplier_msg(45)]
    move = n.decide({SID: events})
    packet = context.build(n, {SID: events}, move)
    answer = {"action": "accept", "option": next(iter(packet["accept"]), "missing")}
    actual, reason = tactician.to_move(n, packet, answer, move)
    assert actual is move and "closing decision" in reason
