# Finalization timing check

**The measured runs passed the one-minute reply-preparation check.** Four hosted practice cases and one concurrent ten-case local synthetic wave completed successfully with the advisory interpreter enabled. No final/rehearsal sessions were opened. This is one readiness pass, not a worst-case latency guarantee or a demonstration of better negotiation policy.

| Measurement | Hosted practice | Synthetic wave |
|---|---:|---:|
| Cases | 4 | 10 |
| Buyer decisions | 18 | 54 |
| Median complete decision | 4.45 s | 2.21 s |
| Slowest complete decision | 8.00 s | 12.98 s |
| Decisions at or above 60 seconds | 0 | 0 |
| Valid deals | 4 | 10 |
| Thread timeouts | 0 | 0 |
| Interpreter attempts | 14 | 46 |
| Available interpretations | 13 | 44 |
| Interpreter deadline fallbacks | 1 | 2 |
| Buyer engine fallbacks | 0 | 0 |

The timer wraps the complete `agent.decide()` call, including interpretation, deterministic policy, email assembly, trace recording, and observation capture. It excludes supplier HTTP response waiting and outbound request delivery. Median includes quick terminal accept decisions. Hosted thread timeout counts were read back from all four completed sessions; the synthetic simulator ran with thread and wave clocks enabled. The 60-second requirement concerns the buyer's response, not the supplier's own processing delay.

Model/provider waiting dominates the added latency. The slowest synthetic decision was in G08, a two-supplier case; an individual read's eight-second deadline is not the total decision limit when several suppliers require interpretation. Actual model timeouts exercised the fallback: the caller returned and the unchanged deterministic policy produced a valid reply. No retries were enabled. This does not guarantee an entire decision always takes at most eight seconds or cover arbitrary machine/network stalls.

Machine before testing: 12 cores, load average 0.11 / 1.02 / 1.38. Hosted cases ran with parallelism two. The synthetic wave ran all ten cases concurrently, with 12 supplier instances and eight overlapping supplier requests at peak. Its last case closed at +52.90 seconds; harness elapsed time was 65.40 seconds including wave orchestration. That total is not an individual email delay.

## Negotiation outcomes

| Hosted case | Saved v1.9 score | Interpreter observation score | Change |
|---|---:|---:|---:|
| P07 | 74.30 | 74.30 | 0 |
| P08 | 60.40 | 60.40 | 0 |
| P10 | 67.85 | 67.85 | 0 |
| P18 | 63.18 | 63.18 | 0 |

All captured actions and final terms exactly match the saved baseline in these four cases. The API reported 229 remaining practice sessions after the four runs. The synthetic mean was 79.6 versus 78.0 in the earlier wave, with G04/G06 higher and G09 lower. This is not evidence of a model-driven policy gain: interpretation remains advisory, supplier model choices vary, and added latency can affect scheduling. No repeated paired evaluation was performed.

The synthetic supplier audit found no infeasible published offers, selected/published mismatches, score mismatches, supplier model fallbacks, buyer fallbacks, failed mandatory requirements, HTTP errors, thread timeouts, or wave-cap closures. The expected pre-wave 403 was recorded separately.

## Reproduce

From `starter-kit/`, with a new note/output directory for another run:

```bash
.venv/bin/python scripts/bench.py --agent procudeal \
  case:P07 case:P08 case:P10 case:P18 --parallel 2 \
  --interpret-replies --observe --reconsider off --note reply-finalization-r02

.venv/bin/python scripts/supplier_wave.py \
  --suite ../evaluations/supplier-generalization/wave-02 \
  --finish-when-done --interpret-replies --observe --reconsider off \
  --out ../evaluations/reply-interpretation/runs/live-synthetic-r02

.venv/bin/python scripts/analyse_reply_finalization.py \
  --note reply-finalization-r02 \
  --synthetic ../evaluations/reply-interpretation/runs/live-synthetic-r02 \
  --verify-hosted --out ../evaluations/reply-interpretation/runs/finalization-r02
```

Local checks: 28 interpreter/simulator tests passed; lint passed on the changed evaluation scripts. An initial sandboxed simulator-test run stalled and was interrupted; rerunning the same test targets outside the sandbox passed in 4.69 seconds.

## Final configuration

Default v1.9 remains unchanged. The interpreter is an explicit observation flag, not an active term-selection policy. Timing passed this smoke check, but semantic correctness and an economically justified policy consumer remain prerequisites for granting interpretations control over offers. The known P07 preference/condition ambiguity is not resolved by a latency test.

Raw per-case paths, hashes, latency and interpreter failure counts: [comparison.json](comparison.json). Synthetic validation and outcomes: [live-synthetic-r01](../live-synthetic-r01/summary.json).
