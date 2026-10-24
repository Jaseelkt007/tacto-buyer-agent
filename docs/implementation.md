# Implementation

ProcuDeal is a buyer agent for Hollerau Pumpenwerke. It negotiates by e-mail with the arena's
supplier bots and closes the deal with the lowest total cost C, or walks away.

**Core rule: code owns every binding number.** Prices, term sheets, claims and the accept/walk
decision are computed in Python from the case file, the data package and the supplier's messages.
A language model may only write wording; nothing it writes binds. The engine decides a move in
about 1 ms, so the 60-second rule is never at risk on our side.

## 1. Where the code lives

```
starter-kit/arena_kit/agents/procudeal/
  __init__.py    ProcuDealAgent: the kit's agent interface, decision trace, fallback on errors
  economics.py   C wrappers: alternative, C_open, accept check, price ceiling, term-mix search
  dossier.py     per-supplier facts: full cost, cost of money, cash / work / capacity signals
  claims.py      claim bank: one-sentence arguments with figures computed from the data
  policy.py      Negotiator: setup, per-move decision, concessions, closing
  writer.py      template e-mail around a move
starter-kit/arena_kit/cli.py      registers `--agent procudeal` (only change to a kit file)
starter-kit/scripts/bench.py      benchmark runner: plays cases, saves runs, logs a row
starter-kit/scripts/compare.py    score table per agent or per run note
starter-kit/tests/test_procudeal_economics.py   economics pinned to the brief's worked example
```

The kit is used as a library and is not forked: `total_cost`, `supplier_value`, `complete_offer`,
`must_haves_ok`, `standard_terms`, `quote_terms`, `play`, `play_waves`, `DataPackage`.

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
    plan      = economics.plan_terms(...)             every allowed term mix at equal value to it,
                                                      ranked by our C at the expected deal price
    mix       = plan[0]                               the non-price terms we propose
    anchor    = its price on our mix x ANCHOR[goal]   (not below the relationship optimum,
                                                      not above today's price in a price increase)
    ceiling   = highest price on our mix with C < limit
    bank      = claims.build_bank(...)                arguments, strongest first
     │
     ▼
EACH MOVE (policy.Negotiator.decide)
  observe   new supplier replies: convert its standing sheet to "its price on our mix";
            every price it offers caps our full-cost estimate (it never sells below its floor)
  best      cheapest standing sheet that passes economics.accept_check
  ready?    supplier said agreed / final_offer, or one move left, or its price is within 0.5 %
            of our last offer, or (stabilise / secure_supply) at the price cheapest for us
  close     if the best sheet's supplier is ready (or all are): ACCEPT it
            if no sheet passes and every thread is finished: WALK AWAY
  else      OFFER to the supplier that has waited longest:
              price  = anchor first, then our last + 30 % of the gap (10 % after a deep first drop)
              sheets = main sheet + equal-cost alternatives (first move: next mixes from the plan;
                       later: its own term mix at the same cost to us)
              (stabilise / secure_supply: no extra sheet below the relationship optimum)
              claims = 3 in the first message, 1 later; in an RFQ the cheapest rival offer first
              e-mail = writer.offer_email(...)
```

## 3. Modules

### economics.py
| Function | What it returns |
|---|---|
| `alternative_cost(case)` | C of the case's alternative; infinite when there is none |
| `walk_away_limit(case, c_open)` | the C a deal must stay below: min(alternative, C_open) |
| `opening_cost(case, quotes)` | C_open as the arena computes it (must-haves kept) |
| `accept_check(case, terms, std, supplier, c_open)` | (ok, reason): price present, must-haves, C below the limit |
| `cheapest_price(...)` | price minimising C; above the lowest only when a relationship charge applies (golden-section) |
| `price_ceiling(case, terms, limit_c, ...)` | highest price with C < limit_c (bisection), or None |
| `price_for_value(case, terms, supplier, value)` | price at which terms are worth `value` to the supplier (linear solve) |
| `plan_terms(case, quote, std, supplier, deal_ratio)` | every allowed mix at equal supplier value, ranked by our C at `deal_ratio` x that price; within EUR 1, the mix that changes fewest of the supplier's own terms first (v1.6b) |
| `equal_cost_price(case, terms, c_target, ...)` | price at which other terms cost us the same: for alternative sheets |

### dossier.py
All SQLite reads go through `dossier.query` / `dossier.document` under one lock: cases running in
parallel share one connection (v1.5).

- **Cost of money** by owner type: group 5 %, private 7 %, family 7.5 %, founder 10 %, plus 5 points
  when its letters, e-mails or news show a cash need ("overdue invoices", "cash discount", ...).
- **Full cost**: the should-cost of its own plant, else the German should-cost x country factor
  (AT 1.05, CH 1.1, CZ/PL/HU 0.82, TR 0.75, CN 0.7), else its quote less 10 %. Every price it
  offers later caps the estimate at 99.5 % of that price, but never below the source's error band
  (own plant −5 %, German × country −15 %): suppliers do go below full cost for a clause (v1.5).
- **Signals**: cash need, looks for work, capacity full (regex over its documents and news).

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

Claims whose IDs are not in the data are dropped, and each ID is used once per case.

### policy.py constants
| Constant | Value | Meaning |
|---|---|---|
| `ANCHOR` | leverage 0.80, routine 0.84, quality_first 0.88, secure_supply 0.90, stabilise 0.92 | first offer as a share of its price on our mix |
| deal ratio | (1 + anchor) / 2 | price level at which term mixes are compared |
| `STEP` / `HOLD_STEP` | 0.30 / 0.10 | share of the gap we close per round; hold after a deep first drop |
| `DEEP_DROP` | 0.06 | a first counter this far down signals a deep floor |
| `CLOSE_GAP` | 0.005 | accept when its price is within this of our last offer |
| `FIRST_CLAIMS` / `LATER_CLAIMS` | 3 / 1 | claims per message |
| `DONE` | agreed, final_offer | statuses we accept on; we never push after final_offer |
| `STUCK_STEP` | 0.45 | step for one round after "without movement from your side…" |
| `PATIENT_SHIFT` | 0.03 | anchor −3 points for founder / ≥ 4-day replies, +3 for groups with ≤ 2-day replies |
| `DATA_CLAIMS` | 2 | claims after "which figures is that based on?" |
| `HEALTH_BAND` | 0.98 | stabilise / secure_supply: a price this far below the health price is countered at it, even after `agreed` |

### signals.py (v1.4)
Reads each supplier e-mail (the bots' replies are templated across the arena):

| Signal | Matches (examples) | Effect in policy |
|---|---|---|
| ask: volume | "Which volume can you commit to?", "binding higher volume" | writer states our volume and contract commitment |
| ask: payment | "Faster payment is welcome", "need faster payment terms" | supplier cost of money +5 points once, term mix re-planned |
| ask: clause | "Preisgleitklausel", "price adjustment clause" | one sheet with the index clause at equal cost to us |
| ask: data | "Which figures is that based on?", "provide proof" | two claims in the next message |
| trait: price_frozen | "freeze on price reductions", "talk about the terms instead" | no more discounting; its price on our term mix |
| trait: hedged | "not our reality", "covered at fixed prices" | index claims dropped |
| trait: stuck | "Without movement from your side", "we are stuck" | step 45 % of the gap for one round |
| reply delay | `signals.reply_delay_days` of its first e-mail | ≥ 4 days or founder: anchor −3 points; group with ≤ 2 days: +3 points |

Alternative sheets in a reply (`offer:…-a`) are priced too; if one costs us less than its standing
sheet, its term mix becomes ours.

### RFQ tactics (v1.6, two or more live bidders)
| Rule | Trigger | Action |
|---|---|---|
| leader | lowest C among standing sheets that keep the must-haves | cited to the others; its term mix offered to them |
| rival claim | every new offer of the leader; to the leader itself, the runner-up's offer when its price is lower (v1.6b) | "Another supplier has offered EUR x per unit for this part (offer:…)", plus a figure-free line on better terms |
| leader's terms sheet | leader's mix differs from ours | extra sheet on that mix at equal cost to us |
| hold | its price fell ≥ `DEEP_DROP` since its previous reply | step `HOLD_STEP` instead of `STEP` |
| drop | after 2 replies its C > leader × (1 + `DROP_GAP` = 0.10) | no more rounds unless the others end |
| last call | leader ready and a live runner-up exists | one message to the runner-up beating the leader's C by `LAST_CALL_EDGE` = 1 %; then accept the best C |

### writer.py
Template e-mail: thanks, claim sentences, one line on the packages, an offer of faster payment when
the supplier needs cash, sign-off. No figures outside claims, no urgency, budget or missing
alternative.

### __init__.py
`ProcuDealAgent.decide(case, threads)` runs the Negotiator. If the engine raises, that single move
is made by the kit's LLM agent (which has its own guards), so a bug never loses a case. Every move is
appended to `agent.trace` with its reasons (price, anchor, ceiling, their price on our terms, C,
claims, or why we accepted or walked away); `bench.py` saves it with the run.

## 4. Run and test

From `starter-kit/`:
```bash
uv run pytest -q tests/test_procudeal_economics.py                      # economics tests
uv run python scripts/bench.py --agent procudeal case:D01 case:D02 --note "<version>"   # sandbox, free
uv run python scripts/bench.py --agent procudeal --set practice --parallel 5 --note "<version>"  # 10 sessions
uv run python scripts/compare.py --by note                              # score table per version
uv run arena run --set final --agent procudeal --parallel 10            # the Live Final runner
```
Every bench run writes `runs/<case>/<time>_<agent>_<session>.json` (result, trace, back office, our
decision trace) and a row in `notes/runs.md`.

## 5. Known gaps (next work)

- v1.4 covers supplier asks, alternatives, clause offers and hedged suppliers (see signals.py).
- RFQ: no pruning of losing bidders and no keepalives; P05 stays at 0.55.
- The e-mail is a template; an LLM-written paragraph (no digits, with a fallback) is planned.
- Sunday release data is merged by `DataPackage` for facts, but the dossier only reads SQLite.
