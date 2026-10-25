# Local supplier run

Mode: reference; model: none.

This is a synthetic test under invented supplier economics. The benchmark gap is against
the best financially feasible package or the buyer's alternative, not a prediction of
savings obtainable from real suppliers or of a leaderboard score.

| Case | Outcome | Supplier | Payment days | Months | Indexed | Benchmark gap EUR | Fallbacks |
|---|---|---|---:|---:|---|---:|---:|
| L01 | deal | sup:70170 | 10 | 12 | no | 606.66 | 0 |
| L02 | deal | sup:70170 | 10 | 12 | no | 5,737.60 | 0 |
| L03 | deal | sup:70270 | 10 | 12 | no | 155.00 | 0 |
| L04 | deal | sup:70340 | 10 | 12 | no | 0.00 | 0 |
| L05 | deal | sup:70340 | 10 | 12 | yes | 0.00 | 0 |
| L06 | deal | sup:70560 | 90 | 12 | no | 66.80 | 0 |
| L07 | deal | sup:70560 | 90 | 12 | no | 66.80 | 0 |
| L08 | deal | sup:70640 | 60 | 24 | no | 840.00 | 0 |
| L09 | deal | sup:70190 | 10 | 24 | no | 6,188.00 | 0 |
| L10 | walk | — | — | — | no | 0.00 | 0 |

Reconciliation:

```json
{
  "requested": 10,
  "recorded": 10,
  "completed": 10,
  "failed": 0,
  "unstarted": 0,
  "model_calls": 0,
  "model_fallbacks": 0,
  "infeasible_published_offers": [],
  "selected_vs_published_mismatches": []
}
```

The saved public transcripts were rechecked against private financial limits. Every
published counteroffer was also compared with the recorded model/reference selection.

Limitations: one pass, invented economics, fixed action menus and templated supplier prose;
no relationship-health scoring, semantic claim grading, timed waves or hosted arena calls.
