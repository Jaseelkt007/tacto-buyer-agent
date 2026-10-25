# Supplier reply interpretation

User request: establish a technical implementation for converting a supplier reply and earlier exchanges into structured input for the existing policy, then make it testable in the current system.

## Work plan

- [x] Ground: trace supplier replies, policy state, reviewer, and model transport.
- [x] Sketch: compare two designs for the JSON boundary and policy consumer.
- [x] Agree: synthesize interfaces within the requested scope; no approval checkpoint requested.
- [x] Implement: optional integration, runnable examples, and behavioral verification.
- [x] Scrap/revise: exclude an LLM availability gate, retain advisory readings, and tighten package-specific schema fields.

Design comparison: frame → two isolated candidates → independent cross-review → select → integrate useful constraints → verify.

## Grounding

`ProcuDealAgent.decide()` calls `Negotiator.decide(threads)`, then optional legacy adapters, then the writer. `Negotiator.decide()` runs `observe()` on new replies before acceptance checks. `observe()` parses regex signals, updates history and estimates, then calls `react()`. `react()` may adopt the first quoted index clause before evaluating alternative sheets; its clause-adopted guard skips alternatives with different clauses. `offer()` prices `side.mix`, generates alternative sheets and selects claims. The existing feedback reviewer receives captured completed decisions and runs offline; it does not update live policy state.

Existing `feedback.with_feedback()` reconstructs public exchange history from a decision snapshot, preserving separately quoted packages. It depends on a proposed action, so a pre-decision interpreter cannot simply call it with a future move. Do not introduce future decisions, results, private profiles, benchmark scores, or other cases into model input.

P08 is one supplier with multiple packages, not competing suppliers. Its quoted alternative has lower contemporary total cost; that does not prove it would beat the eventual negotiated result. No P08-specific rule belongs in the implementation.

## Design rubric

1. Conditions remain attached to their exact supplier, message, and package; preferences never become hard constraints automatically.
2. The policy owns prices and actions; model output is a bounded interpretation, not an arbitrary state patch.
3. Prior public exchanges are usable without treating previous model claims or repeated offers as proof.
4. Invalid, stale, unavailable, ambiguous or conflicting interpretations have explicit behavior; default v1.9 stays unchanged.
5. A small, runnable API demonstrates an actual policy consumer and meaningful counterfactual tests without claiming score improvement.

Architecture skill defaults reference unavailable Claude/Grok models. Design roles use available inherited models in isolated paths.

## Delivered

Candidate A plus B's code-owned references, source values and envelope; independent review in `design/`. One structured-output interpreter, typed policy connection, replay CLI, optional benchmark observation flag, and behavioral tests. Runtime consumption is diagnostic comparison only; no new pricing or acceptance policy is introduced. Eight offline model calls are archived with both initial failures and the corrected schema verification. See README for results and limitations.
