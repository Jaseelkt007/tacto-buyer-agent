# Reply interpretation implementation review

Reviewed the interpreter, policy/agent integration, benchmark flag, replay CLI, and focused tests. No source edits made.

## Concrete finding: live timing changes decisions

`Negotiator.decide()` synchronously invokes the optional interpreter before `observe()`, readiness/closing logic, and `keepalive()`. A call can consume eight seconds per live supplier. Although the returned observations have no semantic authority, that elapsed time affects RFQ scheduling and later `slowest` estimates; it also consumes the arena's thread and wave deadlines.

Reproduced with the real `Negotiator.decide()` and a controlled clock, without any interpretation output:

- T1 has an open €40 quote after our €30 proposal.
- T2 has an agreed €42 quote and has waited 30 seconds.
- Baseline sends a €31.03 counteroffer to T1.
- A reader consuming eight seconds causes the same policy to send a T2 keepalive instead (`waited 38s`).

Therefore `changes_binding_decisions: false` and claims of unchanged live actions are too strong. Rename the field to describe the actual guarantee, such as `direct_policy_mutation: false`, and explicitly document that live observation incurs latency and can affect scheduling/outcomes. Offline replay has no such effect. If strict behavior-neutral observation is required, retain offline replay only. Do not freeze or subtract real clocks to hide the delay.

## Other checks

- Model input is rebuilt from allowlisted public case fields and a single supplier's original message prefix; no proposed action, result, private profile, or previous model judgments are passed.
- Sources exclude buyer and arena statements; current package links require current source evidence. Validation explicitly does not establish semantic entailment.
- Model-generated values cannot mutate quoted terms or policy state; package values in reports are copied from the source sheet.
- Default integration is off. Skipped/failed reads remain diagnostic. Late worker completion cannot mutate policy state because the worker receives only the serialized request.
- Structured source references and hashes protect against stale reports; whole-package identity is preserved.
- On resumed histories, deterministic setup/restore processes prior replies before the new current-prefix interpretation is produced. This is harmless for the advisory foundation but must be considered before a future active consumer is described as always running before `react()`.

No additional concrete correctness defects found in this pass. Semantic extraction quality and final-score effects remain unproven by these implementation checks.
