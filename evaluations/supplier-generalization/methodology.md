# Synthetic supplier stress evaluation

## Question and scope

Does frozen v1.9 negotiate sensibly when familiar signals conflict with current quotes, when
contract terms interact, and when supplier IDs or ordering change? This evaluation tests those
behaviors locally. It does not estimate the real arena's leaderboard score.

Wave 01 was a development and integration suite. Its ten cases produced 93.6/100 in one parallel
run. Cases were deliberately obvious, and the supplier policy reduced counteroffer margins to
zero above its financial floor by the final round. That result demonstrated functioning software
under favorable assumptions. It did not establish generalization.

Wave 02 is a prospective stress suite designed after inspecting Wave 01. It is therefore not an
independently sampled, untouched benchmark. Freeze its cases and buyer source before the first
negotiation. Any later tuning makes it a development set; evaluate the revised buyer on another
new suite. Never edit private costs to obtain a preferred buyer score.

## Construction

The generator writes public case files and separate private supplier profiles. Public enquiries
use the arena case schema. Known supplier identities retain access to the real data package;
new enquiry quantities, alternatives and all private economics are explicitly fictional. Two
unknown synthetic supplier IDs have identical economics and information, forming an ID control.
One RFQ is repeated with supplier ordering reversed. These pairs are dependent observations,
not additional independent samples.

The supplier LLM receives its own profile, contractual enquiry and thread. It does not receive
buyer alternatives, internal dossiers, experiment hypotheses or other suppliers' conversations.
Code calculates feasible actions, and the LLM selects an action ID. Code renders the binding
email and PDF. Private profiles define minimum margins, financing, capacity, commitment costs,
dated hedges, final counteroffer margins and concession pace independently of buyer estimates.

Wave 02 uses positive final counteroffer margins for several suppliers. Reaching the final round
does not force an offer at the financial floor. A feasible buyer proposal can still be accepted.
The oracle is the cheapest financially feasible package or alternative, not a promise that the
supplier model will offer it. All scenarios use the leverage category; supplier-health penalties,
free-form supplier prose and semantic claim grading are outside this simulator's scope.

## Freeze and execution

Generate the suite once, validate its arithmetic and allowed terms without running the buyer, and
seal the public files, private files, manifest and protocol with SHA-256 hashes. The runner rejects
changed sealed inputs and records the buyer, simulator and runner source hashes. A hash seal
detects accidental changes; it is not an independent authority or proof against deliberate edits.

The first buyer evaluation belongs to the operator. Use fresh output directories for every run.
For claims beyond a smoke test, preregister five runs of the unchanged configuration and report
every run. Do not stop after a favorable score. Model outputs are stochastic; a single difference
between paired controls is not proof of bias or a failure to generalize.

Quick completion retains the eight-minute cap and thread deadlines but closes the local wave
once every case has ended. This skips idle waiting, so it does not validate waiting through the
full cap. Use the separate full-clock command to test that behavior. Neither command starts a
hosted arena session or the actual competition final.

## Measurements and interpretation

Report all requested cases, errors, model fallbacks, buyer fallbacks, deadline failures, deal rate,
must-have compliance and accepted cost relative to the buyer's alternative. Reconcile published
offers against private feasibility and recompute synthetic scores from saved terms.

Report raw total costs and the gap to the financial oracle alongside normalized scores. Include
a static baseline that chooses the cheapest acceptable opening quote or buyer alternative. This
baseline makes no negotiating moves and is not a comparison with another negotiating agent.

For the ID and order pairs, report term choices, total-cost differences and their spread across
the preregistered runs. For stress cases, examine whether the resulting terms address the intended
mechanism. Do not grade every divergence from the private oracle as a buyer reasoning error:
some private economics are not identifiable from the information supplied to the buyer.

Scores across waves are not directly comparable: both scenarios and supplier concession behavior
change. Success supports robustness within this simulator. It cannot prove absence of overfitting,
performance against another supplier model, or generalization to the hidden final.

## Paper reporting template

Describe Wave 01 as development. Describe Wave 02 as an authored prospective stress test,
constructed after observing Wave 01 and frozen before evaluation. Report the suite hash, buyer
source hashes, model, number of attempted runs, all failures, paired-control results and limitations.
Leave Wave 02 results blank until the operator's recorded runs exist. Report subsequent fixes
separately; do not present a tuned rerun as the original held-out result.
