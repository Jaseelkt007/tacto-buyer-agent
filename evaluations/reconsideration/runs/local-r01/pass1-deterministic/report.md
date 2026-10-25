# Local supplier run

Mode: llm; model: gpt-6.1-sol.

This is a synthetic test under invented supplier economics. The benchmark gap is against
the best financially feasible package or the buyer's alternative, not a prediction of
savings obtainable from real suppliers or of a leaderboard score.

| Case | Outcome | Supplier | Payment days | Months | Indexed | Benchmark gap EUR | Fallbacks |
|---|---|---|---:|---:|---|---:|---:|
| G01 | deal | sup:70270 | 10 | 12 | no | 3,738.04 | 0 |
| G02 | deal | sup:70270 | 10 | 12 | no | 1,579.22 | 0 |
| G03 | deal | sup:70190 | 10 | 12 | no | 26,024.23 | 0 |
| G04 | deal | sup:99041 | 75 | 12 | no | 3,765.07 | 0 |
| G05 | deal | sup:99051 | 75 | 12 | no | 4,392.97 | 0 |
| G06 | deal | sup:70340 | 90 | 24 | yes | 9,021.98 | 0 |
| G07 | deal | sup:70340 | 90 | 12 | no | 2,582.66 | 0 |
| G08 | deal | sup:70190 | 10 | 12 | no | 8,474.24 | 0 |
| G09 | deal | sup:70190 | 10 | 12 | no | 7,244.73 | 0 |
| G10 | deal | sup:70640 | 90 | 12 | no | 1,035.74 | 0 |

Reconciliation:

```json
{
  "requested": 10,
  "recorded": 10,
  "completed": 10,
  "failed": 0,
  "unstarted": 0,
  "model_calls": 43,
  "model_fallbacks": 0,
  "infeasible_published_offers": [],
  "selected_vs_published_mismatches": [],
  "score_mismatches": []
}
```

The saved public transcripts were rechecked against private financial limits. Every
published counteroffer was also compared with the recorded model/reference selection.

Limitations: one pass, invented economics, fixed action menus and templated supplier prose;
no relationship-health scoring, semantic claim grading or hosted arena calls.

## One timed wave

Synthetic wave score: **79.7/100**.

| Case | Score / 100 | Finished after wave start (seconds) | End reason |
|---|---:|---:|---|
| G01 | 70.8 | 14.1 | accepted |
| G02 | 91.0 | 27.1 | accepted |
| G03 | 64.9 | 15.9 | accepted |
| G04 | 74.3 | 21.7 | accepted |
| G05 | 70.0 | 23.5 | accepted |
| G06 | 84.6 | 20.6 | accepted |
| G07 | 83.9 | 28.6 | accepted |
| G08 | 83.4 | 28.5 | accepted |
| G09 | 85.8 | 26.6 | accepted |
| G10 | 88.8 | 15.1 | accepted |

```json
{
  "cap_seconds": 480,
  "completion_mode": "when_done",
  "closed_early": true,
  "parallel_cases": 10,
  "peak_overlapping_supplier_requests": 10,
  "last_case_finished_seconds": 28.618,
  "pre_wave_403s": 1,
  "http_errors": [],
  "thread_timeouts": 0,
  "wave_cap_closures": 0,
  "elapsed_seconds": 40.49,
  "requested": 10,
  "completed": 10,
  "failed": 0,
  "model_calls": 43,
  "model_fallbacks": 0,
  "buyer_fallbacks": 0,
  "deals": 10,
  "failed_must_haves": 0,
  "synthetic_wave_score": 79.7,
  "note": "One synthetic wave; not a leaderboard estimate. Quick completion skips idle cap waiting."
}
```

Scores were recomputed from the recorded terms, independent supplier profiles and
the published buyer-cost formula. This run tests one local wave, not transitions
between multiple waves. In-process HTTP does not reproduce hosted-service or venue-network latency.

Quick completion was selected; thread deadlines and the wave cap remained active.
The wave closed early after all cases ended. Full-cap waiting was not tested.

## Negotiation beyond the opening baseline

The static baseline takes the cheapest acceptable opening or alternative and does not negotiate.
The following table contains completed cases only. Failed cases remain in the overall wave denominator.

| Case | Baseline score / 100 | Achieved score / 100 | Improvement over baseline EUR |
|---|---:|---:|---:|
| case:G01 | 0.0 | 70.8 | 9,047.56 |
| case:G02 | 1.1 | 91.0 | 15,856.11 |
| case:G03 | 45.8 | 64.9 | 14,183.77 |
| case:G04 | 0.0 | 74.3 | 10,880.21 |
| case:G05 | 0.0 | 70.0 | 10,252.31 |
| case:G06 | 0.0 | 84.6 | 49,422.13 |
| case:G07 | 0.0 | 83.9 | 13,449.63 |
| case:G08 | 0.0 | 83.4 | 42,601.60 |
| case:G09 | 0.0 | 85.8 | 43,831.11 |
| case:G10 | 88.4 | 88.8 | 38.93 |

## Matched controls

```json
[
  {
    "cases": [
      "G04",
      "G05"
    ],
    "both_completed": true,
    "cost_difference_eur": -627.9,
    "same_contract_terms": false
  },
  {
    "cases": [
      "G08",
      "G09"
    ],
    "both_completed": true,
    "cost_difference_eur": 1229.51,
    "same_contract_terms": false
  }
]
```

A difference in one stochastic pair is diagnostic, not proof of identity or ordering bias.
Compare the same frozen configuration over the preregistered repetitions.
