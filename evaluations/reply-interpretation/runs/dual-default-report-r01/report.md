# Both advisory models enabled by default

The earlier `gpt-6-luna` decision reviewer now runs before dispatch, with the accumulated exchange feedback previously tested offline. The `gpt-6.1-sol` reply interpreter remains enabled before the policy. Both stages are advisory: the v1.9 policy owns counteroffers, claims, acceptance and walkaway. The old reconsideration adapter is still off.

## Integration

1. Reply interpreter reads supplier messages and earlier exchanges.
2. Deterministic policy selects an action; claims and email are assembled.
3. Decision reviewer assesses that proposed action using original history and derived exchange feedback. A non-NO_ISSUE assessment triggers the existing evidence check.
4. The original action is dispatched, with both readings in its trace.

The decision review has one eight-second caller deadline across both provider calls. Its allotted time is further limited by the remaining 45-second overall decision budget; when exhausted, it is skipped. Failures and unsupported flags are unavailable readings, never approvals. There are no automatic retries or new acceptance vetoes. Final/agreed replies skip the interpreter but their proposed acceptance is still reviewed when budget permits.

## End-to-end verification

| Measurement | Hosted P08/P18 | Concurrent synthetic wave |
|---|---:|---:|
| Cases | 2 | 10 |
| Complete buyer decisions | 11 | 53 |
| Median decision time | 5.48 s | 3.08 s |
| Maximum decision time | 9.50 s | 10.35 s |
| Decisions at or above 60 seconds | 0 | 0 |
| Thread timeouts | 0 | 0 |
| Valid deals | 2 | 10 |
| Decision reviews | 11 | 53 |
| Recorded decision-provider calls | 18 | 90 |
| NO_ISSUE readings | 4 | 16 |
| Retained RECONSIDER readings | 0 | 1 |
| Unsupported flags discarded | 7 | 36 |
| Decision-review transport/deadline errors | 0 | 0 |
| Reply-interpreter calls | 9 | 45 |
| Reply-interpreter deadline fallbacks | 0 | 1 |

The timer wraps the full buyer call, including both models, policy, writing, trace recording and observation capture. Supplier HTTP waiting and outbound request delivery are outside it. Median includes acceptances. Hosted timeout counters were read back from the completed threads; the local simulator had clocks enabled. This is one smoke pass, not a worst-case guarantee or a speed comparison with earlier runs.

P08 remained 60.40 and P18 63.18, with identical captured actions and final terms to the saved v1.9 baseline. The synthetic mean was 80.1, with no supplier/buyer fallbacks, infeasible published offers, score mismatches, failed mandatory requirements or wave-cap closures. Synthetic supplier choices vary; no score gain from advisory interpretation or review is established.

The evidence-stage output is itself a model judgment. A retained flag is not proof that the policy should change. Unsupported flags remain explicit and do not control dispatch.

## Commands used

From `starter-kit/`, no model-enabling flag was passed:

```bash
.venv/bin/python scripts/bench.py --agent procudeal case:P08 case:P18 \
  --parallel 2 --observe --reconsider off --note dual-review-default-r01

.venv/bin/python scripts/supplier_wave.py \
  --suite ../evaluations/supplier-generalization/wave-02 \
  --finish-when-done --observe --reconsider off \
  --out ../evaluations/reply-interpretation/runs/dual-default-wave-r01

.venv/bin/python scripts/analyse_reply_finalization.py \
  --note dual-review-default-r01 --cases P08 P18 \
  --synthetic ../evaluations/reply-interpretation/runs/dual-default-wave-r01 \
  --verify-hosted --out ../evaluations/reply-interpretation/runs/dual-default-report-r01
```

Use a fresh note/output directory for a new run. The hosted command consumes practice quota; the local wave only uses model APIs. Neither opens actual final sessions. Hosted quota reported 227 remaining afterward.

Full suite: **271 passed, 1 skipped in 39.27 seconds**. Tests cover both default models through the production factory and local final-wave runner, feedback inclusion, review of acceptances, unchanged actions even on a retained flag, wall timeout, exhausted decision budget and independent opt-out. Lint passes. Actual local configuration confirms both models enabled and Sunday's release loaded.

Full measurements, raw run paths, scores and hosted counters: [comparison.json](comparison.json). Earlier interpreter-only measurements are historical and are not substituted for this combined-model check.
