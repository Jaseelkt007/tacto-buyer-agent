# Zone-0 correction experiment

The claim under test is that source-grounded dossiers plus bounded term valuation improve the
hybrid's hosted negotiation results without supplier-specific rules. The model stays Opus 5.5,
low effort. Nothing reads the leaderboard. Public records and current supplier messages are the
only decision inputs; saved back-office information is evaluation-only.

## Arms and measurement

- Baseline: v1.9 defaults.
- Original: `tactician` with the original dossiers and menu.
- Sources: `tactician,grounded_dossier`, isolating the new dossier.
- Corrected: `tactician,grounded_dossier,measured_trades`.

All use the existing template writer (`tactician_text` off). Hosted passes use fresh model calls
(`--no-model-cache`), four parallel cases, and the kit's normal clock/fallback behavior. Full
session traces, decisions, code hashes, extra flags and scores are saved under `runs/`; `notes/runs.md`
records each hosted result. The initial baseline used the same v1.9 path before two final changes
to experimental-only branches (clause price transfer and scoped access to verified observations).

The first screen covers all ten hosted cases. Baseline versus corrected is then repeated in
alternating order for five paired passes if quota permits. The original and source-only versions
are diagnostic single passes, not model-selection estimates. Primary outcome is paired mean score
over all ten cases. Also inspect each case, deals, must-haves, round counts, model errors, and engine
fallbacks. A small difference inside the run-to-run range is inconclusive. No default switch based
on one favorable case or best-ever score.

Development examples: P01, P02, P08 and P10. Untuned evaluation cases: P03, P04, P07, P11 and P18.
P05 is an RFQ and bypasses this single-supplier hybrid; include it in the arena mean but do not
attribute its fluctuations to the new hybrid. The prompts are frozen before hosted comparisons.
No supplier's measured hidden cost or rate is encoded in the agent.

`scripts/analyse_grounded_hybrid.py` reproduces pass means and paired case deltas. It flags partial
passes and duplicate arm/repeat/case records. A completed LLM call alone is not success: saved
decisions show whether its move was used, rejected, or replaced with the engine fallback.

## Checks before hosted use

- Four pilot dossiers built and loaded with source/content and pipeline fingerprints.
- Source validation retains exact excerpts, scope, dates, rejected records and verifier judgments.
- A verifier false rejection of a properly qualified cost estimate prompted a clarification before
  the final builds. It no longer rejects estimates merely because they are estimates.
- Lead output is IDs only; it cannot invent additional strategy text.
- Unpriced term changes cannot generate a model-selected discount. Quoted price ratios are
  observations of requested trades, not proof of acceptance at a new lower price.
- Full suite after the final scoped-observation check: 153 passed, one skipped. No agent code
  changes were made during the hosted repeated comparison.
- Original/source-only/corrected replays each evaluated eleven open states from the same v1.9
  traces. There were no model errors; they changed nine/eight/one packages respectively. Lower
  proposed buyer cost is not a realized score and says nothing about supplier acceptance.
- Baseline sandbox: D01 0.883, D02 0.534. Corrected sandbox: the same scores. D02 bypasses the hybrid.

Local load before hosted comparisons: load average 0.56 on 12 cores. Offline dossier generation
overlapped the first corrected pass; record that when examining latency or fallback errors. Later
paired passes run without that generation load. No latency speedup is claimed.
