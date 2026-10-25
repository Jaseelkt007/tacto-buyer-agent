# Reviewer with exchange feedback

Implemented as an optional **observation-only** extension of the existing `gpt-6-luna` decision
reviewer. It surfaced more relevant contextual findings in this small development test, but
remains too inconsistent to control buyer actions. No negotiation-score improvement was tested.

Follow-up: [all ten hosted practice cases](runs/practice-all10-r01/report.md) reproduced the
earlier v1.9 scores exactly (mean 75.0863), with identical outgoing actions and final terms.
The feedback review returned 24 NO_ISSUE and 26 unsupported flags across 50 decisions, with no
retained finding. The reviewer still had no authority to change negotiations.

## Change

The existing reviewer already saw the full public conversation. `--feedback` additionally gives
it a source-referenced ledger reconstructed from that same decision-time prefix:

- Our earlier offers and the observed supplier responses.
- Quotation history, retaining each package separately.
- Repeated explicitly quoted nonprice values and their source messages.
- Differences between the latest quote and the current proposed main offer.

The ledger is rebuilt for each snapshot, so it can be resumed without sharing mutable state
across suppliers or cases. Later explicit quotes supersede older quotes for what is currently
quoted. Supplier preferences are not reclassified as buyer constraints, and a counterquote is
not treated as proof that every earlier term was rejected. Arena transport errors are separated
from supplier feedback. Prose conditions remain in the original messages for the reviewer to
interpret; this is not a new semantic extractor or an LLM-maintained belief database.

The same categorical assessment and conditional evidence-selection calls are used. Prior model
judgments are not fed back as facts. Neither private supplier economics, future replies nor final
scores enter a decision's review. The reviewer cannot change an offer, price, acceptance or email.
The default buyer and default reviewer mode remain unchanged. The discarded persistent policy
has not been restored.

## Test scope and scores

One fresh v1.9 negotiation per case, with decision capture enabled:

| Source | Cases | Scores / 100 | Outcome |
|---|---|---|---|
| Synthetic | G03, G06, G10 | 64.91, 84.56, 88.78; mean 79.4 | Three valid deals, no fallbacks |
| Hosted practice | P08, P11 | 60.40, 70.99 | Two valid deals, no buyer fallback |

Only two practice sessions were used. No final/rehearsal sessions were opened. Synthetic
reconciliation found no infeasible published supplier offers, selected-offer mismatches or score
mismatches. There were ten synthetic supplier LLM calls. These scores belong to v1.9 and cannot
be attributed to the observer, which ran only after the negotiations completed.

[Synthetic run](runs/synthetic-r01/summary.json) · [Reconciliation](runs/synthetic-r01/reconciliation.json) ·
[Exact hosted records](runs/practice-r01/results.json).

## Reviewer comparison

The five cases produced **27 decision snapshots**. Each snapshot was reviewed twice by each
variant, in baseline/feedback then feedback/baseline order. All paired original-input hashes
matched. This is 27 unique decisions, not 108 independent negotiation examples. All four passes
used unchanged source and prompts. No output-driven tuning or selective retry was performed.

Both repetitions produced the following counts per 27 decisions:

| Observation | Existing reviewer | With feedback |
|---|---:|---:|
| NO_ISSUE | 5 | 8 |
| Retained RECONSIDER | 2 | 2 |
| Initial flag rejected by evidence stage | 20 | 17 |
| Transport/provider failure | 0 | 0 |

There were **190 reviewer API calls** in total; flagged decisions use an additional evidence
call. Unsupported flags remain unavailable, never NO_ISSUE. Every review command therefore
returned exit code 1 while saving its full results. That is the existing explicit handling of
unsupported findings, not a hidden retry or missing report.

More available observations do not establish accuracy. We inspected all retained flags and the
targeted duration/clause decisions; these are agent judgments, not blinded human labels.

| Finding | Existing reviewer | With feedback | Inspection |
|---|---|---|---|
| G06 decisions 1 and 2: indexed supplier package versus fixed-price buyer draft | No retained finding | RECONSIDER:index_clause with the actual supplier quotation cited | Source supports the package discrepancy and a potentially relevant alternative. It does not prove a mandatory condition was violated, that fixed pricing is wrong, or that adopting the clause improves value. |
| P11 decision 0: buyer requests 300 ppm with a <=1500 must-have | Retained quality flag | NO_ISSUE | The original flag did not establish a mistake; the proposal satisfies the requirement. |
| G10 decision 1: lower buyer bid despite customer-loss news | Retained unit-price flag | Initial flag rejected as unsupported | The original citation did not establish a missed condition; a lower bid is normal bargaining. The feedback result is unavailable, not a verified clean bill. |
| G03 decision 2: repeated 12-month quotes versus 24-month draft | NO_ISSUE | Initial RECONSIDER:contract_months, rejected by evidence stage | The reviewer notices the duration topic but still produces no usable retained finding. A quoted preference alone is not a hard constraint. |
| G06 final acceptance | Initial flag rejected as unsupported | NO_ISSUE | Valid final acceptance should not be flagged merely to seek further bargaining. |

The feedback version's four retained findings across the two repetitions all concerned the two
G06 decisions. No hosted practice decision had a retained finding with feedback. P08 still had
four unsupported observations per pass; P11 had five. We have no active hosted intervention or
measured score benefit from this change.

[Paired comparison](reviews/paired-r01/comparison.json) ·
[Baseline pass 1](reviews/paired-r01/pass1-baseline/report.md) ·
[Feedback pass 1](reviews/paired-r01/pass1-feedback/report.md) ·
[Feedback pass 2](reviews/paired-r01/pass2-feedback/report.md).

## Verification and conclusion

**240 tests passed, one skipped.** New tests exercise prefix-only feedback, current versus
superseded quotations, cross-case isolation, separate term packages, transport errors, evidence
selection and unchanged default review requests. The existing complete reference-wave test
still proves identical buyer actions and outcomes with capture on/off. Lint passed.

Keep feedback optional and observational. The narrow result is improved relevance on G06 and
removal of one unsupported P11 finding, reproduced on identical snapshots. The small known-case
sample, weak overall availability, same-model evidence check and unresolved G03 finding prevent
a general reliability claim. Better interpretation is not yet better negotiation.

## Commands

From `starter-kit/`, review an existing captured run with feedback (model calls only):

```bash
.venv/bin/python scripts/observe_decisions.py \
  ../evaluations/observation-feedback/runs/synthetic-r01 \
  --feedback --out ../evaluations/observation-feedback/reviews/feedback-next
```

Compare the two modes twice on those same synthetic snapshots:

```bash
.venv/bin/python scripts/compare_feedback.py \
  ../evaluations/observation-feedback/runs/synthetic-r01 \
  --out ../evaluations/observation-feedback/reviews/comparison-next
```

Add exact hosted run paths as additional inputs to include practice snapshots. New review output
directories must be fresh. Omit `--feedback` on `observe_decisions.py` to use the original reviewer.
To rebuild the completed comparison without any model calls:

```bash
.venv/bin/python scripts/compare_feedback.py --report-only \
  --out ../evaluations/observation-feedback/reviews/paired-r01
```
