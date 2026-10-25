# Results

## Typed reconsideration adapter, optional and off by default

Two ten-case synthetic passes per arm: v1.9 **79.85**, deterministic alternatives **79.60**,
decision-gated alternatives **80.10**. All 60 cases closed valid deals, but each intervention arm
had one supplier-model fallback. The gate approved all ten eligible local alternatives. Of 18
additional packages, only six met the simulator's private financial floor and two were accepted.
Every added package preserved its referenced nonprice terms and passed buyer cost/must-have checks.

Hosted sandbox D01 was unchanged and had no intervention. D02 fell from **53.37** to **49.15**
(deterministic) and **48.19** (gated) in one concurrent smoke pass. This is insufficient evidence
for a causal regression estimate, and there is no demonstrated benefit from model selection.
No additional practice quota was consumed. Leave both adapter and gate off in the final default.
Final verification: **233 tests passed, one skipped**; all six local reconciliation reports passed.
[Full report, source versions and commands](../evaluations/reconsideration/README.md).

## Observation-only Decisions reviewer

Implemented optional snapshot capture and an offline `gpt-6-luna` Decisions reviewer. Hosted
practice: ten deals, zero failed must-haves, **75.0863/100**, matching the prior v1.9 baseline.
Sandbox D01/D02 retained 88.3/53.4. Synthetic Wave 02 scored **79.6**, with ten deals and one
supplier-model connection failure/reference fallback; this is not a clean model-only run or a
reviewer improvement. The reviewer changed zero actions.

Across 120 actual decision snapshots, the revised reviewer returned 46 NO_ISSUE and nine
RECONSIDER findings; 63 flags lacked selected support and two reviews failed to connect. All nine
retained flags were inspected: none alone established a beneficial correction. It did not reliably
retain the G03/G06 adaptation findings. Of 22 actual acceptances, 21 returned NO_ISSUE and one
review was unavailable. A manufactured quality-violation acceptance was detected; a manufactured
stale-offer acceptance was flagged initially but failed evidence selection. Keep observation off
the action path. **209 tests passed, one skipped.**

[Full experiment, artifacts and limitations](../evaluations/decision-observer/interpretation.md).

## Wave 02, first operator-run trial

The frozen v1.9 buyer completed ten acceptable agreements, scoring **78.0/100** under the synthetic
stress suite. All cases finished within 28.65 seconds. The 43 supplier model calls had no fallbacks;
no HTTP errors, timeouts, failed must-haves or reconciliation discrepancies occurred. Every deal
beat the stated alternative. Input seals and captured runtime source hashes matched at analysis.

The opaque-ID pair G04/G05 produced identical contracts. The reordered RFQs G08/G09 chose the same
supplier, with a 1,229.51 total-cost difference, about 0.52%. One trial cannot separate order
sensitivity from supplier randomness. In G03 and G06, the supplier introduced the beneficial
contract change while the buyer persisted with its original proposal terms. Correct final deals
therefore do not demonstrate proactive interpretation of those mechanisms.

The static opening/alternative baseline averaged 13.53/100. G10's 88.8 score improved on that case's
88.36 baseline by only 38.93 in cost. These scores require the raw-cost and baseline context.
Wave 01 and Wave 02 are not a before/after regression comparison because their cases and supplier
behavior differ. Four unchanged repetitions remain before assessing stability. No new run or buyer
change was made during analysis. [Detailed interpretation](../evaluations/supplier-generalization/runs/wave02-r01/interpretation.md).

## Wave 02 preparation, no buyer evaluation yet

The new prospective stress suite is sealed and ready for the operator. **177 tests passed**,
including arithmetic/fixture validation and quick-completion tests on old cases. No v1.9
negotiation or supplier model call was run on Wave 02 during preparation. Results remain blank
until the operator's runs exist. See [the evaluation folder](../evaluations/supplier-generalization/README.md).

## One eight-minute local wave, 25 October

**Synthetic wave score: 93.6/100.** Ran all ten current cases in parallel using unchanged v1.9
and the kit's `play_waves`, with `gpt-6.1-sol` supplier agents, 60-second thread clocks and a shared
480-second cap. All ten cases completed: nine valid deals and the intended walkaway. The last case
finished 39.376 seconds after wave start. The runner waited for the cap and exited automatically;
total elapsed time was 491.107 seconds, including initial waiting and polling overhead.

Recorded ten overlapping supplier requests at peak, 57 actual model choices, zero model/buyer
fallbacks, zero HTTP errors, zero thread timeouts, zero cap-forced closures and no failed must-haves.
The pre-wave 403 wait was observed. Both RFQs contacted both suppliers. Every published offer was
financially feasible and matched its selected action; every score passed independent recomputation.
All 167 relevant tests passed, including the new wave concurrency and deadline tests.

This is one local synthetic pass, not a forecast of hosted leaderboard performance. The completed
cases did not exercise emergency closing at the live cap; those paths were checked with controlled
clocks. Multi-wave transitions, venue networking and hosted-supplier delays remain outside this run.
Full case scores, timings and request audit: [wave report](../notes/analysis/supplier-gym/wave-480/report.md).

## Local bounded-LLM supplier practice, 25 October

Ten synthetic cases use six Sunday supplier identities and twelve independent supplier instances.
The corrected `gpt-6.1-sol` run completed **10/10 cases: nine deals and the intentional walkaway**.
There were **57 model calls, zero supplier fallbacks, zero buyer fallbacks, and no failed must-haves**.
Rechecking saved transcripts found zero financially infeasible published offers and zero mismatches
between selected actions and published counteroffers. Both RFQs contacted both supplier agents.

The reference control also completed all ten cases with nine deals and one walkaway. These are
functional tests under invented economics, not leaderboard scores or evidence that the buyer is
optimal. Financing assumptions, expired hedges and early RFQ closure leave investigation targets;
the private benchmark is not a guaranteed achievable negotiation outcome. Production buyer code
was not tuned against these fixtures.

**163 tests passed**, including 22 new supplier-gym tests; timed simulator rehearsal tests were
excluded. The initial model diagnostic exposed missing fixed enquiry dates in the supplier prompt;
the corrected full pass was run after supplying those dates. No hosted arena or actual rehearsal
was run. [Corrected report](../notes/analysis/supplier-gym/llm-enquiry-suite/report.md) ·
[assumptions and diagnostic history](../notes/analysis/supplier-gym/README.md) ·
[commands](supplier-gym.md).

Sunday-release integration check: **141 non-simulator tests passed**. All eight supplier-specific
release records reached the deterministic dossier; 12 snapshots were generated for six suppliers.
The 90 original supplier/part dossiers retained their existing values when built without the
release. No new hosted scores or rehearsal results are claimed for this change. See the
[local comparison](../notes/analysis/deterministic-sunday-check.json).

## Grounded Zone-0 retest, 25 October

**Keep v1.9 as the default.** Five paired ten-case passes gave v1.9 **75.086** versus corrected
hybrid **73.434** (−1.652 points). The hybrid lost every pair; its pass range was 72.582–74.868.

| Configuration | Passes | Mean / 100 |
|---|---:|---:|
| v1.9 baseline | 5 | 75.086 |
| Grounded dossier + bounded trades | 5 | 73.434 |
| Original hybrid, single-pass diagnostic | 1 | 70.504 |
| Grounded dossier only, single-pass diagnostic | 1 | 74.203 |

All 120 hosted sessions closed deals and passed must-haves; no model errors or engine fallbacks
were recorded. The corrected arm used 141 fresh model decisions. P08/P18 losses outweighed P01/P07
gains. Single-pass diagnostics do not establish a model or pipeline winner. Full per-case results,
limitations and reproduction commands: [experiment report](../notes/analysis/zone0-v3/results.md).

## Earlier research and engine results

Initial independent Zone-0 research (25 October): all 46 dossiers inventoried; an eight-supplier semantic
audit and a 12-item model diagnostic are recorded in [the source-audit report](zone0-audit.md).
These measure evidence handling, not negotiation scores. That initial audit used no hosted sessions.
The subsequent implementation and hosted comparison are recorded in the
[grounded-hybrid report](../notes/analysis/zone0-v3/results.md). The v1.9 default remains active.

Score per case and version, one hosted pass each (`uv run python scripts/compare.py --by note`).
Regenerate this table after every benchmark pass.

| case | type | kit llm | v1.1 | v1.3 | v1.4 | v1.5b | v1.6b/c | v1.7 | **v1.7b** | v1.7b −patience |
|---|---|---|---|---|---|---|---|---|---|---|
| P01 | price increase | 0.748 | 0.382 | 0.935 | 0.963 | 0.914 | 0.914 | 0.914 | **0.914** | 0.914 |
| P02 | price increase | | 0.264 | 0.507 | 0.365 | 0.499 | 0.499 | 0.465 | **0.465** | 0.504 |
| P03 | renewal | | 0.923 | 0.923 | 0.923 | 0.923 | 0.923 | 0.923 | **0.923** | 0.923 |
| P04 | renewal | | 0.056 | 0.860 | 0.860 | 0.860 | 0.860 | 0.860 | **0.860** | 0.860 |
| P05 | RFQ, 3 bidders | 0.000 | 0.548 | 0.548 | 0.654 | 0.654 | 0.716 | 0.762 | **0.710** | 0.659 |
| P07 | bundling | | 0.740 | 0.736 | 0.717 | 0.717 | 0.717 | 0.743 | **0.743** | 0.743 |
| P08 | raw material | | 0.210 | 0.549 | 0.626 | 0.626 | 0.626 | 0.538 | **0.615** | 0.604 |
| P10 | capacity | | 0.570 | 0.570 | 0.686 | 0.686 | 0.686 | 0.671 | **0.671** | 0.679 |
| P11 | quality | | 0.626 | 0.626 | 0.710 | 0.710 | 0.710 | 0.710 | **0.710** | 0.710 |
| P18 | raw material | | 0.520 | 0.520 | 0.520 | 0.520 | 0.520 | 0.497 | **0.564** | 0.564 |
| **mean** | | 37.4 (2 cases) | 48.4 | 67.7 | 70.2 | 71.1 | 71.7 | 70.8 | **71.8** | 71.6 |

Later passes (one hosted run each):

| case | v1.7c | v2.0 tactician (rungs chosen by the model) | v2.0b (terms by model, price by code) | **v1.9 (default)** |
|---|---|---|---|---|
| P01 | 0.914 | 0.817 | 0.780 | 0.914 |
| P02 | 0.499 | **0.734** | **0.734** | **0.734** |
| P03 | 0.923 | 0.923 | 0.923 | 0.923 |
| P04 | 0.860 | 0.860 | 0.860 | 0.860 |
| P05 | 0.710 | 0.710 | 0.710 | 0.710 |
| P07 | 0.743 | 0.736 | 0.743 | 0.743 |
| P08 | 0.604 | 0.560 | 0.517 | 0.604 |
| P10 | 0.679 | 0.694 | 0.586 | 0.679 |
| P11 | 0.710 | 0.710 | 0.710 | 0.710 |
| P18 | 0.632 | 0.483 | 0.598 | 0.632 |
| **mean** | 72.7 | 72.3 | 71.6 | **75.1** |

v1.7c + case plan (zone 1): 66.3. Sandbox: v1.7c D01 0.883 / D02 0.534; v1.8 flags the same; v2.0
tactician D01 0.772 (step-backs), then 0.863 with the no-step-back rungs.

v1.2 (31.5, pushed after final_offer) and v1.5 (60.9, a concurrency bug) are in the decision log.
v1.6b/c: the v1.6b pass (mean 71.4) with v1.6c's P05 (0.716). v1.7b = v1.7 with the clause fix (the
supplier's demanded clause beats a cheaper-looking alternative deadband).

**Noise:** the bots do not answer identical messages identically across runs. P05 (three bidders)
scored 0.762 and 0.710 with the same code; the single-supplier cases repeated exactly except P08.
Read a difference below about 0.05 in P05 as noise.

Sandbox (free): v1.2 D01 0.909, D02 0.461 · v1.6 D01 0.883, D02 0.461 · v1.6b D01 0.883, D02 0.482 ·
**v1.7 D01 0.902, D02 0.534** (all flags off: 0.883 / 0.482; per-flag ablation in the decision log).

Practice budget: 400 sessions per rolling 24 h. After the v1.7 / v1.7b passes on Sat 24 Oct: 295
left. A full hosted pass costs 10; the sandbox is free.

## Reply interpretation foundation (25 Oct)

No new negotiation scores: only saved public prefixes were interpreted. Initial six-call smoke: four provenance-valid readings, one invalid package-field association, one timeout. Corrected schema verification: two readings available (P07/P08). Structural success is not semantic accuracy; a P07 preference/condition ambiguity remains. Default policy and feedback reviewer remain unchanged. [Artifacts, tests and limitations](../evaluations/reply-interpretation/README.md).

Subsequent live observation check: P07 74.30, P08 60.40, P10 67.85, P18 63.18, all exactly unchanged from baseline with identical captured actions and final terms. Ten-case synthetic wave: 79.6 (earlier 78.0); no causal improvement claim because supplier choices vary and the interpreter has no semantic control. Across 72 decisions, maximum buyer latency 12.98 seconds, zero thread timeouts, 14 valid deals. Three interpreter deadline fallbacks. [Finalization report](../evaluations/reply-interpretation/runs/finalization-r01/report.md).

After this check, advisory interpretation was enabled by default at the user's request. That configuration change adds no new score result and grants the interpretation no control over binding decisions.

Both advisory stages were subsequently tested live: P08 60.40 and P18 63.18 unchanged, plus ten synthetic cases at mean 80.1 (not a causal improvement claim). The decision reviewer ran on all 64 decisions. Maximum complete decision time 10.35 seconds, zero thread timeouts, 12 valid deals. It retained one RECONSIDER, returned 20 NO_ISSUE readings, and discarded 43 unsupported flags; these judgments did not override actions. One reply-interpreter call hit its deadline. [Combined-model evidence](../evaluations/reply-interpretation/runs/dual-default-report-r01/report.md).
