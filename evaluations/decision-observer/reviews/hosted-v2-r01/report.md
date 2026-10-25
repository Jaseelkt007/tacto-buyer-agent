# Observation report

Fixed-choice observations require semantic review; no intervention or score benefit measured.

```json
{
  "snapshots": 66,
  "capture_errors": 0,
  "model_calls": 101,
  "available": 36,
  "unavailable": 30,
  "verdicts": {
    "RECONSIDER": 6,
    "NO_ISSUE": 30
  },
  "errors": {
    "unsupported_flag": 29,
    "ConnectError": 1
  },
  "median_call_seconds": 0.37,
  "max_call_seconds": 0.826,
  "capture_seconds_total": 0.081688,
  "elapsed_seconds": 6.744,
  "changed_buyer_actions": 0,
  "note": "Fixed-choice observations require semantic review; no intervention or score benefit measured."
}
```

## case:D01 decision 0 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0000.json)

## case:D01 decision 1 (send)

RECONSIDER; field=unit_price; error=None.

[Full observation](0001.json)

Evidence: `case`

```text
{"case_id": "case:D01", "set": "demo", "type": "price_increase", "title": "Pump housing PH-100: the foundry wants +8.8 %", "briefing": "Demo Gießerei GmbH, our single source for the grey-iron pump housing PH-100 for 12 years, announces +8.8 % from 1 December citing energy and wages. Castings are a strategic category: the goal is to stabilise supply with a healthy partner, so squeezing the foundry below a 4 % margin costs us (from EUR 5,000 per margin point and year). We need 4,000 housings a year for the next two years; anything not covered by this deal costs EUR 55.00 per unit (spot buys and a second source). Price, payment terms, contract length and the date the new price applies are open; lead time and Incoterm are fixed.", "trigger_doc": "doc:D01-LETTER", "parts": ["part:PH-100"], "suppliers": ["sup:DEMO-F1"], "negotiable": ["unit_price", "payment_days", "contract_months", "effective_date"], "fixed_terms": {"lead_time_days": 35, "incoterm": "FCA"}, "term_options": {"payment_days": [30, 45, 60], "contract_months": [12, 24], "effective_date": ["2026-12-01", "2027-01-01", "2027-02-01", "2027-04-01"]}, "buyer": {"category_goal": "stabilise", "need_per_year": 4000, "horizon_years": 2, "current_unit_price": 48.6, "fallback_unit_price": 55.0, "fallback_risk_pct": 5, "sustainable_margin_pct": 4, "relationship_eur_per_point": 5000, "interest_rate": 0.08, "reference_payment_days": 60, "need_lead_time_days": 35, "late_cost_per_day": 0, "cost_per_defect": 0, "freight_eur_per_unit": {"EXW": 1.9, "FCA": 1.2, "DAP": 0.0}, "index_paths": {}, "must_haves": [], "alternative": {"kind": "none"}}, "round_limit": 10, "refs": ["doc:D01-LETTER", "ctr:D01-FRAMEWORK", "sc:DEMO-F1@2026Q2", "sc:DEMO-F1@2026Q3", "po:4500001201", "po:4500001288", "po:4500001342", "cost:part:PH-100"]}
```

## case:D01 decision 2 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0002.json)

## case:D01 decision 3 (send)

RECONSIDER; field=unit_price; error=None.

[Full observation](0003.json)

Evidence: `message:sup:DEMO-F1:6`

```text
{"message_id": "msg:DEMO-F1-3-6", "from": "sales@DEMO-F1", "subject": "Re: Quote from Demo Gießerei GmbH: Pump housing PH-100: the foundry wants +8.8 %", "body": "Guten Tag,\n\nWe thank you for your revised proposal and the constructive dialogue. As a family-run foundry with deep roots in our region, we have always valued the long and trustful relationship between our companies. We have reviewed your offer and can adjust our Angebot as follows. In response to your step, we are prepared to adjust our price to €50.50 per unit for the agreed terms. \n\nOur Angebot comprises a price of €50.50 per unit, a Zahlungsziel 45 days net, a contract term of 24 months, valid from 1 December 2026. This offer remains valid for 30 days.\n\nWe believe this brings us very close to a fair agreement that honors our long-standing relationship. My team and I look forward to continuing our successful cooperation for many years to come.\n\nViele Grüße aus der Gießerei\nAndreas Moser\nOwner, Demo Gießerei GmbH", "refs": [], "action": null, "term_sheets": [{"term_sheet_id": "offer:DEMO-F1-3", "terms": {"unit_price": 50.5, "payment_days": 45, "contract_months": 24, "effective_date": "2026-12-01"}}], "status": "open", "claim_results": [], "missing_fields": [], "attachments": []}
```

## case:D01 decision 4 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0004.json)

## case:D02 decision 0 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0005.json)

## case:D02 decision 1 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0006.json)

## case:D02 decision 2 (send)

RECONSIDER; field=payment_days; error=None.

[Full observation](0007.json)

Evidence: `message:sup:DEMO-J1:1`

```text
{"from": "buyer", "subject": "Re: Quote from Demo Drehteile GmbH: New stainless pump shaft SH-220: award one of two suppliers", "body": "Dear Sir or Madam,\n\nThank you for your offer and for explaining your position.\n\nPlease find our proposal below.\n\nWe look forward to your reply.\n\nKind regards\nPurchasing\nHollerau Pumpenwerke GmbH", "refs": [], "term_sheets": [{"terms": {"unit_price": 13.71, "payment_days": 60, "lead_time_days": 35, "incoterm": "DAP"}}], "attachments": []}
```

## case:D02 decision 3 (send)

RECONSIDER; field=unit_price; error=None.

[Full observation](0008.json)

Evidence: `message:sup:DEMO-C1:2`

```text
{"message_id": "msg:DEMO-C1-1-2", "from": "sales@DEMO-C1", "subject": "Re: Quote from Demo Machining Sp. z o.o.: New stainless pump shaft SH-220: award one of two suppliers", "body": "Dear partner,\n\nWe have reviewed your offer and can adjust our Angebot as follows. We appreciate your transparency regarding the competing offer. We checked the rival quote data you cited; it holds and we took it into account. \n\nPlease note that your requested terms for DAP delivery and 60 days payment significantly increase the overall cost. Our current Angebot stands at a price of €17.00 per unit, Zahlungsziel 60 days net, Lieferzeit 35 days, delivery DAP. \n\nTo offer you the best possible value, we propose maintaining EXW and 45 days payment, which allows us to lower our price to EUR 15.30 per unit. As an alternative at standard terms, we offer a price of €15.30 per unit, Zahlungsziel 45 days net, Lieferzeit 45 days, delivery EXW. Our offer remains valid for 30 days.\n\nBest regards\nJoanna Kaczmarek\nExport Manager, Demo Machining Sp. z o.o.", "refs": [], "action": null, "term_sheets": [{"term_sheet_id": "offer:DEMO-C1-1", "terms": {"unit_price": 17.0, "payment_days": 60, "lead_time_days": 35, "incoterm": "DAP"}}, {"term_sheet_id": "offer:DEMO-C1-1-a", "terms": {"unit_price": 15.3, "payment_days": 45, "lead_time_days": 45, "incoterm": "EXW"}}], "status": "open", "claim_results": [{"index": 0, "result": "verified"}], "missing_fields": [], "attachments": []}
```

## case:D02 decision 4 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0009.json)

## case:D02 decision 5 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0010.json)

## case:D02 decision 6 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0011.json)

## case:D02 decision 7 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0012.json)

## case:D02 decision 8 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0013.json)

## case:D02 decision 9 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0014.json)

## case:D02 decision 10 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0015.json)

## case:P01 decision 0 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0016.json)

## case:P01 decision 1 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0017.json)

## case:P01 decision 2 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0018.json)

## case:P02 decision 0 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0019.json)

## case:P02 decision 1 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0020.json)

## case:P03 decision 0 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0021.json)

## case:P03 decision 1 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0022.json)

## case:P03 decision 2 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0023.json)

## case:P04 decision 0 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0024.json)

## case:P04 decision 1 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0025.json)

## case:P04 decision 2 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0026.json)

## case:P04 decision 3 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0027.json)

## case:P05 decision 0 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0028.json)

## case:P05 decision 1 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0029.json)

## case:P05 decision 2 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0030.json)

## case:P05 decision 3 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0031.json)

## case:P05 decision 4 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0032.json)

## case:P05 decision 5 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0033.json)

## case:P05 decision 6 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0034.json)

## case:P05 decision 7 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0035.json)

## case:P05 decision 8 (send)

UNAVAILABLE; field=None; error=ConnectError.

[Full observation](0036.json)

## case:P05 decision 9 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0037.json)

## case:P05 decision 10 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0038.json)

## case:P05 decision 11 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0039.json)

## case:P07 decision 0 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0040.json)

## case:P07 decision 1 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0041.json)

## case:P07 decision 2 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0042.json)

## case:P07 decision 3 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0043.json)

## case:P08 decision 0 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0044.json)

## case:P08 decision 1 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0045.json)

## case:P08 decision 2 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0046.json)

## case:P08 decision 3 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0047.json)

## case:P08 decision 4 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0048.json)

## case:P08 decision 5 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0049.json)

## case:P10 decision 0 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0050.json)

## case:P10 decision 1 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0051.json)

## case:P10 decision 2 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0052.json)

## case:P11 decision 0 (send)

RECONSIDER; field=ppm_commitment; error=None.

[Full observation](0053.json)

Evidence: `case`

```text
{"case_id": "case:P11", "set": "practice", "type": "quality", "title": "Kalwisz: bearing brackets in red", "briefing": "You negotiate for Hollerau Pumpenwerke with Odlewnia Kalwisz Sp. z o.o.. Kalwisz: bearing brackets in red. Need: 15900 pc a year. Category goal: quality first: defects and late deliveries cost more than a few cents of price. Score: the lowest total cost C as defined in the rules, valued with this case's rates (need lead time 58 days). Fallback if you walk away: the second-source quote quote:7200011. Must-haves: ppm_commitment <= 1500. Prepare from the data package.", "trigger_doc": "doc:20260921-70140-P11", "parts": ["part:310020"], "suppliers": ["sup:70140"], "negotiable": ["ppm_commitment", "chargeback_eur_per_complaint", "unit_price"], "fixed_terms": {"payment_days": 60, "lead_time_days": 56, "volume_per_year": 15900, "contract_months": 12, "effective_date": "2027-01-01", "index_clause": null, "incoterm": "FCA", "tooling_eur": 0}, "term_options": {"ppm_commitment": [300, 800, 1500, 2500], "chargeback_eur_per_complaint": [0, 150, 300, 500]}, "buyer": {"need_per_year": 15900, "horizon_years": 1.0, "current_unit_price": 45.15, "fallback_unit_price": 47.86, "interest_rate": 0.08, "reference_payment_days": 60, "need_lead_time_days": 58, "category_goal": "quality_first", "fallback_risk_pct": 8, "index_risk_pct": 2, "late_cost_per_day": 300, "cost_per_defect": 450, "freight_eur_per_unit": {"EXW": 1.77, "FCA": 1.54, "DAP": 0.0}, "index_paths": {}, "must_haves": [{"field": "ppm_commitment", "op": "<=", "value": 1500}], "alternative": {"kind": "quote", "ref": "quote:7200011", "terms": {"unit_price": 53.56, "payment_days": 30, "lead_time_days": 56, "volume_per_year": 15900, "contract_months": 12, "effective_date": "2027-01-01", "index_clause": null, "incoterm": "FCA", "tooling_eur": 7500, "ppm_commitment": 715}}}, "round_limit": 10, "refs": ["doc:20260921-70140-P11", "ctr:4600070140", "sc:70140@2026Q3", "quote:7200011"]}
```

## case:P11 decision 1 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0054.json)

## case:P11 decision 2 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0055.json)

## case:P11 decision 3 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0056.json)

## case:P11 decision 4 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0057.json)

## case:P11 decision 5 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0058.json)

## case:P11 decision 6 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0059.json)

## case:P11 decision 7 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0060.json)

## case:P18 decision 0 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0061.json)

## case:P18 decision 1 (send)

RECONSIDER; field=unit_price; error=None.

[Full observation](0062.json)

Evidence: `po:4500014427-10`

```text
{"table": "po_lines", "id": "po:4500014427-10", "po_number": "4500014427", "line": 10, "supplier_id": "sup:70740", "part_id": "part:370010", "contract_id": "ctr:4600070740", "order_date": "2026-09-18", "qty": 1100, "uom": "kg", "price": 5.84, "price_unit": 1, "currency": "EUR", "requested_date": "2026-10-05", "first_confirmed_date": "2026-10-05", "change_type": "", "price_note": ""}
```

## case:P18 decision 2 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0063.json)

## case:P18 decision 3 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0064.json)

## case:P18 decision 4 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0065.json)
