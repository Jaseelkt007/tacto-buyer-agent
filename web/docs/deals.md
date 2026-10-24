# Deals: negotiation replay

**Route:** `/negotiations` (overview), `/negotiations/<session_id>` (one run).
**Question it answers:** how did each deal come about, move by move, and why did our agent do what it did?

## Where the data comes from

`starter-kit/scripts/bench.py` (on `main`) saves one JSON per played session to
`runs/<case>/<stamp>_<agent>_<session>.json`. `npm run sync:runs` copies all of them from
`origin/main` into `src/data/runs.json`. Each run holds:

| Field | Source | What it is |
|---|---|---|
| `result` | arena | deal or not, final terms, `c_open`, `c_deal`, `c_alt`, `c_best`, score, cost breakdown |
| `trace` | arena | every move in order: supplier offers (with their reasons and verdicts on our claims) and our messages |
| `backoffice` | arena | the supplier's internal messages per round (sales asks finance, owner decides, …) |
| `decisions` | our agent | the engine's log per move: inputs it read, the price it chose, claims picked, why it accepted |

Runs of the kit's `naive` and `llm` agents have no `decisions`; the page says so and shows only the e-mails.

## Overview page

A table of **cases × agent versions** (kit naive, kit llm, engine v1 … v1.3). Each cell is the score
(0–100) of the latest run of that version on that case, shaded by score; "no deal" or "timeout"
marks runs that ended without a deal. Clicking a cell opens the replay. The footer gives the mean per
version over the cases it played (different case sets, so compare shared cases).

It shows at a glance, for example, that engine v1.2 scored 0 on six cases and v1.3 fixed them.

## Replay page

1. **Score strip.** As on Tacto's slide: opening offer (left) → our deal → best possible (right),
   in total cost over the contract. The dashed tick is our alternative (walking away) when it lies
   in range. Score = share of the possible saving captured.
2. **Price path per supplier.** Unit price per round: supplier offers (orange dots), our offers (blue
   squares), our ceiling (dashed: the highest price whose total cost still beats the walk-away
   limit). A green ring marks the accepted offer, a red cross a supplier walking away. Hover a round
   for its values.
3. **How our agent negotiated.** Who decided each move (code engine or LLM fallback), total thinking
   time, verdicts on our arguments (verified / contradicted / duplicate / irrelevant), timeouts.
4. **Deal total cost.** The price, then each cost on top (freight, payment terms, quality,
   supplier health, …) from `cost_breakdown`.
5. **Move by move.** One card per supplier per round:
   - left, the supplier: price and change vs its last offer, which of our arguments it checked and
     the verdict, its stated reasons, its internal back-office messages, its e-mail;
   - right, our agent: the decision ("Counter at €128.56", "Accept this offer"), Engine or LLM
     fallback, time taken, the numbers it used (their price converted to our term mix, our offer,
     anchor, ceiling), our main sheet's total cost against the walk-away limit, the arguments it
     picked, the term sheets sent, the data IDs cited and our e-mail.

## What it means

- **The LLM is not the negotiator in engine v1.3.** Prices, sheets, claims and accept/walk are
  computed in code (`agents/procudeal/policy.py`) in about 1 ms. The kit's LLM agent only writes a
  move when the engine raises an error; those moves carry an "LLM fallback" badge. The language
  models in the replay are mostly the supplier's (sales, finance, owner).
- **"Their price, our terms"** is the supplier's offer re-priced on the term mix we propose, so the
  two prices are comparable even when payment days or lead time differ.
- **Ceiling** is where a deal stops beating our alternative. An offer above it would score worse than
  walking away.
- **"Pushed after a final offer"** marks the v1.2 behaviour that made suppliers walk away
  (see `docs/decision-log.md` on main). v1.3 accepts on `final_offer` instead.
- **Verdicts:** `verified` means the supplier checked our figure against the data and it holds;
  `duplicate` means we had already used that fact; `irrelevant` means it does not bear on this
  supplier's cost. A `contradicted` claim costs trust.

## Files

`scripts/sync-runs.mjs`, `src/lib/runs.ts` (types; `buildSteps` joins each supplier move with its
back-office lines, our decision and our reply), `src/app/negotiations/`, `src/components/negotiation/`
(`RunView.tsx`, `PricePath.tsx`).
