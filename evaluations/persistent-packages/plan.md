# Persistent supplier-package experiment

- [x] Read the workflow principles and ground the policy, simulator and hosted quota.
- [x] Implement an opt-in persistent package policy and verify its outgoing messages.
- [x] Audit the supplier's financial validity, choices and dependence on buyer proposals.
- [x] Run five alternating baseline/experimental passes on G03, G06, G04 and G10.
- [x] Run paired hosted practice cases, sequentially, with all attempts retained.
- [x] Reconcile scores, actual interventions, errors, terms and negotiation lengths.
- [x] Independent review and final recommendation; retain the v1.9 default.

## Frozen hypothesis and scope

Repeated supplier quotes on a different package can support switching the buyer's main package
and continuing price negotiation on those terms. This may improve or worsen the final score.
Success requires actual changed wire messages, persistent terms, valid binding offers, and a
repeatable score improvement. Merely enabling an option is not evidence of an intervention.

Use two consecutive validated supplier packages with identical nonprice terms, a positive
observed price concession, and a package different from the buyer's current main offer. Start
with the latest quoted price minus that observed concession. On subsequent matching-package
quotes, close 30% of the remaining price gap from the last actually sent price, using the
existing policy's concession step. Bound prices by the actual opening/alternative cost limit
and the relationship optimum where applicable, not the cost of an unaccepted counteroffer.
Continuation is reconstructed from actually sent main sheets so restart uses the same prices:
the latest buyer package matches and an earlier buyer package differed. This can also continue
a package already adopted by v1.9. Identical outgoing sheets are not counted as interventions.
Do not change terminal actions, mandatory requirements or case data. Do not infer that a
supplier preference is a hard constraint. No new buyer model call is needed for this test.

G03/G06 are the known duration/clause weaknesses. G04 checks payment trades and G10 checks
tight negotiation room. These are development cases, not held-out evidence. Keep the original
sealed suite and private economics unchanged. Five passes per arm permit a limited view of
variation, not a leaderboard prediction. Supplier LLM stays gpt-6.1-sol with its current menu.

Inspect saved public practice observations for eligibility before selecting practice cases;
do not select on final score. If no natural intervention exists, record that explicitly and
use P08/P10/P11 as clause, delivery and quality non-regression checks. Start with two paired
passes, up to 12 practice sessions, extending only if an actual intervention needs replication.
Run hosted arms sequentially through one benchmark process at a time. Quota check at framing:
257 sessions left, limit 600 (live API supersedes the older 200-session brief).

Independent supplier audit must distinguish financial validity from realism: action prices are
scheduled by code, model selects actions, email prose is templated, and synthetic scoring omits
relationship-health effects. Check whether the model accepts feasible bids and declines others;
do not adjust supplier profiles to help the new buyer. Preserve failures and unfavorable results.

The experiment is reversible and remains CLI opt-in. Record source/input hashes, all requests,
supplier fallbacks and buyer fallbacks. Never run final/rehearsal sessions for this experiment.
