# Grounded Zone-0 and hybrid experiment

## Decision: keep v1.9 as the default

The dossier repair is implemented, but the corrected hybrid did not beat v1.9 in any of five
paired passes. Its average was **73.43 versus 75.09**, a **1.65-point loss** on the ten hosted cases.
This is evidence against promoting this version on the current benchmark, not proof about unseen
final suppliers. The original and dossier-only passes are diagnostics; neither has enough repeats
to establish a reliable improvement or rank the two new configurations.

| Configuration | Complete ten-case passes | Mean / 100 | Median | Pass range |
|---|---:|---:|---:|---:|
| v1.9 baseline | 5 | **75.086** | 75.086 | 75.086–75.086 |
| Grounded dossier + bounded trades | 5 | **73.434** | 73.058 | 72.582–74.868 |
| Original hybrid, diagnostic | 1 | 70.504 | — | — |
| Grounded dossier only, diagnostic | 1 | 74.203 | — | — |

The paired mean deltas were −1.044, −0.219, −2.466, −2.504 and −2.029 points; their median was
−2.029. On the five untuned evaluation cases, corrected averaged **75.608 versus 77.360**. P05,
which bypasses the hybrid, was identical in every run.

| Case | Baseline mean / 100 | Corrected mean / 100 | Delta |
|---|---:|---:|---:|
| P01 | 91.385 | 93.671 | +2.285 |
| P02 | 73.402 | 73.402 | 0.000 |
| P03 | 92.283 | 92.283 | 0.000 |
| P04 | 86.045 | 86.045 | 0.000 |
| P05 | 71.024 | 71.024 | 0.000 |
| P07 | 74.302 | 76.655 | +2.353 |
| P08 | 60.402 | 50.663 | −9.739 |
| P10 | 67.852 | 67.539 | −0.312 |
| P11 | 70.990 | 69.317 | −1.672 |
| P18 | 63.179 | 53.740 | −9.439 |

All **120 hosted sessions** closed deals and passed must-haves. There were zero recorded model
errors and zero engine fallbacks. The corrected arm made **141 fresh model calls**, used all 141
decisions, and selected a non-E0 counter-option nine times. This was an active model comparison,
not a result produced by cached answers or repeated fallback to v1.9. No partial passes or duplicate
case records were included. The last run reported **67 practice sessions remaining**.

## What changed

The original pipeline allowed specialist interpretations to become lead-strategist advice after
checking only that cited IDs existed. Supplier role-play did not independently establish whether
those interpretations followed from the records. The replacement extracts atomic observations,
checks exact excerpts and scope in code, and independently reviews the complete assertion against
the source context. The lead selects existing IDs; it cannot introduce new strategic conclusions.

All 46 suppliers were rebuilt with Opus 5.5 at low effort. The artifacts contain 1,237 supported
observations (735 shortlisted and 502 available through case scope), 27 hypotheses, 81 rejected
observations and 68 records dropped by code validation. These counts describe model-assisted
judgments, not human certification of all statements. The loader verified every artifact against
the current source snapshot and pipeline fingerprint. Re-running the build needed zero model calls.

The corrected hybrid also restricts counter-options to a current, otherwise identical supplier
quote pair or the existing explicit-driver clause estimate. Qualitative needs cannot be assigned
a discount, unknown trade values remain unknown, and proposed alternatives cannot exceed E0's
estimated buyer cost. Acceptance timing stays with the engine. Estimates and observed price ratios
still do not establish whether a new offer will be accepted.

## Measurement

The [predeclared protocol](experiment.md) uses ten hosted practice cases, fresh model calls, the
normal 25-second model deadline and fallback, and four parallel cases. Original and dossier-only
arms are single-pass diagnostics. The primary comparison repeats baseline and corrected five
times with alternating pair order. No prompt or agent behavior is tuned during these passes.

All runs use the existing template writer; RFQ case P05 bypasses this hybrid. There are no
leaderboard/feed requests. Public case records and supplier messages are decision inputs;
back-office scores are retained only for evaluation. Evaluation cases P03/P04/P07/P11/P18 were
not used to develop the new prompts. They are still practice cases, not an unseen final benchmark.

Scores and errors are reproduced from `runs/` by:

```bash
cd starter-kit
.venv/bin/python scripts/analyse_grounded_hybrid.py
```

The machine-readable table is [hosted.json](hosted.json). Every saved run includes the agent code
fingerprint, requested flags, cache setting, actual choices, checks and supplier responses.

## Verification

- Full suite: **153 passed, 1 skipped**. Ruff and `git diff --check` pass.
- Both baseline and corrected sandbox runs scored D01 **0.883**, D02 **0.534**.
- Eleven identical public replay states per arm: original/source-only/corrected changed
  nine/eight/one packages, with zero model errors. These are proposed moves, not realized gains.
  Two experimental-only reader/menu corrections followed that replay, before the hosted corrected
  pass; replay counts are not presented as final-version score evidence.
- All 46 dossiers passed a resumed build check without generating new outputs.
- The first corrected pass overlapped offline generation. Later repeats run without that load;
  no latency advantage is claimed.

## Remaining limits

Literal excerpts prove provenance, not truth. A model verifier can still miss a bad interpretation
or reject a valid one. The small cross-model calibration from the earlier audit did not establish
that Sol, Luna or Opus is the better negotiator, so model choice is held constant here.

The first corrected trace shows why cleaner records alone cannot ensure better negotiation:
P08 and P18 sometimes remove an explicitly requested index clause because estimated buyer C looks
lower. The prompt acknowledges acceptance uncertainty but still chooses the risk. P07 and P10
also show different argument selections while retaining E0 terms. These traces identify candidate
causes; they are not controlled causal ablations of each individual loss or gain.

P11 in corrected repeat 3 selected E0 on every counter yet finished at 0.626 versus the baseline's
0.710. Its opening omitted the energy argument and moved it to the second counter. The hybrid can
also change accompanying text, so this is not proof that argument order alone caused the loss.
Every baseline counter in the first pass contained one sheet; dropping additional engine sheets
does not explain this experiment's difference. All repeated runs after baseline 1 share the same
agent code fingerprint; baseline 1 differs only in the two disclosed experimental branches.

The next research question is how to require observed supplier acceptance evidence for changing a
stated requirement, and how to value argument timing. A supplier need supports asking about a
trade; it does not establish its price. Do not add P08/P18-specific exceptions or tune against
hidden supplier costs. Any further policy change needs a new frozen comparison.
