# Implementation

ProcuDeal is a buyer agent for Hollerau Pumpenwerke. It negotiates by e-mail with the arena's
supplier bots and closes the deal with the lowest total cost C, or walks away.

**Core rule: code owns every binding number.** Prices, term sheets, claims and the accept/walk
decision are computed in Python from the case file, the data package and the supplier's messages.
A language model may only write wording; nothing it writes binds. The engine decides a move in
about 1 ms, so the 60-second rule is never at risk on our side.

This page describes **engine v1.7**. Every v1.7 behaviour change sits behind a feature flag (see
"Feature flags"); with all flags off the engine behaves like v1.6c plus the bug fixes.

## 1. Where the code lives

```
starter-kit/arena_kit/agents/procudeal/
  __init__.py    ProcuDealAgent: the kit's agent interface, decision trace, fallback on errors
  economics.py   C wrappers: alternative, C_open, accept check, price ceiling, term-mix search,
                 per-sheet supplier extras, index-clause value and cost
  dossier.py     per-supplier facts: full cost, cost of money, cash / work / capacity / hedged signals
  claims.py      claim bank: one-sentence arguments with figures computed from the data
  quote.py       tolerant reader for the quote PDF (v1.7)
  signals.py     what a supplier e-mail asks for, its traits, the cost drivers it asserts
  policy.py      Negotiator: setup, per-move decision, concessions, closing; FEATURES flags
  writer.py      template e-mail around a move
  research/      zone 0 (v2.0, offline): evidence, argument library, Opus 5.5 agents, dossiers,
                 practice corpus and playbook - see docs/research.md
starter-kit/arena_kit/cli.py      registers `--agent procudeal` (only change to a kit file)
starter-kit/scripts/research.py   builds knowledge/ (supplier dossiers, playbook) offline
starter-kit/knowledge/            zone 0 output: suppliers/*.json, playbook.json, index.json
starter-kit/scripts/bench.py      benchmark runner: plays cases, saves runs, logs a row
starter-kit/scripts/compare.py    score table per agent or per run note
starter-kit/scripts/analyse.py    per-case report of every run, round by round (notes/analysis/<case>.md)
starter-kit/scripts/audit.py      rule audit vs what the arena revealed in runs/ (notes/analysis/audit.md; offline)
starter-kit/scripts/replay.py     offline replay: the engine (per flag set) at every recorded state, scored with the true numbers; --menu
starter-kit/tests/test_procudeal_economics.py   economics pinned to the brief's worked example
starter-kit/tests/test_procudeal_signals.py     signals on real supplier sentences
starter-kit/tests/test_procudeal_v17.py         flags, bug fixes and changes A-H on synthetic cases
```

The kit is used as a library and is not forked: `total_cost`, `supplier_value`, `complete_offer`,
`must_haves_ok`, `closing_terms`, `docs.LABELS/SECTIONS/CLAUSE`, `play`, `play_waves`, `DataPackage`.

## 2. One case, end to end

```
open session ──► every supplier's quote e-mail + quote PDF
     │
     ▼
SETUP (once per case, policy.Negotiator.setup)
  C_open  = cheapest opening quote that keeps the must-haves (with each supplier's standard terms)
  limit   = min(C of our alternative, C_open)        a deal must cost less than this
            (C_open and every accept check use the same relationship estimate)
  per supplier (policy.new_side):
    standard  = quote PDF "standard terms"            what closes for fields a sheet leaves out
    reference = offered + standard + fixed + plan     the supplier's own baseline for valuing a deal
    dossier   = dossier.build(...)                    full cost, cost of money, signals
    clause    = index clause on its asserted driver   (proactive_clause; see D below)
    plan      = economics.plan_terms(...)             every allowed term mix at equal value to it,
                                                      ranked by our C at the expected deal price;
                                                      near-ties: the supplier-friendly mix (friendly_ties)
    mix       = plan[0]                               the non-price terms we propose
    anchor    = its price on our mix x ANCHOR[goal]   (persona floors with patience; not below the
                                                      relationship optimum, not above today's price
                                                      in a price increase)
    ceiling   = highest price on our mix with C < limit
    bank      = claims.build_bank(...)                arguments, strongest first
  resumed case (the runner restarted): rebuild our prices, its prices and the claims used from
  the threads (policy.restore)
     │
     ▼
EACH MOVE (policy.Negotiator.decide)
  settle    our last move: kept once the supplier answered; rolled back (price, claims, trade)
            when the arena answered instead - a late send (409) never reached the supplier
  observe   new supplier replies: convert its standing sheet to "its price on our mix"; every price
            it offers caps our full-cost estimate; claim results (dead kinds); asks and traits
  best      cheapest standing sheet that passes economics.accept_check
  ready?    agreed / final_offer, or one move left, or at or below our last offer, or within 0.5 %
            of it with no fresh lever left (strict_accept), or (stabilise / secure_supply) at the
            price cheapest for us
  close     if the best sheet's supplier is ready (or all are): ACCEPT it
            if no sheet passes and every thread is finished: WALK AWAY
  RFQ       reverse auction once the leader is ready; keepalive for a ready thread that waits
  else      OFFER to the supplier that has waited longest:
              "clarify internally" -> our last sheet again, unchanged, no claims (silence)
              price  = anchor first, then our last + 30 % of the gap (10 % after a deep first
                       drop), within the patience budget
              sheets = one main sheet + at most one need-trade sheet (single_sheet)
              claims = 3 of different kinds first, then one new kind per round (lever_schedule);
                       in an RFQ each new rival offer first
              e-mail = writer.offer_email(...)
```

## 3. Modules

### economics.py
| Function | What it returns |
|---|---|
| `alternative_cost(case)` | C of the case's alternative; infinite when there is none |
| `walk_away_limit(case, c_open)` | the C a deal must stay below: min(alternative, C_open) |
| `opening_cost(case, quotes)` | C_open as the arena computes it (must-haves kept) |
| `cost(case, terms, std, supplier)` | `total_cost` with the supplier's per-sheet cash extras in its relationship estimate (v1.7) |
| `value(case, terms, supplier, deal)` | `supplier_value` with per-sheet extras; `deal` adds the clause protection (how it judges an offer) (v1.7) |
| `accept_check(case, terms, std, supplier, c_open)` | (ok, reason): price present, must-haves, C below the limit |
| `cheapest_price(...)` | price minimising C; above the lowest only when a relationship charge applies (golden-section) |
| `price_ceiling(case, terms, limit_c, ...)` | highest price with C < limit_c (bisection), or None |
| `price_for_value(case, terms, supplier, target)` | price at which terms are worth `target` to the supplier (linear solve) |
| `plan_terms(case, quote, std, supplier, deal_ratio, friendly, options)` | every allowed mix at equal supplier value, ranked by our C at `deal_ratio` x that price. Without `friendly`: within EUR 1 the mix that changes fewest of its terms first (v1.6b). With `friendly` (v1.7): mixes within max(EUR 1, 0.1 % of C) of the cheapest are ordered by `friendly_key`, then C to the euro, then fewest changes. `options` overrides allowed values (one clause) |
| `friendly_key(case, sheet)` | longest contract, then highest volume up to our need, then longest lead time within our need |
| `clause_cost_rate(case, clause)` | our cost of a clause per EUR of new-price spend: share x (expected move beyond the deadband + index risk) |
| `clause_value_rate(clause, driver)` | its protection per EUR of price: min(stated share, clause share) x max(0, rise − deadband), at most rise x stated share |
| `equal_cost_price(case, terms, c_target, ...)` | price at which other terms cost us the same: for alternative sheets |

**Per-sheet extras (v1.7).** A supplier estimate may carry `"extras": fn(terms, deal)`, EUR per unit
a sheet costs or brings the supplier beyond the kit's items. `cost` and `value` resolve it into the
kit's `extra` for each sheet. All extras are shares of the price, so `price_for_value` stays a
two-point linear solve. The arena's relationship charge counts cash only, so `cost` never includes
the clause protection.

### dossier.py
All SQLite reads and ID lookups go through `dossier.query` / `document` / `ids` / `lookup` under one
lock: cases running in parallel share one connection (v1.5; `ids`/`lookup` v1.7, because their first
call builds the package's ID index on that connection).

- **Cost of money** by owner type: group 5 %, private 7 %, family 7.5 %, founder 10 %, plus 5 points
  when its letters, e-mails or news show a cash need ("overdue invoices", "cash discount", ...).
  With `rich_value`: at least what its cash discount implies, `min(20 %, pct x 360 / max(days, 10) / 2)`
  (2 % within 10 days → 20 %).
- **Full cost**: the should-cost of its own plant, else the German should-cost x country factor
  (AT 1.05, CH 1.1, CZ/PL/HU 0.82, TR 0.75, CN 0.7), else its quote less 10 %. Every price it
  offers later caps the estimate at 99.5 % of that price, but never below the source's error band
  (own plant −5 %, German × country −15 %): suppliers do go below full cost for a clause (v1.5).
- **Signals**: cash need, looks for work, capacity full, hedged ("bought their copper forward",
  "covered at fixed prices") - regex over its documents and news. A full supplier never counts as
  looking for work; "order intake" is not a work sign (v1.7: the data says it of full suppliers).
- **Scorecard ppm**: its latest `scorecards.ppm`, used as its real defect rate with `rich_value`.

### claims.py
Each claim is one sentence with its figure next to the IDs, computed the way the arena checks it:

| Kind | Source | Strength |
|---|---|---|
| rival_offer | another bidder's standing offer in this session (RFQ) | 8 |
| notice_period | price letter `doc:` days vs contract price clause `ctr:…#` days, when the letter gives less | 7 |
| should_cost | `cost:` row, only below 98 % of the quote | 6 |
| quality_record | `sc:` ppm (quality_first cases) | 6 |
| index_change | the part's cost drivers: largest fall over a window of up to 12 months ending at the latest month, at least −0.5 % | 5 + weight |
| delivery_record | `sc:` on-time % below 90 | 4 |
| volume_change | latest `fc:` forecast change when positive | 4 |
| order_history (v1.7) | our last 2-3 `po:` lines of this part from this supplier, below its quote; the recorded price per the part's price unit (no figure when the prices differ: the data's own values are checked) | 3 |
| call_note (v1.7) | its latest call or meeting note `doc:`; context, not a check, so **no figure** in the sentence (a specific line when the note says its material is bought forward) | 1 |

Claims whose IDs are not in the data are dropped. The data month for index recency is the latest
month in the data (`index_values` and every `idx:` ID, Sunday release included), no longer fixed.
With `lever_schedule`, an ID counts once per **case** (the arena's rule: a second bidder hearing the
same index IDs answered `duplicate`), and the two new kinds only exist with the flag on.

### quote.py (v1.7)
Reads the quote PDF line by line with the kit's `LABELS` / `SECTIONS` / `CLAUSE`; a line that cannot
be read is skipped (logged), the rest kept. An Incoterm the case does not price counts as the
costliest. `standard_terms(case, events)` (latest quote) and `first_quote(case, events)` (all
sections of the first) replace the kit's `standard_terms` / `quote_terms` in the engine.

### policy.py constants
| Constant | Value | Meaning |
|---|---|---|
| `ANCHOR` | leverage 0.80, routine 0.84, quality_first 0.88, secure_supply 0.90, stabilise 0.92 | first offer as a share of its price on our mix |
| deal ratio | (1 + anchor) / 2 | price level at which term mixes are compared |
| `STEP` / `HOLD_STEP` | 0.30 / 0.10 | share of the gap we close per round; hold after a deep first drop |
| `DEEP_DROP` | 0.06 | a first counter this far down signals a deep floor |
| `CLOSE_GAP` | 0.005 | accept when its price is within this of our last offer |
| `STRICT_MOVES` | 2 | strict_accept: with this few moves left, "within 0.5 %" closes even with a lever left |
| `FIRST_CLAIMS` / `LATER_CLAIMS` | 3 / 1 | claims per message |
| `DATA_CLAIMS` | 2 | claims after "which figures is that based on?" |
| `DEAD_RESULTS` | contradicted, irrelevant | lever_schedule: a kind that came back so is not used again in the case |
| `DONE` | agreed, final_offer | statuses we accept on; a supplier at final_offer never gets another priced sheet (v1.7: also in the fallback when nothing is acceptable) |
| `STUCK_STEP` | 0.45 | step for one round after "without movement from your side…" |
| `PATIENT_SHIFT` | 0.03 | anchor −3 points for founder / ≥ 4-day replies, +3 for groups with ≤ 2-day replies |
| `HEALTH_BAND` | 0.98 | stabilise / secure_supply: a price this far below the health price is countered at it, even after `agreed` |
| `TRADE_GAIN` | EUR 1 | single_sheet: a need-trade sheet must cost us at least this much less than the main sheet |
| `KEEPALIVE_S` / `KEEPALIVE_MARGIN` / `KEEPALIVE_MAX` | 35 s / 10 s / 3 | keepalive: a ready RFQ thread that has waited 35 s (or 60 s − slowest reply − 10 s, if less) gets a sheetless note, at most 3 times |
| `PATIENCE` | normal 1.0, relationship 0.3, capacity full 0.16, near cost 0.14 | patience: share of the opening gap we may concede in total (the lowest that applies) |
| `NEAR_COST` | 0.98 | near cost: own-plant should-cost at least this share of its quote |
| `ANCHOR_FLOOR` | capacity full 0.93, near cost 0.97 | patience: anchor at least this share of its price on our mix |
| `WANTS_WORK_SHIFT` | 0.02 | patience: anchor 2 points lower for a supplier looking for work |
| `OVERTIME_FULL` / `OVERTIME` | 0.5 % / 0.1 % of the price per day | rich_value: what a delivery faster than its own lead time costs it (capacity full / not) |
| `VOLUME_PLUS` | 2 % of the price per +100 % volume | rich_value: idle capacity a larger volume fills, when it looks for work |

The `PATIENCE`, `ANCHOR_FLOOR` and `OVERTIME` values come from practice evidence and are kept round.

### Feature flags (v1.7)
Every v1.7 behaviour change can be switched off without a code edit, for ablation runs:
`PROCUDEAL_OFF="single_sheet,rich_value" uv run python scripts/bench.py ...`, and a flag that is off by
default switched on: `PROCUDEAL_ON="patience"`. Both are read once at import; unknown names are logged
and ignored. Defaults since v1.7c: every flag on except `patience` and `call_note_lever`. The setup log line and the first entry of the
decision trace (`features_off`) show which flags were off. Bug fixes are never flagged. With every
flag off the engine behaves like v1.6c plus the bug fixes (sandbox D01 0.883, D02 0.482: identical).

| Flag | Change | On: what the engine does |
|---|---|---|
| `strict_accept` | C | "within 0.5 % of our offer" closes only when no fresh lever is left or ≤ 2 moves remain; a counter at or below our offer closes at once; our price never steps back below our last offer |
| `single_sheet` | B | one main sheet + at most one need-trade sheet; no equal-cost menus, no leader-terms sheet, no equal-cost clause sheet |
| `lever_schedule` | A | 3 claims of different kinds first, then one new kind per round; dead kinds dropped; an ID once per case; a rival re-offer at the same price is no new lever; order-history and call-note levers |
| `friendly_ties` | E | on a C tie: longest contract, then volume up to our need, then longest lead time within need |
| `silence` | G | "clarify internally": resend the last main sheet unchanged, no claims (once in a row) |
| `proactive_clause` | D | index clause on the supplier's asserted driver when it is worth more to it than it costs us; adopt the clause it demands |
| `patience` (default **off** since v1.7c) | F | patience budget on our concessions, persona anchor floors |
| `call_note_lever` (default **off**, v1.7c) | A | the figure-free call / meeting note claim in the lever schedule |
| `rich_value` | H | supplier value with scorecard ppm, overtime, volume, skonto-implied cost of money |
| `keepalive` | bug 6 | RFQ: a sheetless note to a ready, acceptable thread that has waited long enough (see RFQ tactics); its agreed / final status stays after a reply with the same terms (a new offer ID each reply) |
| `quote_cap` (default **off**, v1.8) | audit | the full-cost estimate is capped once, by the opening quote: price x (1 − sustainable margin); later prices no longer cap it (suppliers do close below full cost) |
| `measured_rate` (default **off**, v1.8) | audit | its cost of money from two of its own sheets in one message that differ only in payment days (`economics.implied_rate`, exact inverse of `supplier_value`); replaces the owner-type rule and blocks the cash premium; replans the term mix |
| `health_refresh` (default **off**, v1.8) | audit | health price and price ceiling recomputed whenever the full-cost estimate or the rate changes (v1.7c kept the setup value) |
| `tactician` (default **off**, v2.0) | hybrid | single-supplier cases: after the engine decides, `context.build` + one model call (`tactician.ask`, 25 s wall-clock deadline) choose among the code-priced options; `to_move` checks it; `Negotiator.replace_move` keeps the engine's bookkeeping consistent; any failure sends the engine's move. Use with `quote_cap,measured_rate,health_refresh` |
| `tactician_text` (default **off**, v2.0) | hybrid | the tactician's figure-free paragraph goes into the e-mail (off: the engine's template words) |

**A. Lever schedule.** `pick_claims` takes, in the first message, up to 3 claims of different kinds;
later exactly one claim of a kind this supplier has not heard (2 after a data ask). A rival offer is
always allowed once per new offer ID. `claim_results` of each reply are matched to the claims of our
last message (only when the counts match); a `contradicted` or `irrelevant` kind is dropped for the
case. With no lever left the round still moves on price.

**B. Need trade.** Wanted fields come from asks and signals: shorter payment (payment ask or cash
need), more volume up to our need (volume ask or looking for work), longer lead time within our need
or longer contract (capacity full). Each candidate changes one field of the main sheet, is priced at
equal value to the supplier (`price_for_value`), keeps the must-haves and (strategic goals) the
health floor, and must cost us more than `TRADE_GAIN` less than the main sheet. The cheapest goes as
the second sheet; a trade is never sent twice. Because the main mix is already the cheapest at equal
value, a trade fires rarely (mainly when its need changed after the plan).

**D. Proactive clause.** The opening e-mail's template "X rose r % in twelve months and is s % of our
cost" (`signals.drivers`) names its drivers. For a driver with a clause option, the widest deadband
on that series is taken if its protection rate exceeds our cost rate, the mix keeps the must-haves
and the supplier is not hedged (dossier or reply). The clause value then counts in the supplier's valuation of every sheet with
that clause, so the plan's main mix carries it at the equal-value price, and the usual anchor ratio
applies. **Not in stabilise / secure_supply:** there our price is held at the supplier's health price
(the relationship charge counts cash, not security), so the protection buys us nothing while the
index risk still costs (P02: about EUR 18k, 38 % of the case's score range). While our clause is
proposed, its sheet without the clause is not compared on price (only agreed / final close). When
the supplier demands a clause and its sheet carries an allowed option, that option goes into our mix
and every re-plan keeps it; an alternative sheet with a different clause no longer replaces our mix
(v1.7b: in P08 the 5-deadband alternative looked cheaper, but the supplier conceded far less on it).

**F. Patience.** The budget is a share of the opening gap (its first price on our mix less our first
offer), the lowest share that applies: relationship goals 0.3, capacity full 0.16, near cost 0.14,
else 1.0. Each later step takes at most half of what is left of it. The health-price counter of
strategic cases and the price-frozen reaction are not capped.

**H. Rich value.** Its scorecard ppm values chargebacks; a delivery faster than its own lead time
costs it 0.5 %/day of the price when capacity is full, else 0.1 %/day; more volume than it quoted
brings it `VOLUME_PLUS` when it looks for work; its cost of money is at least the skonto-implied rate.

### signals.py
Reads each supplier e-mail (the bots' replies are templated across the arena):

| Signal | Matches (examples) | Effect in policy |
|---|---|---|
| ask: volume | "Which volume can you commit to?", "binding higher volume" | writer states our volume and contract commitment; need trade (more volume) |
| ask: payment | "Faster payment is welcome", "need faster payment terms" | supplier cost of money +5 points once, term mix re-planned; need trade (shorter payment) |
| ask: clause | "Preisgleitklausel", "price adjustment clause" (not "no Preisgleitklausel", v1.7) | v1.6c: one sheet with the index clause at equal cost to us; v1.7: adopt its clause option |
| ask: data | "Which figures is that based on?", "provide proof" | two claims in the next message |
| trait: price_frozen | "freeze on price reductions", "talk about the terms instead" | no more discounting; its price on our term mix |
| trait: hedged | "not our reality", "covered at fixed prices" | index claims dropped; proactive clause dropped |
| trait: stuck | "Without movement from your side", "we are stuck" | step 45 % of the gap for one round |
| trait: clarify (v1.7) | "We need to clarify this internally - we will come back to you on price" (not "we have clarified") | silence: our sheet stands |
| drivers (v1.7) | "CU-NOTATION rose 47.7 % in twelve months and is 20 % of our cost" | proactive clause |
| reply delay | `signals.reply_delay_days` of its first e-mail | ≥ 4 days or founder: anchor −3 points; group with ≤ 2 days: +3 points |

Alternative sheets in a reply (`offer:…-a`) are priced too; if one costs us less than its standing
sheet, its term mix becomes ours. Every change of our mix recomputes its price ceiling and health
price (v1.7; before, both stayed at their setup values).

### RFQ tactics (v1.6, two or more live bidders)
| Rule | Trigger | Action |
|---|---|---|
| leader | lowest C among standing sheets that keep the must-haves | cited to the others; v1.6c: its term mix offered to them (off with single_sheet) |
| rival claim | every new offer of the leader; to the leader itself, the runner-up's offer when its price is lower (v1.6b) | "Another supplier has offered EUR x per unit for this part (offer:…)", plus a figure-free line on better terms |
| hold | its price fell ≥ `DEEP_DROP` since its previous reply | step `HOLD_STEP` instead of `STEP` |
| drop | after 2 replies its C > leader × (1 + `DROP_GAP` = 0.10) | no more rounds unless the others end |
| reverse auction (v1.6c) | leader ready and a live runner-up exists (not at final_offer) | the runner-up is asked to beat the leader's C by `AUCTION_EDGE` = 2 %; repeat with the new runner-up while the best C improves ≥ 0.5 %, at most `AUCTION_CALLS` = 4; then accept the best C |
| keepalive (v1.7) | a ready thread (not the one we are about to message) waited > 35 s, > 1 move left | "Thank you. Could you confirm how long your offer remains valid?" without a sheet: its offer stands |

The kit plays one message at a time and waits for each reply, so in an RFQ the other threads' 60 s
clocks run meanwhile. Uncached bot replies take about 15-40 s, so the keepalive fires after
`min(35 s, 60 s − slowest reply so far − 10 s)` (at least 1 s), at most `KEEPALIVE_MAX` = 3 times per
thread, and only for a ready thread whose standing sheet passes the accept check. It has not fired in
a recorded run yet, so how a bot at final_offer answers it is untested.

### writer.py
Template e-mail: thanks, answers to its asks, claim sentences, one line on the sheets (one proposal;
"the second package reflects your wish for …" for a need trade; v1.6c: "N packages"), an offer of
faster payment when the supplier needs cash (with single_sheet only when a sheet shows it), sign-off.
`hold`: one line, our sheet unchanged. `note_email`: a message without a term sheet (keepalive). No
figures outside claims, no urgency, budget or missing alternative.

### __init__.py
`ProcuDealAgent.decide(case, threads)` runs the Negotiator. If the engine raises, that single move
is made by the kit's LLM agent (which has its own guards), so a bug never loses a case. Every move is
appended to `agent.trace` with its reasons (price, anchor, ceiling, their price on our terms, C,
claims, budget, trade, or why we accepted or walked away); the first entry carries `features_off`.
`bench.py` saves it with the run.

## 4. Run and test

From `starter-kit/`:
```bash
uv run pytest -q tests/test_procudeal_*.py                              # engine tests (free)
uv run python scripts/bench.py --agent procudeal case:D01 case:D02 --note "<version>"   # sandbox, free
uv run python scripts/bench.py --agent procudeal --set practice --parallel 5 --note "<version>"  # 10 sessions
PROCUDEAL_OFF="single_sheet" uv run python scripts/bench.py ... --note "<version> -single_sheet"   # ablation
uv run python scripts/compare.py --by note                              # score table per version
uv run arena run --set final --agent procudeal --parallel 10            # the Live Final runner
```
Every bench run writes `runs/<case>/<time>_<agent>_<session>.json` (result, trace, back office, our
decision trace) and a row in `notes/runs.md`.

Simulator crash check (free): `arena-sim serve --no-clock`, register a sim key, play `case:S01`
… `S03` with `agent_factory('procudeal', 'data/package')`; require a deal and no `kit-llm` fallback
in `agent.trace`.

## 5. Known gaps (next work)

- Full-cost estimate in strategic cases: our own-plant should-cost floor keeps the health price high
  (P02: EUR 374.95 against a quote of EUR 370.96), which also rules the proactive clause out there.
- The kit's `closing_move` (wave cap) still uses the kit's strict quote parser.
- The e-mail is a template; an LLM-written paragraph (no digits, with a fallback) is planned.
- Sunday release data is merged by `DataPackage` for facts and IDs; the dossier reads SQLite only.

## Priced menu (v1.8, H1.3)

`economics.menu(case, standing, standard, supplier, band)` prices every allowed term mix for a
judgment (the hybrid's context, `docs/findings.md` section 9), without choosing. Per mix: the price
worth as much to the supplier as its standing sheet in cash (`equal_value_price`; blind to non-cash
terms such as a clause), our C there, and in relationship goals the health price (C lowest), our C
there and, with a full-cost band, the health price at both ends. Not used by the fallback engine.
Offline check: `uv run python scripts/replay.py P02 --menu`.

## Hybrid packet (v2.0 phase 2, `context.py`)

`context.build(neg, threads, move)` turns the engine's state after its own move into one labelled
packet for the judgment call. Labels:

| label | source |
|---|---|
| A | case file, published formula |
| D | data record with an ID |
| E | our estimate, with its range and method |
| S | what the supplier sent in this session |
| Z | the zone-0 dossier's reading, with IDs |

Sections:
- **case:** the score, C_open, the alternative, the relationship charge, what a clause costs us;
- **supplier:** full cost and cost of money (E), needs and constraints (Z, minus any line about its
  cost: code owns that estimate);
- **thread:** every sheet with our C, its stated cost drivers, its verdict per claim kind, the arena's
  claim results, its latest e-mail with the bots' stock lines marked `~`;
- **arguments:** what we may cite before the engine's pick, and its side of the facts (the
  practice prior per kind was left out: the live verdict per claim covers it without practice data);
- **options:** E0 is the rule engine's move, labelled a default. Then every allowed value of every
  field at least once, from `economics.menu`, each with code-set rungs: the health price (relationship
  goals) or the engine's C level, midway, and its cash level. Rungs never go below the health price
  or above the limit;
- **accept:** the standing sheets that pass the accept check;
- **state.**

Never in a packet: tuned constants, the claim ranking, regex signals, back office or reasons.

Returns the text plus the ids code validates (options and rungs, claims, acceptable sheets). Size:
about 1.9k tokens for P02's opening. Render one with `scripts/replay.py P02 --packet 0`.
Lookups written by `scripts/audit.py`: `knowledge/stock_lines.json` (used) and `knowledge/claim_prior.json`
(not used in the packet). `build(..., zone0=False)` leaves out the [Z] lines, for the with / without test.

## Tactician (v2.0 phases 2-3, `tactician.py`)

One model call per move over the packet: `ask(packet)` → answer, latency; `to_move(neg, packet,
answer, engine_move)` → the checked move.

**The prompt** holds the arena's rules (from the brief), how to read the labels, and the meaning of
the rungs. It holds no tactics of ours.

**The answer** (JSON schema):
- read and reason;
- action: counter / accept / hold;
- option and rung;
- up to 3 argument ids;
- a figure-free message, filtered by `strategist.clean_paragraph`.

**What code checks.** The engine's move (E0) is kept when any of these fails:
- the option and rung exist in the packet;
- an accepted sheet is listed under ACCEPT;
- no counter to a final offer (CLAUDE.md);
- must-haves are kept.

An argument id the packet does not hold is dropped and the rest of the move stands.

Env: `TACTICIAN_MODEL` (claude-opus-5-5), `TACTICIAN_EFFORT` (low), `TACTICIAN_TIMEOUT_S` (25).
Measured offline at Opus 5.5 low over 71 calls: median 8.0 s, p95 9.6 s, max 11.9 s; $0.032 per call.

Offline test: `uv run python scripts/replay.py P02 --model claude-opus-5-5 --effort low`
(`--with-z-only` skips the arm without [Z] lines).

**Live (phase 3):** `ProcuDealAgent.hybrid` runs after `Negotiator.decide` when `tactician` is on, in
single-supplier cases, on offers and accepts. Walk-aways, notes and RFQs stay with the engine.
- **Order:** the engine's move is computed first. The model's move replaces it only when every check
  passes.
- **Deadline:** wall-clock, retries included, on a 16-thread pool.
- **Trace:** every decision records `hybrid` (seconds, check, choice, used).
- **No step back:** every rung is worth at least as much to the supplier as our last offer. On the
  terms we sent last, step rungs of 10 / 25 / 50 % of the gap to its level are added.

Run: `PROCUDEAL_ON="tactician,quote_cap,measured_rate,health_refresh" uv run python scripts/bench.py ...`
