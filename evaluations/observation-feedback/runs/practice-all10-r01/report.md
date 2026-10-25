# All ten hosted practice cases: feedback observer

**No scores changed.** The new run exactly matched the frozen earlier v1.9 run in all ten cases, including every captured outgoing action and final term set. The mean remained **75.0863/100**.

The reviewer ran offline after negotiation and had no path to alter offers or acceptances. This is an execution and observation check, not an intervention experiment or a score-improvement estimate.

| Case | Earlier v1.9 | Current v1.9 | Change (points) |
|---|---:|---:|---:|
| P01 | 91.3853 | 91.3853 | +0.0000 |
| P02 | 73.4018 | 73.4018 | +0.0000 |
| P03 | 92.2833 | 92.2833 | +0.0000 |
| P04 | 86.0445 | 86.0445 | +0.0000 |
| P05 | 71.0245 | 71.0245 | +0.0000 |
| P07 | 74.3018 | 74.3018 | +0.0000 |
| P08 | 60.4021 | 60.4021 | +0.0000 |
| P10 | 67.8516 | 67.8516 | +0.0000 |
| P11 | 70.9896 | 70.9896 | +0.0000 |
| P18 | 63.1787 | 63.1787 | +0.0000 |

Ten valid deals; zero failed must-haves, buyer fallbacks or capture errors. Ten practice sessions were consumed; the API reported 233 remaining afterward. No final/rehearsal sessions were started. Each case was run once in this follow-up, sequentially through the same benchmark process.

## Feedback review

Reviewed all **50 decision snapshots** using `gpt-6-luna` with exchange feedback: **24 NO_ISSUE**, **26 unsupported initial flags**, **zero retained RECONSIDER or CONSTRAINT_CONFLICT findings**. The evidence stage declined support for every initial flag. Unsupported findings are unavailable, not approvals. There were **76 model calls**, no transport/provider failures, and no retries.

The review command returned exit code 1 because unavailable findings are explicitly reported as a non-clean review. All 50 review outputs were saved. This is not evidence that all decisions are optimal: the reviewer failed to produce a supported correction on these practice histories. Keep it observation-only.

## Evidence

- [Exact per-case comparison and run file paths](comparison.json)
- [Frozen historical baseline and hashes](baseline.json)
- [Decision-time captures and current run hashes](capture.json)
- [Feedback reviewer report](../../reviews/practice-all10-r01/report.md)
- [Feedback reviewer summary](../../reviews/practice-all10-r01/summary.json)

## Commands executed

From `starter-kit/`:

```bash
.venv/bin/python scripts/bench.py --agent procudeal --set practice \
  --parallel 1 --observe --reconsider off --note observer-feedback-all10-r01

.venv/bin/python scripts/observe_decisions.py \
  ../evaluations/observation-feedback/runs/practice-all10-r01/capture.json \
  --feedback --out ../evaluations/observation-feedback/reviews/practice-all10-r01
```

Use a fresh note/output directory for another run. Reviewing existing captures opens no arena sessions. Negotiation outputs and scores are stored separately from the packets sent to the reviewer.
