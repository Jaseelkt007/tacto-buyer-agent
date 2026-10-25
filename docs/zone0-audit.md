# Zone 0 interpretation audit

This document records the initial research phase. The subsequent implementation, rebuilt artifacts
and hosted comparisons are in the [grounded-hybrid report](../notes/analysis/zone0-v3/results.md).

Zone 0 needs an evidence audit before its interpretations can safely guide the hybrid. Existing ID
validation proves that a record exists, not that it supports the attached claim. This investigation
starts from commit `99159a4`, the Claude engine conversation, and `notes/analysis/expert-tactics.md`.
That initial audit left the live engine and the existing dossiers unchanged.

## Evaluation protocol

1. Inventory every stored dossier without a model: missing citations, unscoped claims, and build errors.
2. Audit the claims against the data package, independently of the original specialist reports,
   argument-library commentary, playbook, and supplier rehearsal. Those are interpretations, not evidence.
3. Require exact source excerpts for supported claims. Code checks the excerpt against the source;
   that checks provenance, not semantic truth. Missing, duplicate, or invalid verdicts fail closed.
4. Keep four distinct outcomes: supported, inference, unsupported, contradicted. A fifth outcome,
   `requires_case`, covers decisions that require current allowed terms or total-cost calculations.
5. Check model judgments by hand and with deliberately corrupted claims before trusting aggregate counts.
6. Test decisions separately: compare no dossier, original dossier, and audited observations on the same
   recorded states. A different choice or better score *if accepted* does not demonstrate a live gain.
7. Use whole suppliers as holdouts. Keep back-office values and retrospective reasons out of model inputs.
   Sandbox and then repeated, paired hosted runs are needed before enabling the hybrid.

The offline tool writes under a separate output directory. It does not open arena sessions, read the
leaderboard, replace production knowledge, or alter default negotiation behavior.

## Working findings

- The red-team supplier sees the lead's conclusions and rehearses them. There is no independent
  verification step and no revision of the lead after the rehearsal.
- Removing an invalid evidence ID leaves the associated claim in place, sometimes with no evidence.
- `strength` describes a need's importance, not the confidence of its interpretation. The schema has
  no part scope, validity period, disconfirming evidence, or separate confidence.
- The argument library mixes checked numbers with interpretations. Its forecast note assumes higher
  demand benefits the supplier; its should-cost note promotes a point estimate into a below-cost claim.
  Regex-derived document interpretations also reach the specialists through that library.
- The economics specialist does not see supplier letters; the contract specialist does not see notice
  letters. The lead has full evidence, but must discover cross-specialist conflicts itself.
- The live packet forwards needs and constraints. Zone 1 additionally forwards unverified price views,
  trades, and rehearsal answers. Auditing only one consumer is insufficient.
- A clean dossier cannot repair unmeasured supplier values in the option menu. Unknown willingness to
  trade lead time or contract length must not be presented as a measured zero.
- `research.py` resumes by file existence. Its data fingerprint hashes fact IDs, not their contents,
  and consumers do not check that a dossier matches the current release. `--force` is required by the
  current rebuild procedure. New dossiers need per-artifact content and prompt fingerprints.

## Findings checked against original records

The inventory covers **46 dossiers, 1,441 strategy entries, and 400 needs/constraints**. All 400 carry
at least one citation; none has a structured part-scope field. Some describe parts in prose, so this
is a schema limitation, not evidence that all claims have the wrong scope. Existing argument libraries
contain **91** instances of "More volume is worth more to it." and **14** of "it sells below this cost."
Those exact strings are counted by the inventory; they are not estimates of dossier error rates.

| Finding | Primary evidence | Implication |
|---|---|---|
| P10's planning-security need is real | `doc:20260327-70410-M2` requires a binding 12-month commitment; `doc:20260918-70410-P10` prioritises firm long-term customers | Keep the observation. It does not quantify a discount for 24 versus 36 months. |
| P10's supplier-owned tooling assertion lacks support | Sourcing for `part:340010`, `sup:70410`: `tooling_owner = n/a` | Remove ownership-based leverage claims; `n/a` also does not prove buyer ownership. |
| P10's "reliable payment" claim conflicts with invoices | Its invoice summary has `paid_late_pct = 76.4` | Do not invent relationship strength from vendor age or contract length. |
| P02's planning-security statement mixes inference and old news | `ctr:4600070510#8.1` is automatic annual renewal; `doc:20251019-70510-N` is a 2025 holiday email | Neither proves a discount for a longer commitment or a 2026 holiday constraint. |
| P02's no-deadband recommendation lacks case economics | `strategy.trades` explicitly says "without a deadband" | Move concrete option selection to the priced, case-specific menu. |
| P08 asks for an index clause despite its hedge | `doc:20260912-70710-P08` asks for AS-14404; `doc:20260706-70710-M1` says fixed-price coverage until March 2027 | Preserve both with dates. A hedge does not imply rejection of a future clause. |
| P01's cash request is explicit | `doc:20260902-70110-M2` asks for 10-day payment against a discount | Preserve the request; price payment using the case and supplier's own offers. |

The P10 replay also illustrates the distinction between need and trade value. The recorded model
reasoning in `notes/analysis/tactician-P10-opus-low.md` says an uncounted non-cash value makes a deeper
price step plausible. That is an unmeasured forecast of acceptance, even when the need is correct.
These examples diagnose mechanisms. They are not supplier-specific rules to add to the engine.

## Recommended specialist responsibilities

Keep specialists as a way to divide evidence, but narrow what each produces:

| Role | Output | Boundary |
|---|---|---|
| Economics | Dated cost estimates, units, uncertainty, driver exposure, price history | No actual-loss assertion from a point estimate; no hidden supplier-rate guess from ownership. |
| Supplier intent | Explicit asks, complaints, priorities, and stated red lines | Quote the speaker; financial stress and discount willingness remain hypotheses unless supported. |
| Contract and chronology | Scope, deadlines, notice compliance, current versus expired commitments | Read the letters alongside the clauses; do not infer negotiation preferences from boilerplate. |
| Operations | Capacity, delivery, quality, forecast, sourcing and tooling | Distinguish buyer demand from supplier appetite; keep different parts separate. |
| Independent verifier | Missing support, contradictions, stale scope, misleading certainty | Read source records and arena definitions, without the library's commentary or playbook. |
| Lead | Reconcile atomic observations and unresolved hypotheses | Cannot promote a hypothesis to fact or choose a concrete trade without the case. |

Give economics the relevant supplier letters, and contracts the notice and renewal letters. Every
specialist also needs company definitions (including what `confidence_pct` means). An argument library
can supply code-computed claim sentences, but its interpretive notes must be separate from evidence.

The present supplier rehearsal and buyer rebuttal do not verify facts. Keep them optional and
case-specific after the evidence audit, rather than requiring two more calls for every supplier.
An ablation should compare a single source-grounded extractor plus verifier against four extractors
plus verifier. This research has not measured which architecture gives better live results.

An observation needs an explicit representation, for example:

```json
{
  "observation": "Supplier says it prioritises customers with firm, long-term commitments.",
  "status": "supplier_statement",
  "source": "doc:20260918-70410-P10",
  "quote": "We will prioritise customers with firm, long-term commitments.",
  "parts": ["part:340010"],
  "observed_at": "2026-09-18",
  "valid_until": null,
  "trade_value": "unknown"
}
```

This example is a schema proposal, not a production artifact. Unknown expiry stays unknown, and
code still checks source membership. Current replies can contradict older statements. Keep
separate hypothesis records with their supporting and opposing observations and a question that
could resolve them. Avoid self-assigned confidence scores masquerading as measured probabilities.

## What would help the hybrid win

The highest-priority expert-note idea for this failure is **B6, a give-get ledger priced in total
cost**. For each candidate trade, show the buyer's exact delta C, the price concession needed to
break even, the observed supplier value (if identifiable), and what remains unknown. A qualitative
need can justify proposing a conditional trade or question; it cannot justify an arbitrary price
concession or a claim that acceptance is likely. Preserve available standing offers and must-haves.

Follow the repo's test ladder. First verify both consumers (`context.py` and `strategist.py`) and
ablate the observation text on identical replay states. Then run the sandbox and repeated paired
hosted comparisons with unchanged prompts, recording failures and round counts as well as mean score.
Use complete suppliers as holdouts and report paired deltas, not best-ever leaderboard scores.
The existing `zone0=False` replay removes Z observations but retains dossier-derived checkable
arguments; label that ablation accurately rather than calling it removal of all Zone-0 information.

No hosted-score improvement, final ranking, or model winner follows from this source audit.

## Audit results and limits

The final semantic pass used GPT-6.1 Sol at low effort on **eight suppliers / 246 strategy entries**.
Four were the development examples P01, P02, P08, and P10. Four were outside all suppliers listed in
`knowledge/practice_cases.json`: `sup:70170`, `sup:70440`, `sup:70340`, and `sup:70730`. They were selected
by the lowest SHA-256 hashes of supplier IDs before their results were read. These are coverage
checks, not evidence about hidden-final performance; improvements to evidence coverage were rerun
on both groups, so the final groups are not an untouched model-selection test set.

All eight reports covered every requested entry and passed literal excerpt validation. The model
classified 45 entries as supported, 53 as inference, 63 as unsupported, 81 as requiring the case,
and four as contradicted. **These are model judgments, not 201 proven errors.** Entries can contain
several assertions; trade advice often legitimately needs a case. Two contradiction entries repeat
the same tooling assertion. Of 66 needs/constraints, 20 were supported, 30 inference, 15 unsupported,
and one contradicted. Human source checks, not these totals, support the concrete findings above.

The [inventory](../notes/analysis/zone0-audit/inventory.json),
[summary](../notes/analysis/zone0-audit/summary.json), and
[per-supplier model outputs](../notes/analysis/zone0-audit/results/) are retained. Inputs can be
regenerated by the script; each result records input and original-dossier hashes. Full inputs from
this run also remain in `/tmp/zone0-final`. Re-running against changed dossiers or data is a new audit.

### Model diagnostic

The fixture `scripts/fixtures/zone0-calibration.json` has twelve hand-labelled claims: explicit
payment and approval statements, reversed claims, uncertain cost estimates, renewal inference,
and stale holiday dates. Labels are withheld from models. The final single run gave:

| Model | Accepted rubric judgments | Excerpt/coverage validation |
|---|---|---|
| `claude-opus-5-5` | 12/12 | Passed |
| `gpt-6.1-sol` | 12/12 | Passed |
| `gpt-6-luna` | 12/12 | Passed |

This small, development-set diagnostic does not rank models. It tests gross evidence mistakes,
not negotiation ability, full-dossier accuracy, or repeated reliability. Luna had one incomplete
response in an earlier diagnostic attempt; the final successful run does not erase it. No production
model was changed. Keep Opus as the baseline, compare Sol for synthesis/verification, and test Luna
for narrow extraction only after a broader supplier-held-out evaluation. Current official model
names and API availability were checked rather than inferred from Codex's model selector.

### Corrections made to this audit

The first audit omitted ID-less sourcing rows, invoice aggregates, and history records keyed by
`event_id`. It incorrectly called some supported claims unsupported. A unit test now checks those
inputs. The next pass lacked arena checker definitions and mistook numerically computable historical
data for eligible claims. The final input includes the API's claim, term, and cost rules.

The initial diagnostic omitted `company.md`, so Sol and Opus read `confidence_pct = 5` as confidence
rather than the documented error band. The source definition was added. The grading rubric for
"10-day payment is free" was also too narrow after that document was supplied: the stated financing
cost supports `contradicted`, as well as `unsupported` or `requires_case`. Its accepted labels were
corrected and all three models were rerun. These are harness corrections, not model improvements.

Validation: **28 tests passed** across the new audit checks and the existing research-evidence and
playbook suites; Ruff and `git diff --check` passed. The new tooling uses no arena API, and neither
the source audit nor its model judgments are wired into live decisions.

## Research basis

[Anthropic's research-system report](https://www.anthropic.com/research/multi-agent-research-system)
supports dividing broad research into independent scopes, explicit instructions, and evaluating
factual accuracy and citation accuracy separately. It does not establish that seven calls beat one
for this fixed-data negotiation task.

[Chain-of-Verification](https://arxiv.org/abs/2309.11495) tests answering verification questions
independently before revising a draft. Our application is an inference: check claims against primary
records without feeding the verifier the analysts' persuasive rationale or the practice playbook.

[Why Do Multi-Agent LLM Systems Fail?](https://arxiv.org/abs/2503.13657) documents failures in system
design, inter-agent alignment, and verification. Adding agents alone is not a correctness guarantee.

The [official OpenAI model catalog](https://developers.openai.com/api/docs/models) lists
`gpt-6.1-sol` and `gpt-6-luna` (not `gpt-6.1-luna`). Sol is a candidate synthesis/verifier model;
Luna is a candidate for narrow extraction. Neither choice is established by negotiation results.
[Structured output](https://developers.openai.com/api/docs/guides/structured-outputs) constrains
format; it does not establish that the contents are true.

## Running the audit

From `starter-kit`, use the project Python environment:

```bash
.venv/bin/python scripts/audit_zone0.py --out ../notes/analysis/zone0-audit
.venv/bin/python scripts/audit_zone0.py --suppliers sup:70110 sup:70510 --model gpt-6.1-sol --out /tmp/zone0-sol
.venv/bin/python scripts/audit_zone0.py --calibration scripts/fixtures/zone0-calibration.json --model gpt-6-luna --out /tmp/zone0-calibration
```

Without `--model`, the command only inventories stored dossiers. With a model, it audits selected
suppliers against the current package. `--all` explicitly selects all stored dossiers for model calls.
Model outputs, input hashes, validated excerpts, and usage are retained for review. Semantic verdicts
remain model judgments; the tool does not label them as certified facts.
