# Observation report

Fixed-choice observations require semantic review; no intervention or score benefit measured.

```json
{
  "snapshots": 27,
  "capture_errors": 0,
  "model_calls": 46,
  "available": 10,
  "unavailable": 17,
  "verdicts": {
    "NO_ISSUE": 8,
    "RECONSIDER": 2
  },
  "errors": {
    "unsupported_flag": 17
  },
  "median_call_seconds": 0.472,
  "max_call_seconds": 0.782,
  "capture_seconds_total": 0.027635,
  "elapsed_seconds": 3.559,
  "changed_buyer_actions": 0,
  "feedback_enabled": true,
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

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0002.json)

## case:G03 decision 3 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0003.json)

## case:G06 decision 0 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0004.json)

## case:G06 decision 1 (send)

RECONSIDER; field=index_clause; error=None.

[Full observation](0005.json)

Evidence: `message:sup:70340:2`

```text
{"message_id": "msg:70340-1-2", "from": "sales@70340", "subject": "Re: Supply enquiry", "body": "Simulated supplier. We can offer the attached package as a whole; its terms are linked.", "refs": [], "action": null, "term_sheets": [{"term_sheet_id": "offer:70340-1", "terms": {"index_clause": {"base_month": "2026-09", "deadband_pct": 3.0, "material_share": 0.6, "series": "PPI-C241"}, "payment_days": 90, "unit_price": 15.97}}], "status": "open", "claim_results": [], "missing_fields": [], "attachments": [{"attachment_id": "att:70340-1-quote", "name": "quote.pdf", "text": "Synthetic supplier quote\nOffered terms\nIndex clause PPI-C241, 60% material, deadband 3.0 %, base 2026-09\nPayment terms (days net) 90\nUnit price (EUR) 15.97\nOur standard terms (apply to everything not stated above)\nPayment terms (days net) 60\nContract term (months) 24\nVolume per year (pcs) 7400\nIndex clause none\nTerms fixed by your enquiry\nLead time (days) 35\nVolume per year (pcs) 7400\nContract term (months) 24\nIncoterm DAP\nTooling (EUR) 0\nPrice valid from 2027-07-01"}]}
```

## case:G06 decision 2 (send)

RECONSIDER; field=index_clause; error=None.

[Full observation](0006.json)

Evidence: `message:sup:70340:4`

```text
{"message_id": "msg:70340-2-3", "from": "sales@70340", "subject": "Re: Supply enquiry", "body": "Simulated supplier. We can offer the attached package as a whole; its terms are linked.", "refs": [], "action": null, "term_sheets": [{"term_sheet_id": "offer:70340-2", "terms": {"index_clause": {"base_month": "2026-09", "deadband_pct": 3.0, "material_share": 0.6, "series": "PPI-C241"}, "payment_days": 90, "unit_price": 14.77}}], "status": "open", "claim_results": [], "missing_fields": [], "attachments": [{"attachment_id": "att:70340-2-quote", "name": "quote.pdf", "text": "Synthetic supplier quote\nOffered terms\nIndex clause PPI-C241, 60% material, deadband 3.0 %, base 2026-09\nPayment terms (days net) 90\nUnit price (EUR) 14.77\nOur standard terms (apply to everything not stated above)\nPayment terms (days net) 60\nContract term (months) 24\nVolume per year (pcs) 7400\nIndex clause none\nTerms fixed by your enquiry\nLead time (days) 35\nVolume per year (pcs) 7400\nContract term (months) 24\nIncoterm DAP\nTooling (EUR) 0\nPrice valid from 2027-07-01"}]}
```

## case:G06 decision 3 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0007.json)

## case:G06 decision 4 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0008.json)

## case:G10 decision 0 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0009.json)

## case:G10 decision 1 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0010.json)

## case:G10 decision 2 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0011.json)

## case:G10 decision 3 (accept)

NO_ISSUE; field=NONE; error=None.

[Full observation](0012.json)

## case:P08 decision 0 (send)

NO_ISSUE; field=NONE; error=None.

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

NO_ISSUE; field=NONE; error=None.

[Full observation](0019.json)

## case:P11 decision 1 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0020.json)

## case:P11 decision 2 (send)

UNAVAILABLE; field=None; error=unsupported_flag.

[Full observation](0021.json)

## case:P11 decision 3 (send)

NO_ISSUE; field=NONE; error=None.

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
