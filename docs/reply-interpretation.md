# Supplier reply interpretation boundary

ProcuDeal enables this advisory interpreter by default, including through the final-wave agent factory. It converts one supplier's latest reply and earlier public exchanges into offer-scoped JSON observations. The existing policy receives a typed reading before its normal decision logic. It records how those observations relate to its proposed terms; it does not change prices, acceptances, claims, or offers in this version.

## Contract

`ReplyInterpreter.read(case, supplier_id, events) -> ReplyView` owns request construction, the model call, schema/provenance checks, and per-prefix caching. The model returns references and categories. Code supplies the case/supplier identity, source quotations, current package terms, and the value quoted for an annotated field.

The input includes earlier buyer offers, supplier responses, and claim feedback from this same thread. It excludes the current proposed action, later replies, scores, hidden simulator economics, other suppliers, and earlier model interpretations. The history is rebuilt from original messages, not an accumulating model-written summary.

The authoritative package catalog is separate from observations. Observation kinds are `condition`, `preference`, `withdrawal_statement`, `conflict`, and `unclear`. An observation points to a current package or explicitly has unresolved scope. Fields without a structured representation remain `other`. An old quoted package is context only; this interpreter cannot make it available for acceptance.

Code checks the response shape, source and package scope, exact quotation, and whether an annotated field actually occurs in the referenced package. The schema enumerates fields separately for each package; known fields absent from a package can only be annotated as unscoped. It calls this **provenance validation**, not semantic verification. A quotation can be real while its interpretation is wrong. `quoted_value` is copied from the sheet; it is not a claim that the prose independently establishes that value.

## Integration

Both advisory stages are now enabled by default: `gpt-6.1-sol` interprets supplier replies before the policy, and the earlier `gpt-6-luna` decision reviewer checks the completed proposed action before dispatch. The decision reviewer includes the existing accumulated exchange feedback and retains its assessment plus conditional evidence check. It has an eight-second total caller deadline across both calls, further limited by a 45-second total buyer-decision budget. If that budget is exhausted, the review is skipped and the policy decision proceeds. Neither stage changes binding actions. `PROCUDEAL_DECISION_REVIEW=off` disables only the post-policy reviewer; `PROCUDEAL_REPLY_INTERPRETATION=off` disables only the reply interpreter.

```python
from arena_kit.agents.procudeal import ProcuDealAgent
buyer = ProcuDealAgent(complete, package)  # interpreter enabled by default
baseline = ProcuDealAgent(complete, package, interpret_replies=False)
```

The negotiator initializes/restores its existing state, collects the current reading, then processes replies and runs its usual policy. No historical model calls are made during restore. The reading lives on the corresponding supplier side and is included in the decision trace with comparisons to the proposed sheet. A different counterproposal is reported as a difference, not a violation.

The current feedback reviewer remains unchanged. This interpreter is a separate pre-decision component. It uses `gpt-6.1-sol`, the `OPENAI_API_KEY` environment variable, and an eight-second caller deadline per supplier read. API failures, refusal, malformed JSON, oversized input, and an exhausted deadline produce an unavailable reading. Final/agreed and arena feedback messages skip model interpretation. Set `PROCUDEAL_REPLY_INTERPRETATION=off` to disable it; `on` is the default. Evaluation runners also accept `--no-interpret-replies` and `--interpret-replies` as explicit overrides. Live observation adds latency: although the interpretation has no semantic authority, waiting can affect keepalive scheduling, deadline closing, or timeouts. Therefore live actions are not guaranteed identical. `semantic_authority: none` must not be read as a promise of no timing effects.

## Synthesis decision

Two designs and an independent review are stored in `evaluations/reply-interpretation/design/`. Candidate A's per-prefix projection is the base. Candidate B contributes the code-owned envelope and the separation of typed observations from policy authority. A single structured-output call can capture multiple related conditions without a second evidence-selection call pretending to prove correctness.

Rejected: arbitrary JSON patches into `Side`, permanent inferred restrictions, and an LLM gate deciding whether a structured alternative exists. The API already establishes the last fact. P08/P18's clause-preservation filter is a separate deterministic policy issue; it is deliberately not bundled into this interpretation foundation.

The transport follows the existing supplier simulator's Responses API pattern, with strict JSON Schema and an explicit deadline. The [official OpenAI Structured Outputs guide](https://developers.openai.com/api/docs/guides/structured-outputs) documents schema constraints and warns that structured outputs can still contain mistakes. The arena's authority is [brief/api.md](../brief/api.md): term sheets bind, prose does not.

## What a later behavioral consumer must specify

For each observation kind, define which policy operation it permits and why. A scoped preference might justify considering a package; it does not establish a price concession. A quoted condition must not become a buyer must-have. No semantics-only observation can override the standing sheet or final status. Passing JSON to policy is implemented separately from granting it authority to change decisions.

Verification and runnable commands are recorded in [the evaluation README](../evaluations/reply-interpretation/README.md). No score improvement is claimed by this foundation.
