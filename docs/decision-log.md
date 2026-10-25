# Decision log

## Test a typed bridge from reconsideration to policy (25 October)

User requested testing the complete path beyond observation. Compare v1.9, a deterministic
supplier-package adapter and the same adapter behind a binary decision gate. Preserve main offers
and add at most one code-priced alternative instead of rewriting price history or inferring a
discount from supplier prose. This isolates whether the adapter or the model adds value. The
experiment stays opt-in. [Protocol](../evaluations/reconsideration/plan.md).

Two local passes per arm produced means 79.85/79.60/80.10; all 60 cases closed valid deals.
The gate approved all ten opportunities. Both intervention arms had one supplier-model fallback.
Independent audit found 12 of 18 added prices below private supplier floors; two extra sheets
were accepted. Those private figures are diagnostics, not buyer inputs. Hosted sandbox D02
scored lower under both interventions; D01 had no intervention. Keep the experiment disabled.
The next useful test concerns re-anchoring counteroffers on changed terms, not another binary gate.

After evaluation, added an outer wall deadline so asynchronous DNS cleanup cannot block the buyer.
Preserved the exact evaluated adapter with a verified hash and tested the final wrapper on a real
captured request. [Results and limitations](../evaluations/reconsideration/README.md).

## Observe context without changing negotiation decisions (25 October)

User authorized a narrow reviewer experiment, followed by synthetic and hosted practice cases.
Implement snapshot capture and an offline Decisions reviewer first. The model chooses a verdict,
term and supporting evidence ID; it cannot return a buyer action or rewrite a price. A fresh
synthetic wave and sandbox checks precede a bounded hosted practice pass, subject to remaining
quota. Existing frozen baseline runs remain untouched. Reviewer output is not fed back into policy;
any score differences in stochastic reruns are not evidence of a reviewer benefit.

Completed ten synthetic, two sandbox and ten hosted practice cases. Practice mean 75.0863 is
unchanged from the earlier v1.9 baseline. Synthetic 79.6 includes one supplier-model fallback.
The first reviewer returned inconsistent independent choices, so verdict/field became one choice
and source selection became conditional. Both versions and every attempt remain recorded.
On 120 actual snapshots, the final reviewer retained nine reconsiderations, returned 46 NO_ISSUE,
and left 65 unavailable (63 unsupported flags, two connection failures). Inspection did not justify
acting on those nine findings. A fabricated quality violation was detected; a stale-offer violation
failed the evidence stage. Keep the observer off the action path. 209 tests passed, one skipped.
[Evidence and limitations](../evaluations/decision-observer/interpretation.md).

## Freeze a harder prospective wave before buyer evaluation (25 October)

User questioned whether Wave 01's high synthetic score reflected an easy simulator. That concern
has a concrete basis: the first supplier schedule always reached its financial floor by the final
round, and cases deliberately exposed simple mechanisms. Wave 02 changes the simulator assumptions
and the cases, so its raw score will not be directly comparable to Wave 01's 93.6.

Built ten authored stress cases with twelve supplier instances. Cases reverse capacity/commitment
assumptions, penalize overbuying, cover partial hedge expiry and adverse index paths, and include
PDF-standard RFQs and a narrow agreement corridor. Matched pairs change only opaque IDs or supplier
ordering. Their stochastic differences require repetitions, not a one-run pass/fail label.

Added optional positive final margins, varied concession pace and commitment penalties to private
profiles. Production buyer and runner source remain unchanged. Inputs are sealed before the first
buyer evaluation; future tuning must be reported as development and tested on another new suite.
Documentation explicitly calls this a prospective authored stress suite, not an independent hidden
benchmark or proof against overfitting.

The operator will perform the first negotiation run. Added `--suite`, `--validate-only` and
`--finish-when-done`, plus saved-input copies, baseline comparisons and paired diagnostics.
All 177 relevant tests passed. New-case checks executed only fixture/arithmetic validation;
quick-completion integration tests used old fixtures and a trivial test buyer. Report generation
was checked against copied Wave 01 artifacts. No Wave 02 performance score is claimed.
[Protocol and commands](../evaluations/supplier-generalization/README.md).

## One parallel local wave (25 October)

User requested one actual wave with the current ten synthetic cases. A single inherited simulator
would hold its global lock throughout a supplier model call. Added a local transport routing each
case to its own simulator/API, with one shared schedule and one rate-limited `ArenaClient`.
This preserves the kit's `play_waves` discovery, case workers, deadline closing and exit behavior
without serializing unrelated supplier calls or changing production buyer/runner source.

Enabled 60-second thread clocks, one-session-per-case final semantics and a 480-second wave cap.
Suppliers still use bounded `gpt-6.1-sol` decisions. The score benchmark now includes the cheaper
buyer alternative, matching the published rules; the prior intentional-walkaway score remains 1.
Four new tests cover pre-wave visibility/session/cap semantics, actual overlapping supplier calls,
thread timeouts and late supplier replies, and alternative-inclusive scoring. All 167 relevant
tests passed before reporting the live wave. The actual eight-minute run is recorded separately
from the earlier sequential passes.

The wave completed and exited normally: synthetic score 93.6/100, nine valid deals, one intentional
walkaway. All cases finished within 39.376 seconds; ten supplier requests overlapped at peak. The
runner remained active until the scheduled cap, taking 491.107 seconds including wait/poll overhead.
All 57 model choices succeeded without fallback. No HTTP errors, thread timeouts, cap closures or
must-have failures occurred. Recomputed scores and published-offer checks found no mismatches.
[Saved wave report](../notes/analysis/supplier-gym/wave-480/report.md). Production buyer and runner
source stayed unchanged throughout the run, verified against captured source hashes.

## Independent local supplier agents (25 October)

User selected an LLM supplier constrained by independently specified finances. Chose an extension
of the kit simulator over a separate match engine so the real email API and quote parsing are
exercised. Replaced openings, bargaining and scoring together; kept production buyer code unchanged.
Financial assumptions are synthetic and cannot read buyer dossiers, alternatives or internal traces.
The LLM selects among code-validated complete packages; API errors, invalid choices and the 25-second
wall deadline produce recorded fallbacks. Reference mode checks mechanics without model calls.

Ten cases cover six Sunday suppliers: eight single-supplier cases and two two-supplier RFQs. Cases
include controls for financing, hedge expiry and irrelevant news, plus an intentional walkaway.
This suite uses leverage goals only; it does not claim to validate relationship/health scoring,
semantic claim verification or parallel timed waves. [Full design](supplier-gym.md).

Validation: 163 tests passed (22 supplier-gym tests), plus ten reference episodes and a corrected
ten-case LLM pass. The latter made 57 real model calls, with no fallbacks or broken must-haves;
nine deals and the intended walkaway. Saved offers all passed financial and selected-action
reconciliation. Inspection fixed two simulator issues before completion: shared opening-message
dictionaries and omitted fixed enquiry dates in the model context. The supplier's price guard had
already enforced dates, but its initial interpretation of the expired hedge was wrong. No buyer
behavior change was made. [Evidence](../notes/analysis/supplier-gym/llm-enquiry-suite/report.md).

## Deterministic dossier reads the Sunday release (25 October)

`DataPackage` loaded the ten new facts, but `dossier.build` discovered documents/news only through
the original SQLite tables. Switched discovery to the merged ID/document interface and recorded
source IDs. Added the generic explicit hedge phrase “bought forward at fixed prices”. No supplier
IDs, case IDs, hidden outcomes, numerical cost formulas or feature defaults were added or changed.

Exported 12 supplier/part inspection snapshots for the six suppliers mentioned in the release:
`starter-kit/knowledge/deterministic/release.json`. All eight supplier-specific release records
were consumed; the global memo and market news were not assigned to individual suppliers.
Pfaffenreuth now signals cash need; Kraslin and Inntal signal spare capacity; Steinfelder signals
hedging. Vrbenský already signalled cash need and Rhönsberg gains no new economic signal.

Four focused tests failed before the fix and passed after it. All 141 non-simulator tests passed;
simulator/rehearsal tests were deliberately not run. Lint and diff checks passed. Comparing the
90 original supplier/part dossiers before/after, excluding the new provenance field, found zero
changes without the release. Evidence: [local comparison](../notes/analysis/deterministic-sunday-check.json).
No hosted session, rehearsal, model call or score measurement was made for this change.

## Grounded Zone-0 implementation and hybrid retest (25 October)

Replaced the default offline builder with source extraction, independent support review and
selection of existing observation IDs. Built and checked all 46 supplier artifacts under
`knowledge/grounded/`; original dossiers remain available for the diagnostic comparison.
Runtime consumption is opt-in through `grounded_dossier`. The `measured_trades` experiment prevents
unknown term values from being treated as zero and retains engine acceptance timing.

The primary hypothesis and repeated comparison are recorded in the
[experiment protocol](../notes/analysis/zone0-v3/experiment.md). The
[implementation and results report](../notes/analysis/zone0-v3/results.md) separates source-quality
checks from realized negotiation performance. v1.9 remains the default unless the comparison
establishes an improvement; no supplier-specific rules or hidden cost parameters were added.

Outcome: five paired passes gave **75.086 baseline versus 73.434 corrected**, with all five deltas
negative. The original/source-only diagnostic passes scored 70.504/74.203, each once. All 120 hosted
sessions preserved must-haves and closed deals; there were zero model errors or engine fallbacks.
The repaired pipeline stays available, but both runtime flags remain off. Source fidelity alone
does not solve live term selection and argument timing. Full suite: 153 passed, one skipped;
Ruff and diff checks passed. The last run left 67 practice sessions available.

## Independent Zone-0 audit (25 October)

Added `scripts/audit_zone0.py` and `research/source_audit.py` to inventory the stored dossiers and
check interpretations against source records. Reports are separate from live knowledge. Production
prompts, models, dossiers, and negotiation behavior are unchanged. The research includes the git
history, the Claude engine conversation, expert tactics, primary agent-research sources, and a small
model diagnostic. Findings and limitations: [Zone-0 audit](zone0-audit.md).

The main defect is promotion of uncertain interpretations into strategy. Two P10 assertions were
checked directly against SQLite: supplier-owned tooling (`n/a` in sourcing) and reliable payment
(76.4% of paid invoices were late). P10's planning-security need is supported and should be preserved;
it does not establish a discount for a particular term. No new hosted runs or score gains are claimed.

One entry per engine version: what changed, why, and what the hosted practice cases said.
Scores are case scores (0–1); "mean" is the mean over the 10 hosted cases × 100.

## Baselines (2026-10-24)
- `naive`: P01 0.60, P05 0 (accepted 56 days lead time against the must-have ≤ 42), D01 0.20, D02 0.25.
- Kit `llm`: P01 0.75, P05 **0 (timeout)**: about 30 s per LLM move × 3 bidders broke the 60-second
  rule. D01 0.73, D02 0.35.
- **Decision:** code decides every move. The LLM is too slow and too loose for binding numbers.

## v1 → v1.1: code engine
- Dossier, claims, policy and template writer. v1 crashed on every move (`KeyError: payment_days`)
  because a quote PDF splits its terms into offered, standard and fixed sections; the fallback saved
  the cases. v1.1 builds the supplier's reference terms from all three sections.
- **Result:** mean 48.4, 10/10 deals. Weak: P01 0.38, P04 0.06, P08 0.21, P02 0.26.

## v1.2: three fixes from the v1.1 replays
1. Equal-cost alternative sheets included our supplier-health estimate in C, so a third package
   came out at EUR 141.69 and the supplier agreed to it at once (P01). Alternatives now use our cash
   cost only.
2. Term mixes were compared at the supplier's quote price; at that level buying the second year at
   the fallback price looked cheaper, so we offered 12-month contracts (P04, P08). Mixes are now
   compared at the expected deal price, (1 + anchor) / 2 of the quote: 24 months wins.
3. Push once after `final_offer` (2 % below).
- **Result:** P01 0.38 → 0.94, but **every supplier we pushed after final_offer walked away**
  (P02, P04, P08, P10, P18, P07): mean 31.5.

## v1.3: final_offer is final
- Removed the push: we accept at `agreed` and `final_offer`.
- **Result:** mean **67.7**, 10/10 deals, no timeouts, no broken must-haves. The 24-month fix now
  pays: P04 0.06 → 0.86, P08 0.21 → 0.55.

## v1.4: listen to the supplier (Phases 3b + 5)
**Why:** the v1.3 replays show suppliers telling us what would move them, and we ignore it. Their
replies are templated arena-wide, so reading them generalises to new suppliers. Counts over our runs:
"Which volume can you commit to?" 46, "A binding higher volume would help us" 35, "Faster payment
is welcome; we can reflect it in the price" 35, "Preisgleitklausel" offers 17, "Without movement from
your side we cannot move either" 6, price freeze 4, "not our reality" (hedged) on index claims.
Suppliers also send **alternative sheets** (`offer:…-a`), e.g. "with Zahlungsziel 14 days: €…",
which v1.3 ignored.

**Changes:**
1. `signals.py` reads every supplier e-mail for asks (volume, payment, clause, data) and traits
   (price_frozen, hedged, stuck) and its reply delay.
2. Payment ask → its cost of money rises (+5 points, once) and the term mix is re-planned, so
   faster payment moves into our main sheet when it pays for us.
3. Alternative sheets are priced with `total_cost`; one cheaper for us than its standing sheet becomes
   our term mix.
4. Clause offer or ask (index clause negotiable) → one extra sheet with the clause at equal cost to us.
5. Hedged → index claims are dropped. Data ask → two claims next message. Stuck → a larger step (45 %).
   Price frozen → we stop discounting and offer its price on our better term mix.
6. Reply delay ≥ 4 days or founder-owned → anchor 3 points lower (deep floors); group-owned with a
   1–2 day delay → anchor 3 points higher (fewer early final offers).
7. Writer answers the asks in words: volume commitment, faster payment, clause openness, price freeze.

**Result v1.4:** mean **70.2** (v1.3: 67.7), 10/10 deals. P05 0.55 → 0.65, P08 0.55 → 0.63,
P10 0.57 → 0.69, P11 0.63 → 0.71, P01 0.94 → 0.96. **P02 0.51 → 0.37:** the clause trade worked
(Nordmark agreed to EUR 353.14 with a copper clause instead of 371.88), but P02 is `stabilise` and its
own-plant should-cost is EUR 374.95, so the deal sits about 6 % below its full cost and the arena
charges the relationship term. Our engine missed it because "every price it offers caps our
full-cost estimate" pulled the estimate down to 351. Suppliers do sell below full cost when they get
security (a clause) instead of cash.

## v1.5: never price a strategic supplier below its health point
1. The full-cost estimate may not fall below its source's error band: own-plant should-cost −5 %,
   German should-cost × country −15 %. Only the quote-based guess is capped by the supplier's offers.
2. In `stabilise` / `secure_supply` cases, extra sheets (equal-cost, clause) are dropped when their
   price is below the price where C including the relationship charge is lowest.

**Result v1.5 (first try):** mean 60.9. Two failures, both bugs:
- P03 → 0: parallel cases share one SQLite connection; a concurrent query raised
  `sqlite3.InterfaceError` on the first move, and later our accept check compared C *with* the
  relationship estimate against C_open *without* it, so we walked away from a good final offer.
- P02 unchanged (0.37): in strategic price-increase cases our anchor is today's price, below the
  supplier's health price, so a supplier that agrees low still costs us the relationship charge.

## v1.5b: consistent relationship handling
1. One lock around every SQLite read in our modules (thread-safe under `--parallel`).
2. Limit = min(C of the alternative, C_open **with** the relationship estimate of each opening
   sheet); the accept check uses the same estimate, so both sides of the comparison match.
3. `agreed` below the health price is not the end: in stabilise / secure_supply cases we counter
   at the health price (it accepts more readily than it agreed). Only `final_offer` or no moves
   left count as finished.
4. The low first anchor stays (P01 0.96 relies on it); extra sheets never go below the health price.

**Result v1.5b:** mean **71.1** (best so far), 10/10 deals. P02 0.37 → 0.50, P03 back to 0.92,
P01 0.96 → 0.91 (the health-price counter now also applies there; watch it).

## v1.6: RFQ tactics (Phase 6)
**Why:** in RFQs each bidder was negotiated almost on its own: rival offers were cited once,
bidders that could not win kept getting rounds, a bidder's deep drop in a later round was met
halfway, and we took the first agreement without giving the runner-up a chance. Rules react only to
what happens in the session (gaps, drops, statuses), never to who the supplier is.

**Changes (RFQ = two or more live bidders):**
1. Bids are ranked by total cost C (with standard terms, must-haves, relationship estimate), not price.
2. The rival claim cites the bid that is best in C, its price checked by the arena; when that bid
   moves, the new offer is cited. If the leader's non-price terms are better, we say so in words
   (no figures, so nothing to contradict).
3. One extra sheet on the leader's term mix at equal cost to us: compete on the whole package.
4. A drop of 6 % or more since its previous reply → hold (10 % of the gap) in any round.
5. After two replies, a bidder whose C is more than 10 % above the leader's gets no more rounds
   (revived if the others end).
6. Last call: when the leader is ready (agreed / final offer / within 0.5 %), the runner-up gets one
   message with the leader's offer cited and a sheet that beats the leader's C by 1 %; after its
   reply we accept the best sheet in C. An agreed offer stands, so the leader is not at risk.

**First test (sandbox only, no practice sessions):** D01 0.883, D02 0.461 (unchanged). The last call
works (runner-up asked once, then the best C taken). Two gaps seen in the D02 trace:
- the leader never got a rival claim, although the runner-up's *price* was lower;
- our term plan asked for a 21-day lead time and EXW, which cost us nothing in C but the supplier
  prices them in: on equal C the plan picked the first option instead of the supplier's own.

## v1.6b
1. The leader is shown the runner-up's offer when its price is lower than the leader's.
2. Term plan tie-break: among mixes within EUR 1 of the cheapest C, prefer the one that changes the
   fewest of the supplier's own terms. Don't ask for what does not save us money.

**Result v1.6b (sandbox only):** D01 0.883, D02 0.461 → 0.482. The plan now keeps the supplier's own
lead time and Incoterm; the last call ran (runner-up asked once at EUR 15.18, could not beat it; the
leader's final offer EUR 15.40 taken). Hosted practice (P05 with three bidders) not yet run, to save sessions.

**Result v1.6b (hosted):** mean **71.4** (v1.5b 71.1), 10/10 deals; P05 0.654 → 0.685, other cases
unchanged (RFQ rules only act with two or more bidders). In P05 the bidder at EUR 34.50 (its EUR 31.00
alternative broke the lead-time must-have) was correctly dropped; 70250 **agreed at once** to EUR 29.61
and 70210 agreed to the last call at EUR 29.24, while C_best is about EUR 26.6 per unit: our offers were
still above their floors.

## v1.6c: reverse auction instead of one last call
**Why:** agreed offers stand (suppliers answer "Our agreed offer stands", they do not walk), so bidders
that agree can be played against each other until nobody improves. Pushing a `final_offer` is still
never done.

**Changes:**
1. When the leader is ready, the best runner-up (live, not dropped, moves left, not at final_offer) is
   asked to beat the leader's C by `AUCTION_EDGE` = 2 %, with the leader's offer cited.
2. After its reply: if the best C improved by at least 0.5 %, the next call goes to the new runner-up
   (often the previous leader); otherwise we accept the best sheet. At most `AUCTION_CALLS` = 4 calls.
3. **Not done: the country cost-base target.** P05 bidders agreed at EUR 29.24-29.61 against a German
   should-cost of EUR 36.87, so cost-based targets would make us less aggressive; live bids are the
   better signal.

**Result v1.6c:** P05 0.685 → **0.716** (1 hosted session; the other cases have one supplier, so the
auction cannot act there). Auction: 70250 agreed at EUR 29.61 → call 1: 70210 agreed at EUR 28.94 →
call 2: 70250 answered "Our agreed offer stands" → accepted EUR 28.94. No supplier walked. D02 0.482.

## v1.7: one lever per round, one sheet, and robustness for the final
**Why:** set against a stronger buyer on the same ten hosted cases, our gap (mean 0.725 vs 0.783) is
almost entirely **unit price at similar terms**: same winning supplier, same term mix, higher price.
The negotiation paths show general patterns in how arena suppliers react (their replies are
templated arena-wide), each seen in two or more cases:
- a bare price step gets "hold" or an early `final_offer`; a **new argument** each round keeps them
  moving (repeating a claim kind comes back `duplicate`);
- a **menu** of packages lets the supplier pick the one cheapest for it and price our asks in;
- accepting an *open* offer within 0.5 % of ours leaves money while arguments are unused;
- suppliers say a longer commitment "allows a more competitive base price", and a 36-month contract
  costs us nothing in C when the horizon is 2 years;
- a supplier that asserts a volatile cost driver ("CU-NOTATION rose 47.7 % in twelve months and is
  20 % of our cost") is met better with an index clause on that driver than with a deep fixed-price
  ask (which in P02 made it quote *above* its opening, then `final_offer`);
- "we need to clarify this internally - we will come back to you on price" is followed by
  `agreed` at our price when we hold; raising our offer meanwhile only costs us.

Our own runs added two facts: an ID counts once per **case**, so in P05 the second and third bidder
answered `duplicate` to the same index claim (24 times), and in P07 index claims for different parts
shared IDs (21 `duplicate`).

Every behavioural change sits behind a feature flag (`policy.FEATURES`), so a hosted pass can be
ablated without code edits: `PROCUDEAL_OFF="single_sheet,patience"`. Bug fixes are not flagged.

**Bug fixes (always on):**
1. The data month for index-claim recency was hard-coded (`2026-09`); it is now the latest month in
   the data (SQLite `index_values` and any `idx:` ID the package or the Sunday release exposes).
2. One odd line in a quote PDF lost *all* standard terms (`docs.standard_terms` raised, we fell back
   to `{}`). Our own reader parses line by line with the kit's labels, skips only the bad line, and
   treats an unknown Incoterm as the costliest (an unknown one also crashed `total_cost`).
3. A restarted runner resumes final sessions, but the engine started from scratch (re-opening at the
   anchor). It now rebuilds each side from the thread: our prices, its prices, the claims used.
4. A late send (409) still marked its claims used and its price as offered. When the thread's latest
   message is the arena's timeout answer, the price, claims, trade and any auction call of that move
   are rolled back.
5. The dossier's `capacity_full` and `wants_work` signals were computed and never used; they now
   feed the anchor, the patience budget (F) and the supplier value (H). "Order intake" no longer
   counts as looking for work (the data says "Order intake is very strong" of full suppliers), and a
   full supplier is never "looking for work".
6. RFQ keepalive (flag `keepalive`): a ready leader can wait past its 60-second clock while the other
   bidders are played. A ready thread whose sheet we could accept gets a sheetless note after 35 s,
   or sooner when the slowest reply so far would make it late (at most 3 per thread). A sheet that
   was agreed or final keeps that status after such a reply when its terms are unchanged (every
   reply carries a new offer ID, so the terms are compared, not the ID).
7. "no Preisgleitklausel" in an opening quote was read as a clause ask. Negations no longer count.
8. A change of our term mix (re-plan, adopted alternative or clause) now recomputes its price
   ceiling and health price; both stayed at their setup values.
9. A supplier at `final_offer` never gets another priced sheet, also when every thread is ready
   and none passes the accept check (a fallback could pick it before).
10. Setup is all or nothing: a failure on one supplier no longer leaves a partial state that made
   every later move fall back to the kit LLM. ID lookups share the SQLite lock.

**Changes (each behind its flag):**

| Flag | Change | Rule |
|---|---|---|
| `strict_accept` | C | the "within 0.5 % of our offer" close only applies when no fresh lever is left or ≤ 2 moves remain; agreed, final_offer, the last move and a counter at or below our offer still close; while levers are played our price never steps back below our last offer |
| `single_sheet` | B | one main sheet per message (no equal-cost menus, no leader-terms sheet), plus at most one need-trade sheet: one field changed for an ask or signal, priced at equal value to the supplier, sent only when it costs us > EUR 1 less and keeps the must-haves, never the same trade twice |
| `lever_schedule` | A | up to 3 claims of different kinds in the first message, then exactly one new kind per round; a kind never repeats (rival offers: one per new offer *price*); a kind that comes back contradicted or irrelevant is dropped for the case; an ID once per case. Two new levers: order history (`po:` lines of this part) and a figure-free call or meeting note (`doc:`) |
| `friendly_ties` | E | among term mixes within max(EUR 1, 0.1 % of C) of the cheapest: longest contract, then highest volume up to our need, then longest lead time within our need; then C to the euro and fewest changes to its own terms (the v1.6b rule) |
| `silence` | G | after "clarify internally / come back to you on price": resend our last main sheet unchanged, one line of thanks, no claims (once in a row) |
| `proactive_clause` | D | the supplier asserts a driver that has a clause option and it is not hedged: the clause with the widest deadband on that series joins our main mix when its protection value to the supplier exceeds its cost to us and it keeps the must-haves; **not in stabilise / secure_supply** (below); when the supplier demands a clause, we adopt its option and negotiate the base price |
| `patience` | F | a budget for our concessions: a share of the opening gap (its first price on our mix less our first offer), normal 1.0, stabilise / secure_supply 0.3, capacity full 0.16, near cost 0.14; each step at most half of what is left. Persona anchor floors (capacity full ≥ 0.93, near cost ≥ 0.97 of its price on our mix; wants work −0.02) |
| `rich_value` | H | supplier value with its scorecard ppm, overtime for a faster delivery (0.5 %/day if capacity is full, else 0.1 %/day), a small plus for volume when it wants work, and a cost of money implied by its cash discount (skonto) |

The thresholds in F and H come from practice evidence; they are round numbers, not fitted to one
case. Rules branch on signals and data only, never on case or supplier IDs.

**D is off in strategic cases.** In stabilise / secure_supply our price is held at the supplier's
health price (the relationship charge counts cash, not security). There the clause's protection
buys us no lower price, while its index risk is a sure cost: in P02 about EUR 18k, 38 % of the
case's score range. The gain seen elsewhere in P02 needs a lower full-cost estimate than our
own-plant floor (EUR 374.95 against a quote of EUR 370.96); that is a separate decision. In the
hosted practice set D therefore does not fire (P08/P18: the 5.9 % rise of AS-14404 is below the
clause's cost to us); it is untested on live bots.

**Review (fresh eyes, full diff):** an independent review replayed the 100 recorded runs offline
with all flags on and all off: no crash, no fallback, no invalid sheet, no accept off the standing
sheet. With every flag off, 514 of 528 recorded decisions are identical to v1.6c; the 14 others are
bug fix 7. Its findings are fixed above (clause vs must-haves, keepalive status after a new offer
ID, "order intake", keepalive only for acceptable sheets, rollback of an auction call, the RFQ rival
re-offer at the same price counting as a fresh lever, the step-back below our offer against a
clause-converted price).

**Free tests:** 41 engine unit tests; simulator S01-S03: 3 deals, 0 fallbacks (flags off: identical
to v1.6c); sandbox, one run each:

| run | D01 | D02 |
|---|---|---|
| v1.6c | 0.883 | 0.482 |
| **v1.7 (all flags on)** | **0.902** | **0.534** |
| v1.7, all flags off | 0.883 | 0.482 |
| v1.7 -friendly_ties | 0.902 | 0.524 |
| v1.7 -single_sheet | 0.920 | 0.534 |
| v1.7 -patience | 0.883 | 0.534 |
| v1.7 -strict_accept | 0.902 | 0.534 |
| v1.7 -rich_value | 0.902 | 0.492 |

(The single-flag runs ran while two small fixes landed - the patience budget is now set after our
first offer, and D is off in strategic cases; neither acts on D01/D02's path.) The demo suppliers
have no data in the package, so A (levers) is not exercised there. **Watch in the hosted pass:**
`single_sheet` (the menu won on D01), `patience` in the strategic cases P01 / P02 / P03 / P10, and the
RFQ P05 (keepalive and strict_accept with three bidders).

**Result v1.7 (hosted):** mean **70.8** (v1.6b/c 71.7), 10/10 deals - not accepted. P05 0.716 → 0.762,
P07 0.717 → 0.743, but **P08 0.626 → 0.538**, P02 0.499 → 0.465, P18 0.520 → 0.497, P10 0.686 → 0.671.
- P08 (a bug): the supplier demanded its 0-deadband AS-14404 clause at EUR 5.45 and offered a
  5-deadband alternative at EUR 5.57, which is cheaper for us at those prices. The v1.4 rule "adopt a
  cheaper alternative" ran after the clause adoption and switched us to the 5 % deadband. With one
  sheet we then negotiated only that track, where it conceded less ("to accommodate the 5% deadband,
  which increases our risk … EUR 5.55"): final EUR 5.48 against EUR 5.28 on the 0-deadband track in v1.6b.
- P02 / P10 (patience): both suppliers got the tight persona budgets (near cost 0.14, capacity full
  0.16), so our steps shrank to about EUR 2, 1, 0.5; they called their final offer early and a little
  higher (P02 EUR 372.25 vs 371.95, P10 EUR 31.60 vs 31.40).
- P18 (single sheet): v1.6b's menu had a 90-day package that it took at the same EUR 5.30; one
  sheet kept us at 60 days.
- The keepalive fired live for the first time (P05, five notes to bidders at final_offer while the
  auction ran): each answered with its final offer standing; nobody walked.

## v1.7b: the clause it demands wins over a cheaper-looking alternative deadband
**Change (proactive_clause):** once we adopted the clause a supplier demanded, an alternative sheet
with a different clause no longer replaces our mix; we keep its clause and negotiate the price.

**Result v1.7b (hosted):** mean **71.8** (v1.6b/c 71.7, v1.7 70.8), 10/10 deals; no case more than 0.05
below v1.6b/c - **accepted**. P08 0.538 → 0.615, P18 0.497 → 0.564 (both keep the 0-deadband clause
now; P18 beats v1.6b by 0.044), P05 0.710 (noise: 0.762 with the same code the run before).

**Ablation (hosted, same code):** `PROCUDEAL_OFF=patience` mean 71.6: P02 0.465 → **0.504**, P10
0.671 → **0.679**, P08 0.615 → 0.604, P05 0.710 → 0.659 (noise), the rest unchanged. Without P05,
patience off is 0.036 better in total, from the two cases with persona budgets. The sandbox D01
(relationship share 0.3, no persona) gained 0.019 with patience. **Open decision:** keep `patience`
on, or switch it off (or drop only the persona budgets). The budget caps our total concessions; a
supplier near its cost or out of capacity then sees almost no movement and calls its final offer.

## v1.7c: two lessons from the playbook in the fallback engine
**Why:** the playbook built from 142 practice runs (`knowledge/playbook.json`) found two v1.7 levers
that work against us, both matching the hosted ablation:
- token concession steps of 0.1-0.2 "led to higher finals" (high confidence, 7 cases) - the patience
  budget: P02 0.465 with it, 0.504 without; P10 0.671 / 0.679;
- citing a meeting or call note without data "brings repeated requests for proof and costs
  credibility" (high, 9 cases) - P08: "please provide the meeting notes you mentioned".

**Changes:** `patience` is off by default; the call-note lever has its own flag `call_note_lever`,
off by default. `PROCUDEAL_ON="patience"` switches a default-off flag back on for an A/B run. This is
the baseline that the zone 1 A/B compares against.

**Free tests:** 31 v1.7 unit tests (full suite 97 passed); simulator S01-S03: 3 deals, no fallback;
sandbox D01 0.883 (0.902 with patience; the hosted ablation favoured patience off on P02 and P10),
D02 0.534 (unchanged). Hosted: not run yet (part of the zone 1 A/B).

## v1.8 (flags off by default): rule-audit fixes as methods
**Why:** the rule audit (`scripts/audit.py`, `docs/findings.md` section 10) checked every number and
rule against what the arena revealed in 169 runs. Our cost maths matches to the cent. Three inputs
were wrong:
- **C_open in P02:** +€7,924 from an uncapped should-cost.
- **The health price:** never refreshed. At setup it sat €2.8-7.3 above the true optimum in every
  relationship case.
- **Cost of money by owner type:** off by −1.8 to +2.9 pp against each supplier's own payment-days
  pricing.

The per-offer full-cost cap rests on a false premise: v1.4 closed P02 below the supplier's full cost.

**Rule for every fix: a method, never a fitted value.** No practice supplier's measured number is in
the code.

**Changes:** three flags, all off by default:
- `quote_cap`: cap the estimate once, by the opening quote, at the sustainable margin;
- `measured_rate`: its rate from its own sheet pairs that differ only in payment days
  (`economics.implied_rate`);
- `health_refresh`: health price and ceiling follow the estimate.

Also `economics.menu` (H1.3), every allowed mix priced for the hybrid, and `scripts/replay.py`, an
offline replay of recorded states scored with the backed-out truth (evaluation only).

**Free tests:** 14 new unit tests (`tests/test_procudeal_v18.py`).

**Offline replay** of the latest v1.7c run of every single-supplier case: **v1.8 sends the same moves
as v1.7c**, apart from €0.06 on P03's opening. Its numbers are closer to the truth:
- **P02 health price:** €362.86, against €367.46 in v1.7c and a true €361.4.
- **Rate:** measured 6.61 % (P02) and 9.27 % (D01), matching the audit.

So the fixes are safe, but give no score gain alone. The P02 menu shows why:
- **No clause, at the health price:** every option scores ">1" if accepted, i.e. a price below
  anything this supplier would take.
- **The 5 % deadband clause, 90-day payment, at the health price €361.82:** 0.734 if accepted. The
  reference run closed that deal at once and scored 0.735.

Choosing that option takes judgment about the supplier's need (copper protection, named in its
quote). A "clause in stabilise cases" rule would be fitted to P02. That choice is the hybrid's job.
Trade-off noted: in P01 the old per-offer cap happened to be closer to the true full cost (€130.54 vs
€132.64; truth €130.04). We keep the cap whose premise held every time.
Sandbox with the flags on (`PROCUDEAL_ON=quote_cap,measured_rate,health_refresh`): D01 0.883, D02 0.534,
identical to v1.7c. Hosted: not run.

## v2.1 test: ask for the cost breakdown (flag `ask_breakdown`, off)
**Why:**
- The brief says "a cost breakdown XLSX (ask; an open supplier sends one)"; none of our e-mails asked.
- The hope was the supplier's own full cost, our most sensitive input.

**Test (sandbox, free):**
- The first e-mail gets the brief's own sentence: "Could you send us a cost breakdown for this part?"
- The trace now keeps any breakdown a supplier sends.

**Result:**
- **D02 (DEMO-J1) sent one:**

  | element | € per unit |
  |---|---|
  | material BAR-14021 | 5.56 |
  | WAGES-METAL | 4.39 |
  | conversion | 2.81 |
  | **overhead and profit** (one line) | 3.44 |
  | unit price | 16.20 |

  Overhead and profit are lumped, so the sheet gives neither its full cost nor its margin, only a
  lower bound (direct cost 79 % of the price) and the material share, which quotes already state.
- **D01 (DEMO-F1)** sent nothing.
- **Asking changed the outcomes:** D01 0.883 → 0.856, D02 0.534 → 0.524. The bots read our wording.

**Decision:** the flag stays off; the trace capture stays.

## v1.9 (default): protection trade, plus the v1.8 fixes switched on
**Why:**
- The two hosted hybrid sets (72.3, 71.6) kept one robust result: P02 0.734, 3 of 3 runs. It comes
  from information code computes, not from the model's broader judgment.
- Wherever the model traded terms the packet cannot value (lead time, contract length), or closed
  by itself, it lost.

**Change:** `protection_trade` (`Negotiator.protection_trade`). It fires when:
- the goal is stabilise or secure_supply;
- an index clause is negotiable;
- the supplier's quote carries no clause, but its quote states the cost driver.

Code then prices every clause mix at our health price and keeps the ones worth more to the supplier
than its own quote:
- worth = cash value plus the protection beyond the deadband on the exposure it states;
- this is the method that matched suppliers' own deadband pricing in P08 / P18.

It opens on the cheapest such mix (our C) at our health price. `next_price` never goes below the
health price on that sheet, because with the protection the supplier would take less, and below the
health price our C rises (v1.4: €353 → 0.365). These are the case's own numbers, no fitted value. It
needs `quote_cap`, so the v1.8 fixes are switched on as well.

**Tests:**
- 3 new unit tests (127 passed).
- **Offline replay:** only P02 changes (round 0: clause, 5 % deadband, €361.82, 0.734 if accepted).
  The 9 other single-supplier cases are unchanged (P03 −€0.06).
- **Sandbox:** D01 0.883, D02 0.534 (= v1.7c).
- **Hosted P02:** 0.734 in 2 rounds (the supplier agreed at once).

**Hosted set: 75.1** (v1.7c 72.7), exactly as expected. P02 is 0.734; the other 9 cases are
identical to v1.7c. The other teams' best P02 is 0.88, without a clause
at about €367.8. So this supplier goes below the €371.95 it called final for us, and the clause is
not the ceiling for P02: open question for later.

## v2.0b: the model picks the terms, code sets the price
**Why:** in the v2.0 set the model chose the right trades but moved the price worse than the engine
(P01, P18, P08). **Change:**
- The schema has no price choice any more: the model picks an option (term mix), arguments, accept
  or hold.
- `context.code_price` sets each option's price:
  - the engine's price on its own terms;
  - our health price in relationship goals when the supplier gains there against its own sheet (a
    deal there is likely and our C is lowest);
  - otherwise the price worth to the supplier what the engine's move is worth to it, so the engine's
    anchor and steps carry over to the model's terms.
- At "agreed" or "final_offer" the engine decides and the model is not called.

**Offline replay (with Z):**
- **P02:** round 0 offers the 5 % deadband clause at the €361.82 health price (0.734 if accepted).
- **P01:** the engine's €126.53 opening on the model's 2027-01-01 terms, then the engine's step
  (€129.22).
- **P18:** the engine's prices, then its terms; accepts the agreed €5.10 (as v1.7c).
- **P08:** engine prices, but it still switches terms between rounds (0 % deadband for 36 months vs
  3 % for 24 / 12 months).

**Sandbox D01:** 0.869 (v1.7c 0.883). Prices are steady; it still switches payment days and the
effective date.

**Hosted set: 71.6** (v2.0: 72.3; v1.7c: 72.7).

| case | v1.7c | v2.0b |
|---|---|---|
| P02 | 0.499 | **0.734** |
| P01 | 0.914 | 0.780 |
| P10 | 0.679 | 0.586 |
| P08 | 0.604 | 0.517 |
| P18 | 0.632 | 0.598 |
| others | | the same |

Causes:
- **P10:** the model chose 42-day delivery over the engine's 56 days. The packet's supplier value
  ignores lead time, which suppliers price at about +4.5 % (audit type 3). The supplier quoted €33.60
  and finalled at €33.40; v1.7c reached €31.50.
- **P08:** it chose a 3 % deadband for 12 / 24 months over the 0 % deadband for 36 months that the
  supplier wanted. Contract length is also invisible to the cash value.
- **P01:** the deal closed at €133.80 in round 1, right after the 2027 date at the engine's opening.
  The engine countered in v1.7c. The trace does not record whether the model or the engine accepted.

**Lessons:**
- The model's term choices are only as good as the supplier value the packet shows.
- Lead time and contract length must be valued from the supplier's own sheets before the model may
  trade them.
- The trace must record every hybrid decision.

P02's gain is stable: 0.734 in all 3 hosted runs.

## v2.0 phase 3: the tactician in the live loop (flag `tactician`, off by default)
**Built:**
- `ProcuDealAgent.hybrid`: the engine decides first; one model call over the packet; code checks the
  answer; `Negotiator.replace_move` undoes the engine's pending record and records the model's move
  (price, claims, term mix);
- a wall-clock deadline of 25 s;
- on any failure the engine's move goes out;
- single-supplier cases only;
- the model's text sits behind its own flag (`tactician_text`, off), so the first test measures only
  its choice of sheet and arguments.

**Sandbox D01, first run: 0.772, against 0.883 for v1.7c.**
- The model stepped back in price (€48.89 → €48.77, later €50.09 → €49.84). Each option's lowest
  rung was its health price, so switching options lowered our offer.
- It also hopped terms (payment 60 → 45 → 30, effective date → 2027-04).
- The supplier answered "we must see a genuine concession from your side to proceed", stopped at
  €51.10 and called it final.

**Fix (a method, no tuned value):**
- No step back: every rung must be worth at least as much to the supplier as our last offer.
- Step rungs on the terms we sent last: 10 / 25 / 50 % of the gap to its level. This is a choice grid;
  the model picks.

**Sandbox D01 rerun: 0.863.** Steady steps (48.89 → 49.82 → 50.18 → 50.30 → 50.31), closing at its
final €50.40 (v1.7c closed at €50.30). Roughly even with v1.7c.

**Hosted P02 (1 session): 0.734, against 0.499 for v1.7c.**
- Round 1: the model offered the 5 % deadband clause at the €361.82 health price, worth +5 % to the
  supplier against its own quote.
- The supplier answered "agreed" and we accepted: two rounds.
- Breakdown: price €2,210,720, index risk €17,686, relationship €33,250, payment −€14,738.
- The reference run had 0.735.
- Model latency 7.5-9.8 s per move.

**Full hosted set (10 sessions): 72.3, against 72.7 for v1.7c.**

| case | v1.7c | tactician | change |
|---|---|---|---|
| P01 | 0.914 | 0.817 | −0.097 |
| P02 | 0.499 | 0.734 | +0.235 |
| P03 | 0.923 | 0.923 | 0 |
| P04 | 0.860 | 0.860 | 0 |
| P05 (RFQ, engine) | 0.710 | 0.710 | 0 |
| P07 | 0.743 | 0.736 | −0.007 |
| P08 | 0.604 | 0.560 | −0.044 |
| P10 | 0.679 | 0.694 | +0.015 |
| P11 | 0.710 | 0.710 | 0 |
| P18 | 0.632 | 0.483 | −0.149 |

**Why:** the model chooses *what to trade* well:
- the P02 clause;
- the P01 effective-date trade;
- the P08 / P18 clause the supplier asks for.

It moves the *price* worse than the engine:
- **P01:** it opened at our health price (€132.23, which is itself 2 % high because should-cost runs
  high), against the engine's anchor at today's €126.53. The supplier agreed at €133.40; v1.7c
  reached €131.20.
- **P18:** fast steps (€5.22 → €5.32, agreed). It then did not accept the agreed sheet and pushed a
  no-clause sheet three times ("our agreed offer stands"). v1.7c reached €5.10.
- **P08:** bigger steps and a mid-way switch to 24 months without a clause.

The engine's anchors and steps are tuned constants, but they carry how the arena's bots answer our
concessions. The packet cannot show that to the model. This is the same lesson as zone 1.

## v2.0 phase 2 (offline): labelled packet + one judgment call per move
**Why:** the v1.8 fixes made the numbers right but changed no move; P02's gain needs a judgment no rule
should make (offer the clause). **Built:** `context.py` (labelled packet A / D / E / S / Z, no tuned
constants, no back office; E0 = the engine's move as a default option) and `tactician.py` (Opus 5.5 low,
code checks every field, E0 on any invalid or late answer).

**What the first P02 replays taught (and changed):**
1. **Packet with cash values only:** the model never chose the clause ("the clause options add
   €17-40k of cost to us"). It could not see that the supplier values the clause.
2. **Added the supplier's value of a clause:** the protection beyond the deadband on the exposure it
   states itself (`clause_value_rate`). The method was checked first against the suppliers' own
   deadband pricing in P08 and P18, cases it was not built from:
   - P08: +2.20 % real vs +2.24 % predicted;
   - P18: +1.85 % real vs +2.24 % predicted.

   Every rung now says what it is worth to the supplier against its own sheet. For P02 at the health
   price: the 5 % deadband clause is +5.0 % to it; no clause is −3.3 %.
3. **Added its pace (S/E):** for example "€0.49 per reply; reaching €362.86 takes about 19 replies, 7
   messages left".

**Result (P02, recorded states):**
- **With the [Z] lines:** from round 1 on the model picks the 5 % deadband clause at the health price
  (€362.77), 0.723 if accepted. This supplier took clause sheets at once in the recordings. At round 0
  it probes the health price without a clause.
- **Without the [Z] lines:** it never picks the clause. So the zone-0 reading ("material risk
  protection: strong") is what decides it, and it helps.

**Other cases (with Z):** 8 single-supplier cases plus D01, no regression visible offline:
- It accepts at the same end states as v1.7c (P04, P07, P08, P10, P11, P18) and takes the clause the
  supplier proposes (P08, P18).
- It picks P01's contractual date trade by itself.
- Two invalid answers fell back to E0. They now drop only the bad argument.

**Limits:**
- Offline replay cannot show how suppliers answer *new* counters.
- Opening at our health price is only as good as the full-cost estimate. In P01 that would cap us
  near 0.908, against v1.7c's 0.914.

**Latency:** median 8 s, max 12 s over 71 calls; $2.25 in total. Hosted: not run.

## v2.0 (in progress): an LLM layer on top of the rules - zone 0, offline research
**Why:** the engine's opponent model (reading replies, levers, steps, wording) is rules fitted to the
12 practice suppliers; the final brings "new suppliers and settings". Before a session opens we already
hold the case file and the whole data package, which the engine reads only through a few regexes. Plan
(four time zones, `docs/research.md`): 0 offline research, 1 case strategist at wave start, 2 opening,
3 rounds. Code keeps every number, sheet, claim figure and accept / walk; v1.7b stays the fallback.

**Zone 0 (built):** per supplier, code gathers every record (evidence) and every verifiable argument
(argument library, figures computed by code); Claude Opus 5.5 runs four specialists in parallel
(economics, persona, contract, performance), a lead strategist, a red-team supplier role-play and our
figure-free rebuttals; code validates every returned ID and drops figures from e-mail text. A playbook
of 20 lessons comes from 142 practice runs (one debrief per case, then a synthesis keyed by goal, case
type and traits).

**Result:** 46 dossiers (effort low: 11 min, $34.17) and the playbook ($1.98). The P01 dossier holds
every fact found by hand plus a second part as bundle leverage and a trap list. The playbook confirms
two v1.7b weaknesses: token steps led to higher finals (the patience budget), and citing meeting notes
without data drew requests for proof (the call-note lever). Not yet used by any live move.

## Supplier reply interpretation foundation (25 Oct)

Added an optional structured reading of the latest reply with original public negotiation feedback. Two designs and independent review favored a fresh per-prefix projection, with code-owned package references and values. Rejected an LLM availability gate because current structured sheets already establish the quoted alternatives; the P08/P18 clause filter remains a separate policy issue.

The policy receives advisory observations and traces their relation to its proposal, with no semantic control of actions. Live latency can still affect scheduling, so the new feature stays off by default. Six offline calls produced four usable readings, one schema-boundary rejection and one timeout. After restricting fields per package, two verification calls passed structural/provenance validation. P07 still demonstrates a possible preference/condition misclassification; no score improvement is claimed. [Full evidence and commands](../evaluations/reply-interpretation/README.md).

Finalization timing check: four hosted practice cases and ten concurrent local synthetic cases completed with interpretation enabled. All 72 decisions were below 60 seconds (maximum 12.98); no thread timeouts or invalid deals. Three real provider timeouts returned through the eight-second fallback. The four hosted scores/actions/terms were unchanged. Leave v1.9 as the default; passing latency does not justify giving semantic observations control of offers. [Timing and outcome evidence](../evaluations/reply-interpretation/runs/finalization-r01/report.md).

Following that check, the user requested the advisory interpreter as the default for final waves. Enabled it in `ProcuDealAgent`, shared by CLI practice/final factories and local wave runs. The v1.9 binding decision policy remains in control; no observation-to-offer intervention was added. `PROCUDEAL_REPLY_INTERPRETATION=off` and evaluation `--no-interpret-replies` retain an explicit baseline path. Updated the root and kit READMEs, environment example, and current architecture documentation. The historical timing report describes the earlier opt-in configuration; the same interpreter/model/deadline now runs by default.

Verification: 265 tests passed, 1 skipped, including the production factory and local final-wave path; actual local configuration confirms the interpreter enabled and Sunday release loaded. No final/rehearsal sessions or new score runs were opened for this default switch. [Default integration evidence](../evaluations/reply-interpretation/default-integration.md).

The user then requested the earlier LLM decision model as well. Connected the existing `gpt-6-luna` reviewer with exchange feedback before dispatch, enabled by default alongside the reply interpreter. It remains advisory, retains the evidence check, and has one eight-second review deadline limited by a 45-second decision budget. Verified 271 tests (one skipped), P08/P18 with unchanged scores/actions/terms, and a concurrent ten-case synthetic wave. All 64 decisions finished within 10.35 seconds; no thread timeouts or invalid deals. [Combined-model report](../evaluations/reply-interpretation/runs/dual-default-report-r01/report.md).
