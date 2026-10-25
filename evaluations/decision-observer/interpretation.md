# First observation experiment, 25 October

The observation pipeline works, but this fixed-choice reviewer has not demonstrated enough useful
contextual detection to influence negotiations. Keep it optional and offline. No buyer policy,
price, acceptance or email was changed by the model. There is no measured negotiation benefit.

## Negotiation runs

| Run | Cases | Mean score / 100 | Deals | Failed must-haves | Qualification |
|---|---:|---:|---:|---:|---|
| Synthetic Wave 02 | 10 | 79.6 | 10 | 0 | One supplier-model ConnectError used reference fallback |
| Hosted sandbox D01/D02 | 2 | 70.8 | 2 | 0 | Individual scores 88.3 and 53.4 |
| Hosted practice | 10 | 75.0863 | 10 | 0 | Zero buyer fallbacks; 10 practice sessions used |

The practice mean matches the earlier v1.9 baseline to the reported precision. The synthetic
79.6 versus the operator's previous 78.0 is not an observer benefit: supplier calls are stochastic,
one fell back, and the observer had no input into the buyer. All ten synthetic negotiations
finished by 29.275 seconds, with no thread timeouts or HTTP errors. Feasibility, selected-action
consistency and score reconciliation passed. The supplier fallback deliberately makes the wave
command exit nonzero even though every case completed. Its failed call was in G01.

The run files are [synthetic results](runs/wave02-r02/summary.json) and
[exact hosted input file list](reviews/hosted-v2-r01/manifest.json). The hosted records and replay
links are also logged in `notes/runs.md` with the note `observer-practice-r01` or `observer-sandbox`.

## Reviewer results

The final implementation uses one verdict/field choice and, for a flag, one conditional evidence
selection. The same model supplies both judgments; this is not independent expert verification.

| Decision snapshots | NO_ISSUE | Retained RECONSIDER | Unsupported flag | Transport failure |
|---|---:|---:|---:|---:|
| Wave 02: 54 | 16 | 3 | 34 | 1 |
| Sandbox: 16 | 8 | 4 | 4 | 0 |
| Practice: 50 | 22 | 2 | 25 | 1 |
| Total: 120 | 46 | 9 | 63 | 2 |

The 120 snapshots made 192 API requests. Median review wall time (including conditional evidence
selection) was 0.452 seconds on Wave 02 and 0.370 seconds on the combined hosted snapshots;
maxima were 1.122 and 0.826 seconds. These are single offline passes, not production latency
guarantees. Snapshot capture itself took at most 3.1 ms per synthetic decision and 13.2 ms per
hosted decision. No sources exceeded the evidence-list cap in these runs. Capture errors: zero.

Of 22 real acceptance snapshots, 21 returned NO_ISSUE and one had a connection failure. No
CONSTRAINT_CONFLICT was retained on actual negotiations. This is consistent with their passing
must-haves; it does not prove that every acceptance was optimal or free of contextual omissions.

Read [wave observations](reviews/wave02-r03/report.md) and
[hosted observations](reviews/hosted-v2-r01/report.md). Unsupported findings remain unavailable,
not NO_ISSUE; their original classifier choice and evidence-stage answer remain in the JSON.
The CLI exits 1 when any review is unavailable, so a written report can coexist with a nonzero exit.

## Inspection of every retained flag

These are agent-inspected judgments about the cited evidence, not blinded human accuracy labels.
The model provides a field and source, not an explanation or replacement offer. None of these
flags alone establishes that changing the buyer's action would be better.

| Case / decision | Flag | Inspection |
|---|---|---|
| G05 / 2 | Unit price; current supplier quote | Our lower counteroffer is normal bargaining. No explicit condition was identified. |
| G09 / 3 | Unit price; current supplier quote | Same issue: a higher supplier quote alone does not justify raising our bid. |
| G10 / 1 | Unit price; customer-loss news | The news is potential leverage, but our bid is already below the quote. The flag does not establish an overlooked action. |
| D01 / 1 | Unit price; buyer case | Supplier health matters, but it is already included in code's cost calculation. No specific omitted condition is identified. |
| D01 / 3 | Unit price; latest supplier quote | Another ordinary counteroffer below the supplier price. No explicit constraint violation. |
| D02 / 2 | Payment days; our earlier email | Our own previous request for 60 days does not support a claim that the current 60-day proposal is mistaken. |
| D02 / 3 | Unit price; supplier's alternative package | Worth inspecting, but that alternative specifies 45-day delivery against a 42-day maximum. The citation cannot authorize adopting it. |
| P11 / 0 | Quality commitment; buyer case | We request 300 ppm, which satisfies the <=1500 requirement. The citation does not establish that this opening target is wrong. |
| P18 / 1 | Unit price; historical PO | The historical 5.84 price is already cited correctly. It does not establish that the new indexed 4.96 counteroffer is invalid. |

The previously observed G03 duration issue was not retained by version 2. G06 produced three
initial index-clause flags, but the evidence stage rejected all three. This reviewer therefore
does not yet provide reliable detection of the specific adaptation gaps that motivated the work.

## Deliberately invalid controls

Four copied snapshots test two valid actions and two manufactured invalid acceptances. These
messages were never sent to any supplier. Expected labels are separate from the model input.

- Valid P11 opening proposal: NO_ISSUE.
- Accept P11's opening 6400-ppm offer despite the <=1500 requirement: CONSTRAINT_CONFLICT,
  with the case cited. The existing deterministic guard already prevents this acceptance.
- Valid G03 final acceptance: NO_ISSUE.
- Change that acceptance to an expired/non-standing offer ID: initial CONSTRAINT_CONFLICT flag,
  but evidence selection returned NONE, so the final observation was unavailable.

See [control labels and parent hashes](controls/labels.json) and
[control report](reviews/controls-v2-r01/report.md). Four probes do not establish a general
detection rate. Existing deterministic checks remain the authority for must-haves and offer IDs.

## Development trail and limitations

The first version asked verdict, term and evidence as independent questions. It produced seven
inconsistent triples on 16 sandbox decisions and 35 on 54 synthetic decisions. Its raw results
and source are retained under `reviews/sandbox-r02`, `reviews/wave02-r02` and `versions/`.
Version 2 repairs that structural inconsistency, without supplier-specific exceptions. It still
produces many unsupported initial flags. Replaying these observed cases is development evidence.

The first synthetic attempt (`runs/wave02-r01`) stalled in the restricted in-process HTTP
environment and was interrupted. The first review (`reviews/sandbox-r01`) recorded connection
errors and was interrupted during shutdown. Both remain on disk, not silently replaced. Successful
network runs used the approved execution environment. Later isolated ConnectErrors are disclosed
in the tables above, with no automatic retry or selective deletion.

Verification: 209 tests passed, one skipped. Tests include complete action-and-outcome equality
with observation on/off for all ten reference-supplier cases, immutable snapshots, capture failure
isolation, hard timeout, invalid/refused answers, conditional evidence selection, and HTTP errors.
The default final runner does not enable capture and never calls the reviewer.

Next decision: retain the experiment for inspection; do not connect these outputs to acceptance or
counteroffer policy. A future intervention needs more precise findings and fresh evaluation cases.
