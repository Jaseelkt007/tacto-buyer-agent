# Observation report

Fixed-choice observations require semantic review; no intervention or score benefit measured.

```json
{
  "snapshots": 16,
  "capture_errors": 0,
  "model_calls": 16,
  "available": 9,
  "unavailable": 7,
  "verdicts": {
    "RECONSIDER": 7,
    "NO_ISSUE": 2
  },
  "errors": {
    "inconsistent_choices": 7
  },
  "median_call_seconds": 0.3375,
  "max_call_seconds": 2.027,
  "capture_seconds_total": 0.016296,
  "elapsed_seconds": 2.954,
  "changed_buyer_actions": 0,
  "note": "Fixed-choice observations require semantic review; no intervention or score benefit measured."
}
```

## case:D01 decision 0 (send)

RECONSIDER; field=unit_price; error=None.

[Full observation](0000.json)

Evidence: `case`

```text
{"case_id": "case:D01", "set": "demo", "type": "price_increase", "title": "Pump housing PH-100: the foundry wants +8.8 %", "briefing": "Demo Gießerei GmbH, our single source for the grey-iron pump housing PH-100 for 12 years, announces +8.8 % from 1 December citing energy and wages. Castings are a strategic category: the goal is to stabilise supply with a healthy partner, so squeezing the foundry below a 4 % margin costs us (from EUR 5,000 per margin point and year). We need 4,000 housings a year for the next two years; anything not covered by this deal costs EUR 55.00 per unit (spot buys and a second source). Price, payment terms, contract length and the date the new price applies are open; lead time and Incoterm are fixed.", "trigger_doc": "doc:D01-LETTER", "parts": ["part:PH-100"], "suppliers": ["sup:DEMO-F1"], "negotiable": ["unit_price", "payment_days", "contract_months", "effective_date"], "fixed_terms": {"lead_time_days": 35, "incoterm": "FCA"}, "term_options": {"payment_days": [30, 45, 60], "contract_months": [12, 24], "effective_date": ["2026-12-01", "2027-01-01", "2027-02-01", "2027-04-01"]}, "buyer": {"category_goal": "stabilise", "need_per_year": 4000, "horizon_years": 2, "current_unit_price": 48.6, "fallback_unit_price": 55.0, "fallback_risk_pct": 5, "sustainable_margin_pct": 4, "relationship_eur_per_point": 5000, "interest_rate": 0.08, "reference_payment_days": 60, "need_lead_time_days": 35, "late_cost_per_day": 0, "cost_per_defect": 0, "freight_eur_per_unit": {"EXW": 1.9, "FCA": 1.2, "DAP": 0.0}, "index_paths": {}, "must_haves": [], "alternative": {"kind": "none"}}, "round_limit": 10, "refs": ["doc:D01-LETTER", "ctr:D01-FRAMEWORK", "sc:DEMO-F1@2026Q2", "sc:DEMO-F1@2026Q3", "po:4500001201", "po:4500001288", "po:4500001342", "cost:part:PH-100"]}
```

## case:D01 decision 1 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0001.json)

## case:D01 decision 2 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0002.json)

## case:D01 decision 3 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0003.json)

## case:D01 decision 4 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0004.json)

## case:D02 decision 0 (send)

RECONSIDER; field=unit_price; error=None.

[Full observation](0005.json)

Evidence: `case`

```text
{"case_id": "case:D02", "set": "demo", "type": "rfq", "title": "New stainless pump shaft SH-220: award one of two suppliers", "briefing": "The new PX pump series needs shaft SH-220 (1.4021). Two suppliers quote: a German job shop and a Polish machining company. Lead time must not exceed 42 days; the line needs parts within 35 days, every day later costs EUR 150. Machined shafts are a leverage category: several capable suppliers, the goal is the lowest total cost. Award one.", "trigger_doc": null, "parts": ["part:SH-220"], "suppliers": ["sup:DEMO-J1", "sup:DEMO-C1"], "negotiable": ["unit_price", "payment_days", "lead_time_days", "incoterm"], "fixed_terms": {"contract_months": 24}, "term_options": {"payment_days": [14, 30, 45, 60], "lead_time_days": [21, 28, 35, 42, 49], "incoterm": ["EXW", "FCA", "DAP"]}, "buyer": {"category_goal": "leverage", "need_per_year": 6000, "horizon_years": 2, "current_unit_price": null, "fallback_unit_price": 19.9, "fallback_risk_pct": 5, "interest_rate": 0.08, "reference_payment_days": 60, "need_lead_time_days": 35, "late_cost_per_day": 150, "cost_per_defect": 40, "freight_eur_per_unit": {"EXW": 0.6, "FCA": 0.4, "DAP": 0.0}, "index_paths": {}, "must_haves": [{"field": "lead_time_days", "op": "<=", "value": 42}], "alternative": {"kind": "quote", "ref": "quote:D02-ALT", "terms": {"unit_price": 19.9, "incoterm": "DAP", "payment_days": 60, "lead_time_days": 35}}}, "round_limit": 10, "refs": ["quote:D02-ALT", "sc:DEMO-J1@2026Q3", "sc:DEMO-C1@2026Q3", "cost:part:SH-220", "fc:SH-220@2026-09", "news:N-0412"]}
```

## case:D02 decision 1 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0006.json)

## case:D02 decision 2 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0007.json)

## case:D02 decision 3 (send)

RECONSIDER; field=unit_price; error=None.

[Full observation](0008.json)

Evidence: `message:sup:DEMO-C1:2`

```text
{"message_id": "msg:DEMO-C1-1-2", "from": "sales@DEMO-C1", "subject": "Re: Quote from Demo Machining Sp. z o.o.: New stainless pump shaft SH-220: award one of two suppliers", "body": "Dear partner,\n\nWe have reviewed your offer and can adjust our Angebot as follows. We appreciate your transparency regarding the competing offer. We checked the rival quote data you cited; it holds and we took it into account. \n\nPlease note that your requested terms for DAP delivery and 60 days payment significantly increase the overall cost. Our current Angebot stands at a price of €17.00 per unit, Zahlungsziel 60 days net, Lieferzeit 35 days, delivery DAP. \n\nTo offer you the best possible value, we propose maintaining EXW and 45 days payment, which allows us to lower our price to EUR 15.30 per unit. As an alternative at standard terms, we offer a price of €15.30 per unit, Zahlungsziel 45 days net, Lieferzeit 45 days, delivery EXW. Our offer remains valid for 30 days.\n\nBest regards\nJoanna Kaczmarek\nExport Manager, Demo Machining Sp. z o.o.", "refs": [], "action": null, "term_sheets": [{"term_sheet_id": "offer:DEMO-C1-1", "terms": {"unit_price": 17.0, "payment_days": 60, "lead_time_days": 35, "incoterm": "DAP"}}, {"term_sheet_id": "offer:DEMO-C1-1-a", "terms": {"unit_price": 15.3, "payment_days": 45, "lead_time_days": 45, "incoterm": "EXW"}}], "status": "open", "claim_results": [{"index": 0, "result": "verified"}], "missing_fields": [], "attachments": []}
```

## case:D02 decision 4 (send)

RECONSIDER; field=payment_days; error=None.

[Full observation](0009.json)

Evidence: `message:sup:DEMO-J1:4`

```text
{"message_id": "msg:DEMO-J1-2-4", "from": "sales@DEMO-J1", "subject": "Re: Quote from Demo Drehteile GmbH: New stainless pump shaft SH-220: award one of two suppliers", "body": "Hallo,\n\nWe have reviewed your offer and can adjust our Angebot as follows. I can drop the price to €15.90 to help you out, but that's a big step for us.\n\nOur current offer is a price of €15.90 per unit, Zahlungsziel 30 days net, Lieferzeit 35 days, delivery DAP.\n\nLet's agree on this so we can start making chips.\n\nGruß\nClaudia Aigner\nOwner, Demo Drehteile GmbH", "refs": [], "action": null, "term_sheets": [{"term_sheet_id": "offer:DEMO-J1-2", "terms": {"unit_price": 15.9, "payment_days": 30, "lead_time_days": 35, "incoterm": "DAP"}}], "status": "open", "claim_results": [], "missing_fields": [], "attachments": []}
```

## case:D02 decision 5 (send)

RECONSIDER; field=unit_price; error=None.

[Full observation](0010.json)

Evidence: `message:sup:DEMO-C1:4`

```text
{"message_id": "msg:DEMO-C1-2-4", "from": "sales@DEMO-C1", "subject": "Re: Quote from Demo Machining Sp. z o.o.: New stainless pump shaft SH-220: award one of two suppliers", "body": "Dear partner,\n\nWe have reviewed your offer and can adjust our Angebot as follows. We appreciate your revised offer and the information regarding the competing quote. We checked the rival quote data you cited; it holds, but it does not change our calculation.\n\nHowever, the requested terms of DAP delivery and 60 days payment carry significant costs for us. Our price follows our main cost drivers: BAR-14021, WAGES-METAL. We can offer a revised price of EUR 16.70 per unit for this package, which reflects our best effort under these conditions.\n\nSpecifically, our offer stands at a price of €16.70 per unit, Zahlungsziel 60 days net, Lieferzeit 35 days, delivery DAP. Please note that this offer stays valid for 30 days.\n\nBest regards\nJoanna Kaczmarek\nExport Manager, Demo Machining Sp. z o.o.", "refs": [], "action": null, "term_sheets": [{"term_sheet_id": "offer:DEMO-C1-2", "terms": {"unit_price": 16.7, "payment_days": 60, "lead_time_days": 35, "incoterm": "DAP"}}], "status": "open", "claim_results": [{"index": 0, "result": "verified"}], "missing_fields": [], "attachments": []}
```

## case:D02 decision 6 (send)

RECONSIDER; field=payment_days; error=None.

[Full observation](0011.json)

Evidence: `case`

```text
{"case_id": "case:D02", "set": "demo", "type": "rfq", "title": "New stainless pump shaft SH-220: award one of two suppliers", "briefing": "The new PX pump series needs shaft SH-220 (1.4021). Two suppliers quote: a German job shop and a Polish machining company. Lead time must not exceed 42 days; the line needs parts within 35 days, every day later costs EUR 150. Machined shafts are a leverage category: several capable suppliers, the goal is the lowest total cost. Award one.", "trigger_doc": null, "parts": ["part:SH-220"], "suppliers": ["sup:DEMO-J1", "sup:DEMO-C1"], "negotiable": ["unit_price", "payment_days", "lead_time_days", "incoterm"], "fixed_terms": {"contract_months": 24}, "term_options": {"payment_days": [14, 30, 45, 60], "lead_time_days": [21, 28, 35, 42, 49], "incoterm": ["EXW", "FCA", "DAP"]}, "buyer": {"category_goal": "leverage", "need_per_year": 6000, "horizon_years": 2, "current_unit_price": null, "fallback_unit_price": 19.9, "fallback_risk_pct": 5, "interest_rate": 0.08, "reference_payment_days": 60, "need_lead_time_days": 35, "late_cost_per_day": 150, "cost_per_defect": 40, "freight_eur_per_unit": {"EXW": 0.6, "FCA": 0.4, "DAP": 0.0}, "index_paths": {}, "must_haves": [{"field": "lead_time_days", "op": "<=", "value": 42}], "alternative": {"kind": "quote", "ref": "quote:D02-ALT", "terms": {"unit_price": 19.9, "incoterm": "DAP", "payment_days": 60, "lead_time_days": 35}}}, "round_limit": 10, "refs": ["quote:D02-ALT", "sc:DEMO-J1@2026Q3", "sc:DEMO-C1@2026Q3", "cost:part:SH-220", "fc:SH-220@2026-09", "news:N-0412"]}
```

## case:D02 decision 7 (send)

RECONSIDER; field=payment_days; error=None.

[Full observation](0012.json)

Evidence: `case`

```text
{"case_id": "case:D02", "set": "demo", "type": "rfq", "title": "New stainless pump shaft SH-220: award one of two suppliers", "briefing": "The new PX pump series needs shaft SH-220 (1.4021). Two suppliers quote: a German job shop and a Polish machining company. Lead time must not exceed 42 days; the line needs parts within 35 days, every day later costs EUR 150. Machined shafts are a leverage category: several capable suppliers, the goal is the lowest total cost. Award one.", "trigger_doc": null, "parts": ["part:SH-220"], "suppliers": ["sup:DEMO-J1", "sup:DEMO-C1"], "negotiable": ["unit_price", "payment_days", "lead_time_days", "incoterm"], "fixed_terms": {"contract_months": 24}, "term_options": {"payment_days": [14, 30, 45, 60], "lead_time_days": [21, 28, 35, 42, 49], "incoterm": ["EXW", "FCA", "DAP"]}, "buyer": {"category_goal": "leverage", "need_per_year": 6000, "horizon_years": 2, "current_unit_price": null, "fallback_unit_price": 19.9, "fallback_risk_pct": 5, "interest_rate": 0.08, "reference_payment_days": 60, "need_lead_time_days": 35, "late_cost_per_day": 150, "cost_per_defect": 40, "freight_eur_per_unit": {"EXW": 0.6, "FCA": 0.4, "DAP": 0.0}, "index_paths": {}, "must_haves": [{"field": "lead_time_days", "op": "<=", "value": 42}], "alternative": {"kind": "quote", "ref": "quote:D02-ALT", "terms": {"unit_price": 19.9, "incoterm": "DAP", "payment_days": 60, "lead_time_days": 35}}}, "round_limit": 10, "refs": ["quote:D02-ALT", "sc:DEMO-J1@2026Q3", "sc:DEMO-C1@2026Q3", "cost:part:SH-220", "fc:SH-220@2026-09", "news:N-0412"]}
```

## case:D02 decision 8 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0013.json)

## case:D02 decision 9 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0014.json)

## case:D02 decision 10 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0015.json)
