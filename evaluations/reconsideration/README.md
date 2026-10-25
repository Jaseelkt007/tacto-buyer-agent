# Reconsideration: typed supplier packages

The bridge is implemented and verified, but negotiation improvement is **not verified**. Keep it
off by default. A decision model approving a valid alternative does not establish that the price
is attractive to the supplier. [Protocol](plan.md) · [Decision trail](decisions.tsv).

## What was tested

The engine creates its normal counteroffer. Code resolves a typed `(supplier_id, message_id,
term_sheet_id)` reference against the latest supplier message, preserves that package's nonprice
terms, and calculates a price at no greater estimated buyer cost than the original main offer.
The adapter may append one alternative, within the three-sheet limit. It never replaces the main
sheet, changes price history, rewrites case requirements, or vetoes acceptance. First moves,
terminal exchanges, holds, notes and previously sent packages are excluded.

The deterministic arm appends whenever the checks permit. The decision arm adds a single binary
`gpt-6-luna` Decisions call: PROCEED or RECONSIDER. No extra extraction model is needed for these
structured supplier quotes. Prose-only facts and date-scoped hedge interpretation are not covered.

## Results

Two interleaved passes per arm, ten synthetic cases per pass:

| Arm | Mean / 100 | Pass scores | Alternatives sent | Gate calls | Supplier fallbacks |
|---|---:|---|---:|---:|---:|
| v1.9 baseline | 79.85 | 79.6, 80.1 | 0 | 0 | 0 |
| Deterministic adapter | 79.60 | 79.7, 79.5 | 8 | 0 | 1 |
| Decision-gated adapter | 80.10 | 79.6, 80.6 | 10 | 10 | 1 |

All 60 cases closed deals. No broken must-haves, buyer fallbacks, adapter errors, HTTP errors or
thread timeouts occurred. All six reconciliation reports passed. There were 260 supplier model
calls; ConnectError caused a reference-supplier fallback in deterministic pass 2/G04 and gated
pass 2/G09. Both attempts remain included. Input seals and evaluated source hashes match across
all six runs. [Machine-readable comparison](runs/local-r01/comparison.json).

The gate approved **10/10** local alternatives, so it demonstrated no useful selection over the
code adapter. The 0.25-point mean advantage over baseline is smaller than the run spread and is
confounded by stochastic supplier responses and fallbacks. It is not evidence of generalization,
statistical improvement, or a leaderboard advantage. Cases were already inspected before this work.

Independent post-run inspection checked all 18 extra sheets against their public wire messages,
source packages, must-haves and recomputed buyer cost bounds. All passed. **Only six were feasible
under private supplier economics, and two were accepted**, both in G04 in the gated arm. Private
floors are diagnostic only and were never available to the buyer or gate.
[Reproducible alternative audit](runs/local-r01/alternative-audit.json).

Example: the added G03 12-month package offered 54.17 per unit against the synthetic supplier's
private floor of 78.73. The buyer-cost calculation was correct: shortening the contract leaves
more uncovered demand. But holding the new package to the cost of our unaccepted 24-month bid
made its price commercially infeasible. The model saying RECONSIDER did not repair that problem.
The accepted G04 alternative saved only 7.12 in buyer cost versus its accompanying main sheet.

### Did the negotiation itself change?

The public transcripts show the following in both passes. Email counts exclude the final API
acceptance action.

| Case | Baseline | Adapter behavior | Final agreement and email count |
|---|---|---|---|
| G03 | Three successive 24-month bids | Both adapters append a 12-month bid at 54.17 to email 2; email 3 returns to only 24 months | All arms: 12 months, 84.25/unit, payment 10 days; three buyer emails |
| G06 | Four successive fixed-price bids | Both adapters append the supplier's indexed package at 14.06 to email 2; later bids remain fixed | All arms: indexed, 14.00/unit, payment 90 days; four buyer emails |
| G04 | Agreement at 19.26/unit, payment 75 days | Deterministic closes at 19.31/75; gated supplier accepts the extra 19.13/45 package | Four buyer emails in all arms |

G03's 12-month contract was permitted by the case; 24 months was the buyer's proposal, not a
must-have. Acceptance therefore passed the existing validity and cost checks. Nevertheless, the
trace exposes a limitation: appending a one-off option does not teach the policy to pursue that
term combination in subsequent rounds. The gate did not change acceptance decisions or add
back-and-forth in these cases. G04 changed the agreement, but stochastic trajectories prevent
attributing that outcome to model judgment.

Source traces: [G03 baseline](runs/local-r01/pass1-off/G03-public.json),
[G03 gated](runs/local-r01/pass1-decision/G03-public.json),
[G06 baseline](runs/local-r01/pass1-off/G06-public.json),
[G06 gated](runs/local-r01/pass1-decision/G06-public.json).

## Hosted sandbox check

One run per arm on D01 and D02, six hosted sessions and zero practice-quota sessions:

| Case | Baseline / 100 | Deterministic / 100 | Decision / 100 |
|---|---:|---:|---:|
| D01 | 88.26 | 88.26 | 88.26 |
| D02 | 53.37 | 49.15 | 48.19 |

D01 offered no eligible alternative, so it does not validate an intervention in a relationship-cost
case. D02 sent one extra package in each intervention arm; the gate approved it. All runs ended
in valid deals. This is an adverse smoke result, not a controlled estimate of regression.

The three sandbox arms ran concurrently, with separate rate-limited clients; aggregate pacing was
not coordinated. That limits timing interpretation, and future comparisons should run arms
sequentially with one team-wide limiter. D02 took 6.0, 143.0 and 151.2 seconds respectively, while
the gated decision itself took 0.7472 seconds. Do not attribute the elapsed difference to model
computation. An auxiliary sandbox-status request failed DNS in the restricted environment and
succeeded with approved network access. No negotiation attempt was deleted or silently retried.

Exact records:

- Baseline: [D01](../../runs/D01/20261025T095000_procudeal_afdd7046d82128b2.json),
  [D02](../../runs/D02/20261025T095003_procudeal_72d10ad9520c1dad.json).
- Deterministic: [D01](../../runs/D01/20261025T095001_procudeal_95b7c4a1dedd1b84.json),
  [D02](../../runs/D02/20261025T095221_procudeal_403a13b3089c4169.json).
- Decision: [D01](../../runs/D01/20261025T095001_procudeal_bd52b3becc56fffa.json),
  [D02](../../runs/D02/20261025T095231_procudeal_7fc0a8d18ad108a3.json).

## What to do next

Do not enable this adapter or the gate in the final default. The useful result is that a typed
reference can safely request a code-generated package, without an extra LLM inventing facts.
The unproven part is the negotiation policy for pricing and pursuing that package.

The subsequent [persistent-package experiment](../persistent-packages/README.md) tested a new
counteroffer policy and performed worse on the selected synthetic cases. Its implementation was
removed at the user's request. The earlier observer and this structured adapter remain available.

The next investigation is an LLM reviewer that maintains evidence-backed observation state and
proposes specific validated updates. That stateful review was not implemented or evaluated by
this binary gate. See the [structured-update report](structured-update-report.md) for the exact
interface, results and distinction between the experiments. Do not use private supplier floors
to tune the buyer or treat citation existence as proof of a correct interpretation.

## Commands

From `starter-kit/`, a full fresh six-wave comparison:

```bash
.venv/bin/python scripts/compare_reconsideration.py \
  ../evaluations/reconsideration/runs/local-next --run-local
```

One local model-gated wave:

```bash
.venv/bin/python scripts/supplier_wave.py \
  --suite ../evaluations/supplier-generalization/wave-02 \
  --finish-when-done --reconsider decision \
  --out ../evaluations/reconsideration/runs/single-next
```

Use `--reconsider deterministic` for the code-only arm; omit it for v1.9. For hosted sandbox:

```bash
.venv/bin/python scripts/bench.py --agent procudeal --reconsider decision \
  case:D01 case:D02 --note reconsider-sandbox-next
```

Reproduce reports without model calls or arena sessions:

```bash
.venv/bin/python scripts/compare_reconsideration.py ../evaluations/reconsideration/runs/local-r01
.venv/bin/python scripts/audit_reconsideration.py ../evaluations/reconsideration/runs/local-r01
```

Output directories must be fresh for new negotiations. Every attempt is retained. Run the three
arms sequentially; do not start concurrent hosted benchmark processes with the same team key.

## Verification and source versions

The final full suite passed **233 tests with one skipped**, including explicit wire delivery,
delegate isolation and a non-cooperative model deadline.

After the six-wave evaluation, the caller received an outer 8-second wall deadline using at most
ten daemon workers, so DNS/executor cleanup cannot block a buyer decision. Late answers have no
route to policy state. The evaluated pre-hardening adapter is preserved with a verified manifest
hash in [evaluated-source](evaluated-source/reconsideration.py); this change did not alter package
construction or the gate prompt. A real replayed request through the final wrapper completed in
0.455 seconds with no negotiation action ([smoke record](deadline-smoke.json)).

GPT-6 Astra independently reviewed the adapter, tests and all 18 wire alternatives. The available
reviewer is a different model, not an independent provider or a human certification.
The final review found no material blocker. One diagnostic limitation remains: pool exhaustion
marks `model_called` before a worker slot is acquired, so it can overcount attempted calls. No
pool exhaustion occurred in the recorded evaluation.
