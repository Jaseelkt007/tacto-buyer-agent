# Earlier structured-update experiment

This report describes the experiment before the now-removed persistent-package policy.
The earlier observer and structured adapter remain available, off by default. v1.9 is the default.

## What the structured update meant

The input was a reference to a real supplier quotation, not an instruction to rewrite the policy
and not a collection of LLM-inferred supplier facts. An actual G03 reference was:

```json
{
  "supplier_id": "sup:70190",
  "message_id": "msg:70190-1-2",
  "term_sheet_id": "offer:70190-1"
}
```

Code resolved that reference against the latest supplier message, read its terms, validated
allowed values, fixed terms and mandatory requirements, and calculated an alternative price.
The alternative could not exceed the estimated buyer cost of the original main counteroffer.

The actual code-generated G03 alternative was:

```json
{
  "unit_price": 54.17,
  "payment_days": 10,
  "contract_months": 12
}
```

That alternative was added alongside the main proposal. It did not replace the main offer,
update the policy's persistent term mix or price history, or veto acceptance. On later rounds,
the policy could return to its original preferred terms.

## What the LLM did

There were two intervention arms:

1. **Code-only adapter:** append the alternative whenever the code checks permitted it.
2. **Decision-gated adapter:** give `gpt-6-luna` the public case, thread history, original offer
   and code-priced alternative. `RECONSIDER` allowed the addition; `PROCEED` kept the original.

The second arm did include an LLM. It selected between two actions; it did not extract new facts,
maintain an observation state, calculate a price or produce an explanatory assessment. The
supplier model was separate from this buyer-side decision gate.

The earlier [observation-only experiment](../decision-observer/README.md) was a third mechanism:
it captured decision-time evidence and reviewed it after negotiation. Its answers did not change
the buyer's actions.

## Measured results

Two interleaved passes per arm, ten synthetic cases per pass:

| Arm | Mean score / 100 | Pass scores | Extra offers | Decision calls |
|---|---:|---|---:|---:|
| v1.9 | 79.85 | 79.6, 80.1 | 0 | 0 |
| Code-only structured adapter | 79.60 | 79.7, 79.5 | 8 | 0 |
| LLM-gated structured adapter | 80.10 | 79.6, 80.6 | 10 | 10 |

All 60 cases closed valid deals. No buyer fallbacks or failed must-haves occurred. One supplier
fallback occurred in each intervention arm; both remain included. The 0.25-point gated advantage
over baseline is smaller than run variation and does not demonstrate improvement.

The gate approved **10 of 10** alternatives, so it did not demonstrate useful selection.
All **18** additional offers passed source, wire and buyer-cost checks. Only **six** were feasible
under the simulated supplier's private economics, and **two** were accepted immediately.
Those private limits were used only in the post-run audit, never as buyer/model input.

G03 illustrates the gap: 54.17 was valid and affordable for the buyer, but below the supplier's
private 78.73 floor. The model's approval did not make it commercially viable. G03 and G06
retained the same final agreements and email counts across the three arms in both passes.

Hosted sandbox smoke checks (one run per arm) produced:

| Case | v1.9 | Code-only adapter | LLM-gated adapter |
|---|---:|---:|---:|
| D01 | 88.26 | 88.26 | 88.26 |
| D02 | 53.37 | 49.15 | 48.19 |

D01 had no intervention. D02 was adverse, but one concurrent smoke comparison cannot establish
a controlled regression estimate. No hosted P practice cases were run for this particular
adapter experiment. The later persistent-policy practice results belong to a different test.

## What this established, and what remains missing

The structured reference safely connected supplier evidence to a code-generated offer. That
interface worked. The experiment did not establish that the offer was useful, or that the binary
LLM gate selected well.

A stateful LLM reviewer remains untested: it would review each new reply against accumulated
observations, distinguish explicit terms from claims and interpretations, and propose specific
evidence-backed updates. Those updates would still need validation before affecting policy.
An existing source ID alone does not prove an interpretation is correct.

## Evidence

- [Full experiment report](README.md)
- [Per-run and per-case comparison](runs/local-r01/comparison.json)
- [Independent post-run offer audit](runs/local-r01/alternative-audit.json)
- [Actual G03 gated trace](runs/local-r01/pass1-decision/G03-private.json)
- [Observer results](../decision-observer/interpretation.md)

The subsequent persistent-package implementation was removed at the user's request. Its results
and source snapshots remain in [the historical experiment folder](../persistent-packages/README.md),
outside the active agent, so negative results are not lost.
