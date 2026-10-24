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
