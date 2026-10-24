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
