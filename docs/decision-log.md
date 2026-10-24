# Decision log

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
