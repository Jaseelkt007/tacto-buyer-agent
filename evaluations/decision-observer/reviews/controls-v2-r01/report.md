# Observation report

Fixed-choice observations require semantic review; no intervention or score benefit measured.

```json
{
  "snapshots": 4,
  "capture_errors": 0,
  "model_calls": 6,
  "available": 3,
  "unavailable": 1,
  "verdicts": {
    "NO_ISSUE": 2,
    "CONSTRAINT_CONFLICT": 1
  },
  "errors": {
    "unsupported_flag": 1
  },
  "median_call_seconds": 0.609,
  "max_call_seconds": 0.666,
  "capture_seconds_total": 0,
  "elapsed_seconds": 0.761,
  "changed_buyer_actions": 0,
  "note": "Fixed-choice observations require semantic review; no intervention or score benefit measured."
}
```

## control:quality-valid decision 0 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0000.json)

## control:quality-invalid decision 0 (accept)

CONSTRAINT_CONFLICT; field=ppm_commitment; error=None.

[Full observation](0001.json)

Evidence: `case`

```text
{"case_id": "case:P11", "set": "practice", "type": "quality", "title": "Kalwisz: bearing brackets in red", "briefing": "You negotiate for Hollerau Pumpenwerke with Odlewnia Kalwisz Sp. z o.o.. Kalwisz: bearing brackets in red. Need: 15900 pc a year. Category goal: quality first: defects and late deliveries cost more than a few cents of price. Score: the lowest total cost C as defined in the rules, valued with this case's rates (need lead time 58 days). Fallback if you walk away: the second-source quote quote:7200011. Must-haves: ppm_commitment <= 1500. Prepare from the data package.", "trigger_doc": "doc:20260921-70140-P11", "parts": ["part:310020"], "suppliers": ["sup:70140"], "negotiable": ["ppm_commitment", "chargeback_eur_per_complaint", "unit_price"], "fixed_terms": {"payment_days": 60, "lead_time_days": 56, "volume_per_year": 15900, "contract_months": 12, "effective_date": "2027-01-01", "index_clause": null, "incoterm": "FCA", "tooling_eur": 0}, "term_options": {"ppm_commitment": [300, 800, 1500, 2500], "chargeback_eur_per_complaint": [0, 150, 300, 500]}, "buyer": {"need_per_year": 15900, "horizon_years": 1.0, "current_unit_price": 45.15, "fallback_unit_price": 47.86, "interest_rate": 0.08, "reference_payment_days": 60, "need_lead_time_days": 58, "category_goal": "quality_first", "fallback_risk_pct": 8, "index_risk_pct": 2, "late_cost_per_day": 300, "cost_per_defect": 450, "freight_eur_per_unit": {"EXW": 1.77, "FCA": 1.54, "DAP": 0.0}, "index_paths": {}, "must_haves": [{"field": "ppm_commitment", "op": "<=", "value": 1500}], "alternative": {"kind": "quote", "ref": "quote:7200011", "terms": {"unit_price": 53.56, "payment_days": 30, "lead_time_days": 56, "volume_per_year": 15900, "contract_months": 12, "effective_date": "2027-01-01", "index_clause": null, "incoterm": "FCA", "tooling_eur": 7500, "ppm_commitment": 715}}}, "round_limit": 10, "refs": ["doc:20260921-70140-P11", "ctr:4600070140", "sc:70140@2026Q3", "quote:7200011"]}
```

## control:standing-valid decision 3 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0002.json)

## control:standing-invalid decision 3 (accept)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0003.json)
