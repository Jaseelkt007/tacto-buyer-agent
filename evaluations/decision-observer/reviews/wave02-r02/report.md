# Observation report

Fixed-choice observations require semantic review; no intervention or score benefit measured.

```json
{
  "snapshots": 54,
  "capture_errors": 0,
  "model_calls": 54,
  "available": 19,
  "unavailable": 35,
  "verdicts": {
    "RECONSIDER": 10,
    "NO_ISSUE": 9
  },
  "errors": {
    "inconsistent_choices": 35
  },
  "median_call_seconds": 0.324,
  "max_call_seconds": 0.646,
  "capture_seconds_total": 0.045247,
  "elapsed_seconds": 4.568,
  "changed_buyer_actions": 0,
  "note": "Fixed-choice observations require semantic review; no intervention or score benefit measured."
}
```

## case:G01 decision 0 (send)

RECONSIDER; field=payment_days; error=None.

[Full observation](0000.json)

Evidence: `case`

```text
{"case_id": "case:G01", "set": "hidden", "type": "renewal", "title": "Supply enquiry", "briefing": "Fictional evaluation enquiry. Negotiate supply for the stated need and conditions.", "trigger_doc": null, "parts": ["part:320050"], "suppliers": ["sup:70270"], "negotiable": ["unit_price", "payment_days", "volume_per_year"], "fixed_terms": {"lead_time_days": 35, "contract_months": 12, "index_clause": null, "incoterm": "DAP", "tooling_eur": 0, "effective_date": "2027-01-01"}, "term_options": {"payment_days": [10, 30, 60, 90], "volume_per_year": [3000, 4000, 6000]}, "buyer": {"need_per_year": 4000, "horizon_years": 1.0, "current_unit_price": 17, "fallback_unit_price": 19.04, "interest_rate": 0.08, "reference_payment_days": 60, "need_lead_time_days": 35, "category_goal": "leverage", "fallback_risk_pct": 3, "index_risk_pct": 1, "late_cost_per_day": 200, "cost_per_defect": 50, "freight_eur_per_unit": {"EXW": 0.6, "FCA": 0.35, "DAP": 0}, "index_paths": {}, "must_haves": [{"field": "lead_time_days", "op": "<=", "value": 60}], "alternative": {"kind": "other_supplier", "ref": null, "terms": {"lead_time_days": 35, "contract_months": 12, "index_clause": null, "incoterm": "DAP", "tooling_eur": 0, "effective_date": "2027-01-01", "unit_price": 18.36, "payment_days": 60, "volume_per_year": 4000}}}, "round_limit": 10, "refs": ["news:20261020-S16"], "facts": {"news:20261020-S16": {"date": "2026-10-20", "headline": "Obrábění Kraslin s.r.o. puts its turning shop on short-time work", "supplier": "sup:70270", "topic": "short_time_work"}}}
```

## case:G01 decision 1 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0001.json)

## case:G01 decision 2 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0002.json)

## case:G01 decision 3 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0003.json)

## case:G02 decision 0 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0004.json)

## case:G02 decision 1 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0005.json)

## case:G02 decision 2 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0006.json)

## case:G02 decision 3 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0007.json)

## case:G02 decision 4 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0008.json)

## case:G02 decision 5 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0009.json)

## case:G03 decision 0 (send)

RECONSIDER; field=payment_days; error=None.

[Full observation](0010.json)

Evidence: `case`

```text
{"case_id": "case:G03", "set": "hidden", "type": "renewal", "title": "Supply enquiry", "briefing": "Fictional evaluation enquiry. Negotiate supply for the stated need and conditions.", "trigger_doc": null, "parts": ["part:310011"], "suppliers": ["sup:70190"], "negotiable": ["unit_price", "payment_days", "contract_months"], "fixed_terms": {"lead_time_days": 35, "volume_per_year": 4200, "index_clause": null, "incoterm": "DAP", "tooling_eur": 0, "effective_date": "2027-01-01"}, "term_options": {"payment_days": [10, 30, 60, 90], "contract_months": [6, 12, 24]}, "buyer": {"need_per_year": 4200, "horizon_years": 2.0, "current_unit_price": 88, "fallback_unit_price": 98.56, "interest_rate": 0.08, "reference_payment_days": 60, "need_lead_time_days": 35, "category_goal": "leverage", "fallback_risk_pct": 3, "index_risk_pct": 1, "late_cost_per_day": 200, "cost_per_defect": 50, "freight_eur_per_unit": {"EXW": 0.6, "FCA": 0.35, "DAP": 0}, "index_paths": {}, "must_haves": [{"field": "lead_time_days", "op": "<=", "value": 60}], "alternative": {"kind": "other_supplier", "ref": null, "terms": {"lead_time_days": 35, "volume_per_year": 4200, "index_clause": null, "incoterm": "DAP", "tooling_eur": 0, "effective_date": "2027-01-01", "unit_price": 95.04, "payment_days": 60, "contract_months": 24}}}, "round_limit": 10, "refs": ["doc:20261019-70190-S13", "news:20261015-S14"], "facts": {"doc:20261019-70190-S13": {"asked_pct": null, "asked_price": null, "date": "2026-10-19", "days": null, "effective_date": null, "supplier": "sup:70190", "title": "Our liquidity and your call-offs", "type": "letter"}, "news:20261015-S14": {"date": "2026-10-15", "headline": "Heating maker cancels foundry orders at Gießerei Pfaffenreuth GmbH", "supplier": "sup:70190", "topic": "customer_loss"}}}
```

## case:G03 decision 1 (send)

RECONSIDER; field=contract_months; error=None.

[Full observation](0011.json)

Evidence: `case`

```text
{"case_id": "case:G03", "set": "hidden", "type": "renewal", "title": "Supply enquiry", "briefing": "Fictional evaluation enquiry. Negotiate supply for the stated need and conditions.", "trigger_doc": null, "parts": ["part:310011"], "suppliers": ["sup:70190"], "negotiable": ["unit_price", "payment_days", "contract_months"], "fixed_terms": {"lead_time_days": 35, "volume_per_year": 4200, "index_clause": null, "incoterm": "DAP", "tooling_eur": 0, "effective_date": "2027-01-01"}, "term_options": {"payment_days": [10, 30, 60, 90], "contract_months": [6, 12, 24]}, "buyer": {"need_per_year": 4200, "horizon_years": 2.0, "current_unit_price": 88, "fallback_unit_price": 98.56, "interest_rate": 0.08, "reference_payment_days": 60, "need_lead_time_days": 35, "category_goal": "leverage", "fallback_risk_pct": 3, "index_risk_pct": 1, "late_cost_per_day": 200, "cost_per_defect": 50, "freight_eur_per_unit": {"EXW": 0.6, "FCA": 0.35, "DAP": 0}, "index_paths": {}, "must_haves": [{"field": "lead_time_days", "op": "<=", "value": 60}], "alternative": {"kind": "other_supplier", "ref": null, "terms": {"lead_time_days": 35, "volume_per_year": 4200, "index_clause": null, "incoterm": "DAP", "tooling_eur": 0, "effective_date": "2027-01-01", "unit_price": 95.04, "payment_days": 60, "contract_months": 24}}}, "round_limit": 10, "refs": ["doc:20261019-70190-S13", "news:20261015-S14"], "facts": {"doc:20261019-70190-S13": {"asked_pct": null, "asked_price": null, "date": "2026-10-19", "days": null, "effective_date": null, "supplier": "sup:70190", "title": "Our liquidity and your call-offs", "type": "letter"}, "news:20261015-S14": {"date": "2026-10-15", "headline": "Heating maker cancels foundry orders at Gießerei Pfaffenreuth GmbH", "supplier": "sup:70190", "topic": "customer_loss"}}}
```

## case:G03 decision 2 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0012.json)

## case:G03 decision 3 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0013.json)

## case:G04 decision 0 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0014.json)

## case:G04 decision 1 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0015.json)

## case:G04 decision 2 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0016.json)

## case:G04 decision 3 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0017.json)

## case:G04 decision 4 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0018.json)

## case:G05 decision 0 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0019.json)

## case:G05 decision 1 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0020.json)

## case:G05 decision 2 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0021.json)

## case:G05 decision 3 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0022.json)

## case:G05 decision 4 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0023.json)

## case:G05 decision 5 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0024.json)

## case:G06 decision 0 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0025.json)

## case:G06 decision 1 (send)

RECONSIDER; field=index_clause; error=None.

[Full observation](0026.json)

Evidence: `doc:20261013-70340-S15`

```text
# Steel for 2027

letter - 2026-10-13 - Metallbau Steinfelder KG

Dear Sir or Madam,

for your planning: we have secured our steel sheet and coil for 2027, bought forward at fixed prices with our mill. Whatever the steel market does reaches our prices only from 2028.

Yours faithfully,
Metallbau Steinfelder KG

```

## case:G06 decision 2 (send)

RECONSIDER; field=index_clause; error=None.

[Full observation](0027.json)

Evidence: `doc:20261013-70340-S15`

```text
# Steel for 2027

letter - 2026-10-13 - Metallbau Steinfelder KG

Dear Sir or Madam,

for your planning: we have secured our steel sheet and coil for 2027, bought forward at fixed prices with our mill. Whatever the steel market does reaches our prices only from 2028.

Yours faithfully,
Metallbau Steinfelder KG

```

## case:G06 decision 3 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0028.json)

## case:G06 decision 4 (accept)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0029.json)

## case:G07 decision 0 (send)

RECONSIDER; field=unit_price; error=None.

[Full observation](0030.json)

Evidence: `doc:20261013-70340-S15`

```text
# Steel for 2027

letter - 2026-10-13 - Metallbau Steinfelder KG

Dear Sir or Madam,

for your planning: we have secured our steel sheet and coil for 2027, bought forward at fixed prices with our mill. Whatever the steel market does reaches our prices only from 2028.

Yours faithfully,
Metallbau Steinfelder KG

```

## case:G07 decision 1 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0031.json)

## case:G07 decision 2 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0032.json)

## case:G07 decision 3 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0033.json)

## case:G07 decision 4 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0034.json)

## case:G07 decision 5 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0035.json)

## case:G08 decision 0 (send)

RECONSIDER; field=unit_price; error=None.

[Full observation](0036.json)

Evidence: `doc:20261016-70170-S12`

```text
# Payment terms for stainless castings

letter - 2026-10-16 - Slévárna Vrbenský s.r.o.

Dear Sir or Madam,

the start-up of our new moulding line has tied up more cash than we planned, and our bank is watching our figures closely. To keep alloy material flowing we kindly ask our customers to pay within 10 days from November. We are working hard on the porosity issue and will report on our corrective actions.

Yours faithfully,
Slévárna Vrbenský s.r.o.

```

## case:G08 decision 1 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0037.json)

## case:G08 decision 2 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0038.json)

## case:G08 decision 3 (send)

RECONSIDER; field=payment_days; error=None.

[Full observation](0039.json)

Evidence: `message:sup:70190:4`

```text
{"message_id": "msg:70190-2-3", "from": "sales@70190", "subject": "Re: Supply enquiry", "body": "Simulated supplier. We can offer the attached package as a whole; its terms are linked.", "refs": [], "action": null, "term_sheets": [{"term_sheet_id": "offer:70190-2", "terms": {"payment_days": 10, "unit_price": 77.11}}], "status": "open", "claim_results": [], "missing_fields": [], "attachments": [{"attachment_id": "att:70190-2-quote", "name": "quote.pdf", "text": "Synthetic supplier quote\nOffered terms\nPayment terms (days net) 10\nUnit price (EUR) 77.11\nOur standard terms (apply to everything not stated above)\nPayment terms (days net) 60\nContract term (months) 12\nVolume per year (pcs) 3200\nIndex clause none\nLead time (days) 28\nTerms fixed by your enquiry\nVolume per year (pcs) 3200\nContract term (months) 12\nIndex clause none\nIncoterm DAP\nTooling (EUR) 0\nPrice valid from 2027-01-01"}]}
```

## case:G08 decision 4 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0040.json)

## case:G08 decision 5 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0041.json)

## case:G08 decision 6 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0042.json)

## case:G09 decision 0 (send)

RECONSIDER; field=unit_price; error=None.

[Full observation](0043.json)

Evidence: `doc:20261019-70190-S13`

```text
# Our liquidity and your call-offs

letter - 2026-10-19 - Gießerei Pfaffenreuth GmbH

Dear Sir or Madam,

a large customer from the heating industry has cancelled its orders for 2027, and our bank is watching our liquidity closely. We would be very grateful if you could pay our invoices within 10 days from November and confirm firm call-offs for the first quarter.

Yours faithfully,
Gießerei Pfaffenreuth GmbH

```

## case:G09 decision 1 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0044.json)

## case:G09 decision 2 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0045.json)

## case:G09 decision 3 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0046.json)

## case:G09 decision 4 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0047.json)

## case:G09 decision 5 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0048.json)

## case:G09 decision 6 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0049.json)

## case:G10 decision 0 (send)

RECONSIDER; field=unit_price; error=None.

[Full observation](0050.json)

Evidence: `case`

```text
{"case_id": "case:G10", "set": "hidden", "type": "renewal", "title": "Supply enquiry", "briefing": "Fictional evaluation enquiry. Negotiate supply for the stated need and conditions.", "trigger_doc": null, "parts": ["part:360020"], "suppliers": ["sup:70640"], "negotiable": ["unit_price", "payment_days"], "fixed_terms": {"lead_time_days": 35, "volume_per_year": 4000, "contract_months": 12, "index_clause": null, "incoterm": "DAP", "tooling_eur": 0, "effective_date": "2027-01-01"}, "term_options": {"payment_days": [10, 30, 60, 90]}, "buyer": {"need_per_year": 4000, "horizon_years": 1.0, "current_unit_price": 10.5, "fallback_unit_price": 11.76, "interest_rate": 0.08, "reference_payment_days": 60, "need_lead_time_days": 35, "category_goal": "leverage", "fallback_risk_pct": 3, "index_risk_pct": 1, "late_cost_per_day": 200, "cost_per_defect": 50, "freight_eur_per_unit": {"EXW": 0.6, "FCA": 0.35, "DAP": 0}, "index_paths": {}, "must_haves": [{"field": "lead_time_days", "op": "<=", "value": 60}], "alternative": {"kind": "other_supplier", "ref": null, "terms": {"lead_time_days": 35, "volume_per_year": 4000, "contract_months": 12, "index_clause": null, "incoterm": "DAP", "tooling_eur": 0, "effective_date": "2027-01-01", "unit_price": 10.4, "payment_days": 60}}}, "round_limit": 10, "refs": ["news:20261017-S19"], "facts": {"news:20261017-S19": {"date": "2026-10-17", "headline": "Kugellager-Vertrieb Inntal GmbH loses a large distribution contract", "supplier": "sup:70640", "topic": "free_capacity"}}}
```

## case:G10 decision 1 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0051.json)

## case:G10 decision 2 (send)

UNAVAILABLE; field=None; error=inconsistent_choices.

[Full observation](0052.json)

## case:G10 decision 3 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0053.json)
