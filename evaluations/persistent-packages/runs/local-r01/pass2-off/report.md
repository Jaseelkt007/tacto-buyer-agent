# Local supplier run

Mode: llm; model: gpt-6.1-sol.

This is a synthetic test under invented supplier economics. The benchmark gap is against
the best financially feasible package or the buyer's alternative, not a prediction of
savings obtainable from real suppliers or of a leaderboard score.

| Case | Outcome | Supplier | Payment days | Months | Indexed | Benchmark gap EUR | Fallbacks |
|---|---|---|---:|---:|---|---:|---:|
| G03 | deal | sup:70190 | 10 | 12 | no | 26,024.23 | 0 |
| G04 | deal | sup:99041 | 75 | 12 | no | 4,392.97 | 0 |
| G06 | deal | sup:70340 | 90 | 24 | yes | 9,021.98 | 0 |
| G10 | deal | sup:70640 | 90 | 12 | no | 1,035.74 | 0 |

Reconciliation:

```json
{
  "requested": 4,
  "recorded": 4,
  "completed": 4,
  "failed": 0,
  "unstarted": 0,
  "model_calls": 15,
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

Synthetic wave score: **77.1/100**.

| Case | Score / 100 | Finished after wave start (seconds) | End reason |
|---|---:|---:|---|
| G03 | 64.9 | 12.8 | accepted |
| G04 | 70.0 | 24.0 | accepted |
| G06 | 84.6 | 18.5 | accepted |
| G10 | 88.8 | 12.5 | accepted |

```json
{
  "cap_seconds": 480,
  "completion_mode": "when_done",
  "closed_early": true,
  "parallel_cases": 4,
  "peak_overlapping_supplier_requests": 4,
  "last_case_finished_seconds": 24.005,
  "pre_wave_403s": 1,
  "http_errors": [],
  "thread_timeouts": 0,
  "wave_cap_closures": 0,
  "elapsed_seconds": 35.209,
  "requested": 4,
  "completed": 4,
  "failed": 0,
  "model_calls": 15,
  "model_fallbacks": 0,
  "buyer_fallbacks": 0,
  "deals": 4,
  "failed_must_haves": 0,
  "synthetic_wave_score": 77.1,
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
| case:G03 | 45.8 | 64.9 | 14,183.77 |
| case:G04 | 0.0 | 70.0 | 10,252.31 |
| case:G06 | 0.0 | 84.6 | 49,422.13 |
| case:G10 | 88.4 | 88.8 | 38.93 |

## Matched controls

```json
[
  {
    "cases": [
      "G04",
      "G05"
    ],
    "both_completed": false,
    "cost_difference_eur": null,
    "same_contract_terms": null
  },
  {
    "cases": [
      "G08",
      "G09"
    ],
    "both_completed": false,
    "cost_difference_eur": null,
    "same_contract_terms": null
  }
]
```

A difference in one stochastic pair is diagnostic, not proof of identity or ordering bias.
Compare the same frozen configuration over the preregistered repetitions.
