# Persistent supplier packages

This experiment did not improve negotiation results. Its policy, tests, CLI mode and comparison
runner were removed at the user's request. v1.9 is still the default. Historical results and
source snapshots are retained; this is not an available agent mode.
[Protocol](plan.md) · [Decision trail](decisions.tsv).

## Mechanism

When a supplier repeats a different complete term package and lowers its price on that same
package, code may replace the buyer's main offer with that package. The first price repeats the
observed concession; later offers close 30% of the remaining price gap from the last actual bid.
The candidate must satisfy the case terms, buyer must-haves and full-cost opening/alternative
limit. The supplier's private floor never enters the buyer's decision.

The package persists through the engine's term mix and actual wire history. Restarts reconstruct
the mix before acceptance checks; rejected sends restore the old mix. Existing final/agreed
acceptance rules remain in charge. This tests package pursuit and pricing together: it cannot
separate their individual contribution to score. Adopting supplier terms does not turn a
supplier preference into a mandatory buyer requirement.

## Evaluation records

- Corrected implementation: five alternating pairs on G03/G06/G04/G10, recorded in
  [local-r02](runs/local-r02/attempts.json). The full original Wave 02 suite is sealed and copied
  into each run; only these four cases are negotiated. Cases and profiles were not changed.
- Hosted practice: two alternating pairs on P08/P10/P11, **12 practice sessions**, recorded in
  [practice-r01](runs/practice-r01/attempts.json). Cases and arms ran sequentially through one
  hosted client at a time. No final or rehearsal sessions were started.
- Initial comparison: [local-r01](runs/local-r01/attempts.json) retains four completed pairs and
  an interrupted fifth baseline. Independent review found a restart acceptance bug while this
  run was underway. It was stopped, the bug fixed, and the corrected comparison started fresh.
  Initial adverse results are retained separately, not pooled into corrected averages. The
  [original evaluated source](evaluated-source/package_policy-before-restart-fix.py) is preserved.

The synthetic cases are development examples already inspected before implementation, not a
held-out generalization test. The model is stochastic and has no fixed random seed. All attempts
and provider fallbacks remain in the records. Source hashes are recorded at both comparison and
individual wave level; there were no policy edits during the corrected comparison.

## Synthetic results

Five alternating pairs, four cases per arm, 40 completed negotiations:

| Case | v1.9 mean / 100 | Experimental mean / 100 | Experimental range | Changed offers |
|---|---:|---:|---|---:|
| G03, contract duration | 64.91 | 56.50 | 56.50–56.50 | 5 |
| G04, payment terms | 75.24 | 75.48 | 75.48–75.48 | 0 |
| G06, index clause | 84.56 | 79.40 | 70.39–88.36 | 4 |
| G10, tight negotiation room | 88.78 | 88.78 | 88.78–88.78 | 0 |
| Equal-weight mean | 78.38 | 75.04 | | 9 |

G03 lost 8.42 points in every pass. It changed the third buyer proposal from 24 months at 80.29
to 12 months at 85.72. The supplier accepted 85.72; baseline instead received and accepted its
84.25 final offer on 12 months. Both used three buyer emails. The new agreement cost the buyer
6,242.60 more. Matching supplier terms was valid, but repeating its last concession was not a
good enough price-setting rule.

G06 was mixed: two runs finished at 13.85 rather than baseline 14.00; two interventions finished
at 14.25 and 14.56. Another run finished at 14.51 without an intervention, so that loss cannot be
attributed to a changed offer. Experimental runs used three or four emails; baseline always
used four. G04's small average difference also occurred without intervention and reflects
supplier variation. Do not attribute every score difference to the new code.

All 40 cases closed valid deals. There were 138 supplier LLM calls, no supplier or buyer
fallbacks, no failed must-haves, HTTP errors, thread timeouts or wave-cap closures. Every source
hash matched and all ten reconciliation reports passed. The nine changed offers matched their
wire messages and source packages and passed cost/must-have checks; all nine were feasible for
the supplier, and seven were accepted immediately. Across all supplier choices, the model
accepted 29 of 53 feasible agreement opportunities and declined 24. This was not an automatic
acceptance simulator. No same-package supplier counterprice increases were observed.

[Comparison and individual outcomes](runs/local-r02/comparison.json) ·
[Source and run verification](runs/local-r02/verification.json) ·
[Supplier and wire audit](runs/local-r02/supplier-and-wire-audit.json).

The implementation and valid execution are verified; improved negotiation value is not.
G06's variation and the lack of active hosted interventions prevent a broader generalization
claim. No thresholds or supplier profiles were tuned after inspecting these results.

## Hosted practice results

| Case | v1.9 score / 100 | Experimental score / 100 | Buyer emails, both arms | Interventions |
|---|---:|---:|---:|---:|
| P08, index clause | 60.40 | 60.40 | 5 | 0 |
| P10, delivery | 67.85 | 67.85 | 2 | 0 |
| P11, quality | 70.99 | 70.99 | 7 | 0 |

Both passes reproduced these values. Every paired action, outgoing term sheet, final term set
and final cost matched. All deals met must-haves; no buyer fallback occurred.
[Comparison](runs/practice-r01/comparison.json) · [Wire checks](runs/practice-r01/wire-comparison.json).

Offline replay of all ten previously captured hosted practice histories found no changed
decisions. P08/P10/P11 were therefore chosen as non-regression checks, not selected for a good
score. [Eligibility inspection](practice-eligibility.json). The hosted results do **not** show
the effect of an active package switch; this remains an evidence gap. We did not alter hosted
cases or force interventions to manufacture coverage.

## Is the simulated supplier negotiating properly?

The supplier uses `gpt-6.1-sol` to select among financially valid actions. It can choose different
packages, accept a feasible buyer proposal, hold or counter. Published terms must match the
chosen action and stay above its independently specified financial floor. Private assumptions
and the supplier's own thread are available to that supplier, not to the buyer.

However, it is a bounded simulator. Code schedules its counteroffer prices by round. Changing
the buyer's price changes which agreement actions exist, but does not change the counteroffer
price menu. Early walkaway is unavailable; supplier emails use templates; relationship-health
scoring and semantic claim grading are absent. The fallback chooses the highest nominal-price
agreement, which is not necessarily the best supplier profit across unlike packages. The audit
records actual fallbacks so they cannot silently inflate the apparent LLM result.

In G03, agreeing to the experimental buyer's 85.72 offer instead of publishing the available
84.25 final counter is rational for the simulated supplier. That is evidence of supplier
response to our proposal, and a reason the new buyer can score worse. It does not establish
real-world negotiation realism. Treat these tests as behavioral and integration evidence,
with hosted practice used as a separate check.

## Historical artifacts and audit

The persistent policy and its negotiation commands have been removed. Do not use the old
`--reconsider persistent` or `compare_packages.py` commands recorded in historical manifests.
The final evaluated implementation is archived as
[package_policy-final.py](evaluated-source/package_policy-final.py), outside the active agent.
Source verification records describe the code at evaluation time, before its requested removal.

The saved comparison JSON files above retain every completed result. From `starter-kit/`,
recheck the saved supplier choices and outgoing offers without model calls or arena sessions:

```bash
.venv/bin/python scripts/audit_package_runs.py ../evaluations/persistent-packages/runs/local-r02
```

The earlier observer and structured-update adapter are retained. See the
[structured-update report](../reconsideration/structured-update-report.md).

## Verification

Before removal, the full suite passed **253 tests with one skipped**. Focused coverage includes outgoing package persistence,
actual cost limits, terminal actions, invalid terms, agent reuse across cases, rejected sends,
and restart equivalence for both counteroffers and acceptance. Lint and diff whitespace checks
passed. GPT-6 Astra independently found the state defects and verified their corrections; it is
a different model, not an independent provider or human certification.

After removal, 43 focused observer, reconsideration and local-wave tests passed. Both CLIs
reject the removed `persistent` mode before loading a session. No active source imports the
removed policy; historical results and audit tools remain available.
