# Local supplier run

Mode: llm; model: gpt-6.1-sol.

This is a synthetic test under invented supplier economics. The benchmark gap is against
the best financially feasible package or the buyer's alternative, not a prediction of
savings obtainable from real suppliers or of a leaderboard score.

| Case | Outcome | Supplier | Payment days | Months | Indexed | Benchmark gap EUR | Fallbacks |
|---|---|---|---:|---:|---|---:|---:|
| L01 | deal | sup:70170 | 10 | 12 | no | 11,284.00 | 0 |
| L02 | deal | sup:70170 | 10 | 12 | no | 11,743.60 | 0 |
| L03 | deal | sup:70270 | 10 | 12 | no | 792.00 | 0 |
| L04 | deal | sup:70340 | 90 | 12 | no | 34.27 | 0 |
| L05 | deal | sup:70340 | 90 | 12 | no | 772.47 | 0 |
| L06 | deal | sup:70560 | 90 | 12 | no | 186.00 | 0 |
| L07 | deal | sup:70560 | 90 | 12 | no | 186.00 | 0 |
| L08 | deal | sup:70640 | 60 | 24 | no | 2,880.00 | 0 |
| L09 | deal | sup:70190 | 10 | 24 | no | 35,914.67 | 0 |
| L10 | walk | — | — | — | no | 0.00 | 0 |

Reconciliation:

```json
{
  "requested": 10,
  "recorded": 10,
  "completed": 10,
  "failed": 0,
  "unstarted": 0,
  "model_calls": 57,
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

Synthetic wave score: **93.6/100**.

| Case | Score / 100 | Finished after wave start (seconds) | End reason |
|---|---:|---:|---|
| L01 | 88.9 | 19.5 | accepted |
| L02 | 86.1 | 24.4 | accepted |
| L03 | 97.9 | 21.5 | accepted |
| L04 | 99.7 | 22.3 | accepted |
| L05 | 94.2 | 25.0 | accepted |
| L06 | 93.4 | 24.2 | accepted |
| L07 | 93.4 | 23.2 | accepted |
| L08 | 92.3 | 20.3 | accepted |
| L09 | 90.2 | 34.0 | accepted |
| L10 | 100.0 | 39.4 | walked_away |

```json
{
  "cap_seconds": 480,
  "parallel_cases": 10,
  "peak_overlapping_supplier_requests": 10,
  "last_case_finished_seconds": 39.376,
  "pre_wave_403s": 1,
  "http_errors": [],
  "thread_timeouts": 0,
  "wave_cap_closures": 0,
  "elapsed_seconds": 491.107,
  "requested": 10,
  "completed": 10,
  "failed": 0,
  "model_calls": 57,
  "model_fallbacks": 0,
  "buyer_fallbacks": 0,
  "deals": 9,
  "failed_must_haves": 0,
  "synthetic_wave_score": 93.6,
  "note": "One synthetic wave; not a leaderboard estimate or a five-wave transition test."
}
```

Scores were recomputed from the recorded terms, independent supplier profiles and
the published buyer-cost formula. This tests one eight-minute wave, not transitions
between multiple waves. In-process HTTP does not reproduce hosted-service or venue-network latency.
