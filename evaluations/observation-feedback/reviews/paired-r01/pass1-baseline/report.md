# Observation report

Fixed-choice observations require semantic review; no intervention or score benefit measured.

```json
{
  "snapshots": 27,
  "capture_errors": 0,
  "model_calls": 49,
  "available": 7,
  "unavailable": 20,
  "verdicts": {
    "NO_ISSUE": 5,
    "RECONSIDER": 2
  },
  "errors": {
    "unsupported_flag": 20
  },
  "median_call_seconds": 0.568,
  "max_call_seconds": 1.636,
  "capture_seconds_total": 0.027635,
  "elapsed_seconds": 4.674,
  "changed_buyer_actions": 0,
  "feedback_enabled": false,
  "note": "Fixed-choice observations require semantic review; no intervention or score benefit measured."
}
```

## case:G03 decision 0 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0000.json)

## case:G03 decision 1 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0001.json)

## case:G03 decision 2 (send)

NO_ISSUE; field=NONE; error=None.

[Full observation](0002.json)

## case:G03 decision 3 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0003.json)

## case:G06 decision 0 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0004.json)

## case:G06 decision 1 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0005.json)

## case:G06 decision 2 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0006.json)

## case:G06 decision 3 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0007.json)

## case:G06 decision 4 (accept)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0008.json)

## case:G10 decision 0 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0009.json)

## case:G10 decision 1 (send)

RECONSIDER; field=unit_price; error=None.

[Full observation](0010.json)

Evidence: `news:20261017-S19`

```text
A machinery group has moved its bearing purchasing to a central European platform; Kugellager-Vertrieb Inntal GmbH loses about a tenth of its volume and is looking for new customers to fill its warehouse.
```

## case:G10 decision 2 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0011.json)

## case:G10 decision 3 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0012.json)

## case:P08 decision 0 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0013.json)

## case:P08 decision 1 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0014.json)

## case:P08 decision 2 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0015.json)

## case:P08 decision 3 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0016.json)

## case:P08 decision 4 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0017.json)

## case:P08 decision 5 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0018.json)

## case:P11 decision 0 (send)

RECONSIDER; field=ppm_commitment; error=None.

[Full observation](0019.json)

Evidence: `case`

```text
{"case_id": "case:P11", "set": "practice", "type": "quality", "title": "Kalwisz: bearing brackets in red", "briefing": "You negotiate for Hollerau Pumpenwerke with Odlewnia Kalwisz Sp. z o.o.. Kalwisz: bearing brackets in red. Need: 15900 pc a year. Category goal: quality first: defects and late deliveries cost more than a few cents of price. Score: the lowest total cost C as defined in the rules, valued with this case's rates (need lead time 58 days). Fallback if you walk away: the second-source quote quote:7200011. Must-haves: ppm_commitment <= 1500. Prepare from the data package.", "trigger_doc": "doc:20260921-70140-P11", "parts": ["part:310020"], "suppliers": ["sup:70140"], "negotiable": ["ppm_commitment", "chargeback_eur_per_complaint", "unit_price"], "fixed_terms": {"payment_days": 60, "lead_time_days": 56, "volume_per_year": 15900, "contract_months": 12, "effective_date": "2027-01-01", "index_clause": null, "incoterm": "FCA", "tooling_eur": 0}, "term_options": {"ppm_commitment": [300, 800, 1500, 2500], "chargeback_eur_per_complaint": [0, 150, 300, 500]}, "buyer": {"need_per_year": 15900, "horizon_years": 1.0, "current_unit_price": 45.15, "fallback_unit_price": 47.86, "interest_rate": 0.08, "reference_payment_days": 60, "need_lead_time_days": 58, "category_goal": "quality_first", "fallback_risk_pct": 8, "index_risk_pct": 2, "late_cost_per_day": 300, "cost_per_defect": 450, "freight_eur_per_unit": {"EXW": 1.77, "FCA": 1.54, "DAP": 0.0}, "index_paths": {}, "must_haves": [{"field": "ppm_commitment", "op": "<=", "value": 1500}], "alternative": {"kind": "quote", "ref": "quote:7200011", "terms": {"unit_price": 53.56, "payment_days": 30, "lead_time_days": 56, "volume_per_year": 15900, "contract_months": 12, "effective_date": "2027-01-01", "index_clause": null, "incoterm": "FCA", "tooling_eur": 7500, "ppm_commitment": 715}}}, "round_limit": 10, "refs": ["doc:20260921-70140-P11", "ctr:4600070140", "sc:70140@2026Q3", "quote:7200011"]}
```

## case:P11 decision 1 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0020.json)

## case:P11 decision 2 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0021.json)

## case:P11 decision 3 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0022.json)

## case:P11 decision 4 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0023.json)

## case:P11 decision 5 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0024.json)

## case:P11 decision 6 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0025.json)

## case:P11 decision 7 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0026.json)
