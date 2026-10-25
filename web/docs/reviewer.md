# Advisory models and supplier feedback

The live demo shows the current buyer architecture alongside the original recorded v1.9 replay.
The current agent enables two advisory models by default: `gpt-6.1-sol` reads supplier replies
before the policy, and `gpt-6-luna` reviews the prepared response before dispatch. Code owns
binding prices, offers, acceptance and walk-away. Neither model changes those actions.

The original v1.9 replay used neither advisory stage. Its timeline, case scores and ten-case
mean still come from the original saved runs. The model inspectors explain the current pipeline
and show separate saved review examples; they never add invented events to that replay.

The engine proposes a counteroffer, acceptance, or walk-away. The writer prepares the response,
then `observation.LiveDecisionReviewer` captures it with its public context and reviews it before
dispatch. The reviewer has one eight-second deadline, limited by the remaining 45-second decision
budget. An unavailable review leaves the action unchanged. The offline review command remains
available and produced the saved examples below.

On a nonterminal supplier reply, `ReplyInterpreter.read` rebuilds the same thread's public history
and returns structured conditions, preferences and source quotations. Code validates the schema,
package scope, exact quotations and annotated fields. The policy receives these advisory readings
before its next decision. No old model interpretations or future messages become feedback input.
See [the reply interpretation contract](../../docs/reply-interpretation.md).

With feedback enabled, `feedback.with_feedback` reconstructs earlier offers and replies,
quotation history, repeated nonprice terms, and current draft differences from the same public
message prefix. It rebuilds this ledger for each snapshot. Prior reviewer judgments and later
supplier replies are not feedback inputs.

The map aligns three columns of compact cards. The prepared response goes from writer to
reviewer to supplier conversation. A separate bottom feedback lane shows supplier conversation
to reply interpreter to decision engine. Earlier public exchanges also feed the reviewer through
a shared outside rail. The return to the policy uses the gutter beside the engine cards; arrows
do not cross card interiors. There is no reviewer-verdict-to-policy edge.

On narrow screens, the diagram stacks vertically and retains explicit feedback captions instead
of drawing long arrows across the page. Clicking either model pauses replay and opens its own
inspector. On mobile, that pane scrolls into view. Changing the saved review example never seeks
the replay or selects a supplier.

## Saved examples

These examples come from a separate synthetic study, not the selected P-case replay.

| Example | Case / decision index | Saved observation | Review file |
|---|---|---|---|
| Counteroffer | G06 / 2 | RECONSIDER on index clause, with source `message:sup:70340:4` | `pass1-feedback/0006.json` |
| Acceptance | G06 / 4 | NO_ISSUE | `pass1-feedback/0008.json` |
| Unsupported | G03 / 2 | Initial duration flag rejected by evidence check; unavailable | `pass1-feedback/0002.json` |

`gpt-6-luna` chooses a verdict and affected field together. A flagged observation requires a
second call selecting evidence for that specific flag. Unsupported flags and failures are
unavailable observations. A source citation establishes provenance, not that an interpretation
is correct. NO_ISSUE means no supported issue was found, not that a decision is optimal.

The counteroffer example compares a fixed-price €14.34 draft with the supplier's €14.77 indexed
quotation. The ledger records two quotations of the same index package. Its own discrepancy
record says the existence of a violation is not determined. The review does not alter the draft.

The saved offline check covered 50 decisions: 24 NO_ISSUE, 26 unsupported observations, zero
retained flags, and zero changed buyer actions. The same v1.9 actions and case scores were
reproduced. This does not measure negotiation benefit from the reviewer.

## Data and reproduction

`src/data/reviewer.json` contains only the terms, public exchange references, ledger facts, saved
review results, and provenance needed for these examples. No raw packet, private supplier profile,
future outcome, or negotiation score is sent to the browser as review input. Recorded model-call
time belongs to the offline study and is not added to the v1.9 replay runtime.

With the local experiment artifacts available, run these commands from `web/`:

```bash
npm run sync:reviewer
npm run check:reviewer
```

The exporter uses only the Python standard library and local saved artifacts. It verifies the
original and feedback-augmented packet hashes, case/decision pairing, evidence membership, and
message-prefix bounds before writing a deterministic public projection. Production builds use
the committed projection and require no experiment files, model connection, or API key.

## Separate live experiment

The optional `reconsideration.Reconsideration` adapter is a different experiment. Between the
engine and writer, it can append one code-priced supplier package to an eligible counteroffer.
The model chooses PROCEED or RECONSIDER; code validates the package and cost bound. It is off by
default and does not change terminal actions, first proposals, or final/agreed exchanges.
The architecture map does not depict that adapter as an active buyer-policy loop.

## Implementation and design

- `scripts/sync-reviewer.py` owns the allowlisted export and integrity checks.
- `src/lib/architecture.ts` owns the display-node identities and reply-interpreter metadata.
- `src/lib/reviewer.ts` owns reviewer metadata and saved-result presentation.
- `src/components/live/ReviewExtension.tsx` owns the reviewer card and independent example selection.
- `src/components/live/ReplyInterpretation.tsx` owns the reply-interpreter card and its inspector.
- `RunMonitor.tsx` owns replay controls and the selected inspector pane.
- `EngineConnections.tsx` measures all ten map nodes and routes eleven directed connections.

The model cards share the compact sizing of the engine cards. The feedback lane separates the
return path from the outgoing response, while the inspector carries the detailed explanation.
The replay event union remains unchanged: display nodes do not imply recorded buyer stages.
