# Supplier-package reconsideration experiment

- [x] Read the Principles section and existing observer/policy implementation.
- [x] Frame a bounded test and preserve the current buyer as the baseline.
- [x] Implement a typed supplier-package reference and deterministic adapter.
- [x] Verify invalid references, binding terms, cost limits, terminal behavior and failure isolation.
- [x] Run two interleaved three-arm synthetic passes with fresh supplier calls.
- [x] Assess results and run a bounded six-session hosted sandbox comparison.
- [x] Audit the trail, document conclusions and preserve defaults.

## Hypothesis and success criteria

A decision flag may usefully trigger a code-priced alternative using the supplier's actual
nonprice terms. The experiment succeeds technically when those exact referenced terms reach the
wire, pass allowed-option and must-have checks, cost no more than the existing main counteroffer
under the same buyer estimates, and do not change defaults or terminal acceptances.
Negotiation improvement is NOT VERIFIED unless executed interventions improve outcomes across
repeated paired passes without new constraint failures. This is development evidence on already
inspected synthetic cases, not a hidden leaderboard prediction.

## Three arms

1. Baseline: unchanged v1.9.
2. Deterministic: whenever eligible, append one alternative using a supplier-quoted package.
3. Decision-gated: the same alternative is appended only on a binary RECONSIDER model response.

The model does not generate facts or prices. The bridge is an immutable reference containing
supplier ID, message ID and term-sheet ID. Code resolves it against the latest supplier message,
preserves the full nonprice package, fills omitted fields from parsed standard terms, and prices
it using the existing total-cost inverse. This is a buyer-equivalent-cost proposal, not a claim
that the supplier will accept it. No supplier reservation price or qualitative discount is inferred.

The original main sheet remains first. At most one new sheet is added, within the API's three-sheet
limit. Every sheet is binding if chosen. Do not adapt accepts, walkaways, holds, notes, first moves,
agreed/final_offer messages or packages already sent. Never change must-haves, dossier estimates,
case options or the engine's main-price history. The legacy hybrid is off.

An 8-second hard deadline covers a single Decisions request (`gpt-6-luna`); invalid/refused/late
responses retain the original move and are counted. Errors must not trigger the kit LLM fallback.
The primary experiment uses the sealed Wave 02 suite and two full passes per arm, in orders
baseline/deterministic/decision and decision/deterministic/baseline. All attempts and failures stay.
The deterministic arm isolates the adapter's value from the gate's value. Supplier randomness is
not controlled by a common seed; report per-case outcomes, changes, errors and spread.

## Scope

One adapter module, one optional agent hook, CLI flags, focused tests, a reproducible comparison
report and artifacts. This first adapter is limited to structured supplier packages; prose-only
conditions such as partial hedge dates remain outside its coverage.
