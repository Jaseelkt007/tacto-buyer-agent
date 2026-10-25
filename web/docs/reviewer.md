# Decision reviewer and exchange feedback

The live demo includes a decision-review model beside the supplier conversation. It is an
experimental offline branch. The original v1.9 replay, timeline, case scores, and ten-case mean
come from their original saved runs.

The engine proposes a counteroffer, acceptance, or walk-away. With observation enabled,
`observation.CaptureAgent` captures that action and its decision-time public context, then returns
the original action unchanged. The separate review command runs after negotiation. The model
does not approve, reject, or change the buyer's action.

With feedback enabled, `feedback.with_feedback` reconstructs earlier offers and replies,
quotation history, repeated nonprice terms, and current draft differences from the same public
message prefix. It rebuilds this ledger for each snapshot. Prior reviewer judgments and later
supplier replies are not feedback inputs.

The map shows two dashed input paths: engine decision snapshot to reviewer, and supplier
exchange history to reviewer. The latter loops along the outside of the supplier lane. There is
no reviewer-to-policy edge. On narrow screens, visible input captions retain the reading order.
Clicking the reviewer pauses replay and opens its independent evidence pane. On mobile, the pane
scrolls into view. Changing the review example never seeks the replay or selects a supplier.

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

The latest hosted check covered 50 decisions: 24 NO_ISSUE, 26 unsupported observations, zero
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
The observer map does not depict that adapter as an active buyer-policy loop.

## Implementation and design

- `scripts/sync-reviewer.py` owns the allowlisted export and integrity checks.
- `src/lib/reviewer.ts` owns the reviewer node identity, input edges, and saved-result presentation.
- `src/components/live/ReviewExtension.tsx` owns the reviewer card and independent example selection.
- `RunMonitor.tsx` owns replay controls and the selected inspector pane.
- `EngineConnections.tsx` measures map nodes and draws the original edges plus dashed review inputs.

The design keeps an observer branch in the existing map so the added model is immediately visible.
A separate reviewer route was considered but added navigation and hid the requested extra box.
The chosen shape retains semantic buttons, expandable evidence, and mobile reading order from
that alternative. The replay event union remains unchanged: display nodes do not imply recorded
buyer stages.
