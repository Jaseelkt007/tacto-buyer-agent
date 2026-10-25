# Reply interpretation foundation

Status: enabled by default for ProcuDeal at the user's request after the live timing check; advisory only. The interpreter receives public supplier replies and earlier exchanges; the policy receives a typed `ReplyView` and records comparisons to its proposal. This version grants no semantic authority to change binding decisions. It does not fix the separate clause-preservation filter and does not replace the feedback reviewer. Set `PROCUDEAL_REPLY_INTERPRETATION=off` or use the evaluation runners' `--no-interpret-replies` flag to disable this stage.

The earlier decision reviewer is now also live and enabled by default, with exchange feedback. Disable it independently with `PROCUDEAL_DECISION_REVIEW=off`; disable **both** stages for the original v1.9 baseline. [Combined-model verification](runs/dual-default-report-r01/report.md): 64 decisions, maximum 10.35 seconds, no thread timeouts, 12 valid deals, and 271 tests passed with one skip.

Architecture and policy boundary: [docs/reply-interpretation.md](../../docs/reply-interpretation.md).

Latest check: [live finalization report](runs/finalization-r01/report.md). Four practice cases and ten concurrent synthetic cases completed, with 72 buyer decisions, a maximum complete decision time of 12.98 seconds, and no thread timeouts. Three interpreter calls hit their eight-second deadline and fell back. All four practice scores/actions/terms matched the saved v1.9 baseline. This is a timing smoke check, not evidence to enable semantic control.

Default integration is verified separately: **265 tests passed, 1 skipped**, including the production agent factory and a local two-case final-wave run with an injected model response. [Verification details](default-integration.md).

## Commands

From `starter-kit/`, validate the six saved inputs without calling a model:

```bash
.venv/bin/python scripts/interpret_replies.py \
  ../evaluations/reply-interpretation/capture-smoke.json --validate-only
```

Interpret those replies without opening negotiation sessions (use a fresh output directory):

```bash
.venv/bin/python scripts/interpret_replies.py \
  ../evaluations/reply-interpretation/capture-smoke.json \
  --out ../evaluations/reply-interpretation/runs/my-replay-01
```

Run the local behavioral checks:

```bash
.venv/bin/pytest -q tests/test_reply_interpretation.py
```

For a later, explicit live practice observation, the existing runner now supports:

```bash
.venv/bin/python scripts/bench.py --agent procudeal case:P08 \
  --interpret-replies --observe --reconsider off --note reply-interpretation-observe
```

The last command **opens a practice session** and adds live model latency. It was tested on P07/P08/P10/P18 in the finalization check linked above. After that check the interpreter was enabled by default, so `--interpret-replies` is now redundant unless overriding an environment opt-out. The final runner receives it through the same ProcuDeal factory. Timed live actions can differ due to delay even though interpretation content cannot change terms.

## JSON and provenance

The model output schema is generated from the actual current packages and supplier text sources. Every run saves it as `response_schema` alongside the request context, model response, source hashes and validated reading. The reading's `quoted_value` and `value_source` are supplied by code from the referenced sheet; the model never generates them.

For an illustrative message “This price requires a three-year agreement”, a reading can contain:

```json
{
  "package_ref": "package:0",
  "kind": "condition",
  "field": "contract_months",
  "evidence": [{
    "source_ref": "message:sup:example:2:body",
    "quote": "This price requires a three-year agreement."
  }],
  "quoted_value": 36,
  "value_source": "offer:example-1",
  "policy_effect": "advisory_only"
}
```

The model supplies the first four fields; code supplies the last three. The complete reading also includes case/supplier identity, current packages, context hash, availability/error status, and `semantic_authority: none`. “Available” means a structurally valid interpretation was obtained, not that it is true or optimal.

## Saved-reply checks

Inputs are decision-1 public prefixes from P07, P08, P10, P18, G03 and G06. Original snapshots are copied into `capture-smoke.json` with their existing hashes. The replay selects only the public case fields and the target supplier's message prefix; the completed action and engine estimates are not sent to the model. These are development examples, not held-out evaluation.

| Run | Calls | Outcome |
|---|---:|---|
| [smoke-r01](runs/smoke-r01/summary.json) | 6 | Four available readings, one P07 field-not-quoted rejection, one P08 deadline timeout |
| [schema-r02](runs/schema-r02/summary.json) | 2 | Corrected schema accepted by the API; P07 and P08 both produced available readings |

The schema correction restricts the fields separately for each package. A condition on a known field absent from that package must use `unscoped`. This closes the mismatch between the initially permitted model output and runtime validation. The first run is retained; it is not rewritten as success. The timeout limit remains eight seconds and there are no automatic retries.

Manual inspection:

- P08 identifies the link between long duration and an index clause, retains the two clauses separately, and preserves the hedge-until-March-2027 statement as quoted, unscoped evidence. It does not turn this into a permanent global `hedged` flag.
- P18 identifies the index clause condition. Its price-conflict flag may reflect alternative-package wording rather than a genuine contradiction; provenance checks cannot decide that.
- P10 identifies the supplier's explicit statement connecting its revised price to volume and duration. This does not quantify the discount for changing either independently.
- G03/G06 record the supplier's statement that the package terms are linked, without inventing separate prices.
- **P07 remains a semantic limitation:** the second response labels “higher volume would help ... can improve the price” as an unscoped condition. That wording does not establish a hard condition on the current offer. No rule or restriction is created from it. A real quote is not proof of the chosen category.

These initial offline results confirm transport, structured output, provenance handling and context availability. They do not establish semantic accuracy, generalization, or a score improvement. No negotiation sessions were opened during those offline checks; the subsequent live timing check is reported separately above.

## Verification

The full existing suite plus initial new tests passed: 261 passed, 1 skipped. After the schema correction, the focused interpreter/feedback/reconsideration suite passed: 53 passed. Lint passed on all touched Python files. The new tests exercise the real policy and verify identical messages in controlled fixtures with successful or failed interpretation, together with stale/cross-supplier/invented evidence rejection, package separation, cache isolation and original-history feedback.

The independent review reproduced a live scheduling difference caused by an eight-second interpretation delay. The final schema therefore says `semantic_authority: none`, not that live actions can never differ. See [implementation review](design/implementation-review.md).
