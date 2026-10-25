# Interpretation of the first operator run

The pipeline completed all ten cases, and the buyer's closing checks produced ten financially
feasible agreements that cost less than the stated alternatives. Synthetic score: 78.0/100.
This is evidence of functioning negotiation and cost safeguards under the frozen stress suite.
It does not establish generalization or show that the buyer interpreted every changed mechanism.

## Integrity and execution

The copied input seal matches the run manifest. Captured buyer, simulator and runner source hashes
match the current files at analysis time. No buyer tuning or additional negotiation run was made
during this analysis.

All ten cases ran concurrently, with ten supplier requests overlapping at peak. Negotiations
finished by 28.65 seconds; the process exited after 40.677 seconds. All 43 model calls succeeded.
There were no model/buyer fallbacks, HTTP errors, thread timeouts, cap closures or failed must-haves.
Published-offer feasibility, selected-action consistency and score recomputation all passed.
Quick completion was used, so this run did not wait through the entire eight-minute cap.

## What the actual decisions show

| Cases | Observed behavior | Supported interpretation |
|---|---|---|
| G01 | Every buyer proposal requested 4,000 units; the deal kept that volume. | Avoided the impossible 6,000-unit package. This does not prove it interpreted the capacity update, because it never tested that option. |
| G02 | Every buyer proposal and the final deal used exactly 5,000 needed units. | Avoided the excess-volume discount trap in this case. |
| G03 | All three buyer proposals requested 24 months. Each supplier counter used 12 months, which the buyer accepted at the final offer. | Closing cost checks worked, but the proposal strategy did not adapt to the supplier's shorter-contract offers. |
| G04/G05 | Identical prices, payment terms, total costs and scores despite different opaque IDs. | This pair showed no observed ID sensitivity. One pair cannot establish general invariance. |
| G06 | All three buyer proposals omitted indexation. Supplier counters included it; the buyer accepted the third counter. | The buyer could accept a beneficial different package, but did not proactively propose the clause for partial hedge exposure. |
| G07 | The supplier first offered indexation. The buyer continued asking for fixed pricing and eventually agreed fixed terms. | Avoided the adverse-index package. The outcome alone does not identify which internal signal caused that choice. |
| G08/G09 | Both runs chose the same 28-day supplier, accounting for the rival's late-delivery cost. Final unit prices were 73.53 and 73.15. | Supplier selection survived reordering; price did not match exactly. Supplier responses also differed, so this is not proof of buyer ordering bias. |
| G10 | The deal cost 41,561.07 versus the alternative's 41,600.00. | Acceptance stayed inside the alternative, but the economic gain was only 38.93. |

The G08/G09 cost difference is 1,229.51, about 0.52%. Both the changed thread order and stochastic
supplier responses can contribute. Repeat the frozen pair before attributing the difference.

G03 and G06 show why outcome scores alone are insufficient. The simulated supplier volunteered
different contractual structures, and the buyer's final cost comparison accepted them. Calling
that proactive buyer understanding would overstate the evidence. These are proposal-adaptation
investigation targets, not proof that the entire private-oracle gap could have been negotiated away.

## Baseline and score interpretation

The static opening-or-alternative baseline averages 13.53/100 on these ten case entries. The
negotiated average is 78.0/100, and every case improves on that baseline. This demonstrates value
over making no negotiating moves in this simulator. It is not a comparison against another
negotiating agent. Matched controls are dependent entries in this mean.

G10 makes the normalization issue concrete. Taking the alternative already scores 88.36; the
negotiated deal scores 88.78. A rounded score of 88.8 therefore represents only 38.93 of improvement
over the alternative. Read the baseline and raw costs alongside the headline score.

Do not call the change from Wave 01's 93.6 to Wave 02's 78.0 a regression. Both scenarios and
supplier concession policies changed. The buyer source stayed fixed.

## Next evaluation step

Keep the buyer, suite, prompts and simulator unchanged for runs r02 through r05 as preregistered.
Retain every attempt, including failures. Compare score spread, contractual choices, the matched
pairs and repeated G03/G06 proposal behavior. Only then choose a general improvement to test.
Any buyer change makes these cases development evidence; a further fresh suite is needed for
new prospective validation. No further runs or buyer changes were made in this analysis.

## Wording suitable for the paper

In the first operator-run trial of an authored, frozen ten-case synthetic stress suite, the buyer
completed ten acceptable agreements with no runtime or constraint failures and a normalized score
of 78.0/100. The opaque-ID control produced identical contracts, and the reordered RFQ selected the
same supplier with a small price difference. Transcript inspection showed that beneficial contract
changes were sometimes introduced by the supplier rather than proposed by the buyer. The result
supports operational reliability and cost-based closing under the tested assumptions, while
broader generalization and stability across repetitions remain unestablished.
