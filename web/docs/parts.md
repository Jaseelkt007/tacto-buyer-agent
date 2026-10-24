# Parts & Cost (phase 2)

**Route:** `/parts` (list), `/parts/<number>` (one part, e.g. `/parts/310010`).
**Question it answers:** what should this part cost, what do we pay, and does the supplier's price
increase hold up against the market?

## Where the data comes from

`npm run sync:parts` reads the data package in `../data` and writes `src/data/parts.json`. No arena
calls. Every figure on the page is computed there, in code.

| Table | Used for |
|---|---|
| `parts.csv` (60) | material master: description, category, grade, weight, unit, price unit, pump series, ABC, standard price |
| `sourcing.csv` | suppliers per part: status (active / qualified), quota, tooling owner |
| `should_cost.csv` (28 rows, 26 parts) | full cost without margin, split into material / conversion / overhead, with its error band |
| `price_conditions.csv` | every price since 2023 per part and supplier, and why it changed (contract, renewal, index adjustment) |
| `negotiation_history.csv` | the event behind each price: what the supplier asked, what was settled, notes |
| `cost_drivers.csv` + `index_series.csv` + `index_values.csv` | which indices drive the part's cost, with what weight, and how they moved |
| `po_lines.csv` | what we ordered per fiscal year: quantity, spend, PO lines, lines at a stale price |
| `documents.csv` | letters and memos that name the part (asked %, asked price, effective date, notice) |

Prices are per `price_unit` (1, 100 or 1,000 pieces, kg or m) exactly as the ERP states them; the page
says "per 100 pc" etc. wherever it applies.

## Calculations, and where they come from

All of these mirror the agent's code on main (`agents/procudeal/dossier.py`, `claims.py` at c3f38a1),
so the page shows what the agent believes.

| Figure | How it is computed |
|---|---|
| **Full cost** per supplier | should-cost of the supplier's own plant if there is a row for it; else the German should-cost × country factor (AT 1.05, CH 1.1, CZ/PL/HU 0.82, TR 0.75, CN 0.7); else none |
| **Margin** | (price − full cost) ÷ price, the arena's supplier-margin formula (`brief/api.md`), taken at today's price. Negative = the supplier sells below its full cost |
| **Should-cost argument** | yes when full cost < 98 % of the current price (the agent's threshold) |
| **12-month change** of a driver | latest index value ÷ the value 12 months earlier − 1 |
| **Contribution** | driver weight × its 12-month change, in percentage points |
| **Drivers, 12 months** | sum of the contributions: how much the part's cost should have moved from the market |
| **Index-linked share** | sum of the driver weights (the rest of the cost follows no index) |
| **Agent can cite** | the largest fall over any window of 1–12 months ending at the series' latest month, if ≥ 0.5 % and the latest month is within 12 months of 2026-09: the `index_change` claim the agent sends |
| **Avg paid** | PO spend ÷ quantity, back in the part's price unit |

## List page

All 60 parts, sorted by what we bought in the latest fiscal year, with search and a category filter.
Columns: main supplier and today's price, full cost and margin (red when below cost), drivers' 12-month
move, the increase the latest letter asks for, spend, and the practice cases about the part.

## Part page

1. **Header and tiles.** Price today (main supplier), full cost, margin, drivers' 12-month move and
   index-linked share, the increase asked, what we bought this year.
2. **What the data says.** The findings in plain sentences, each with the ID that proves it: who asks
   how much from when; how much of that the market explains; which index falls the agent can cite;
   where the price sits against full cost; notes from past rounds.
3. **Price against cost** (`#should-cost`). Per supplier on the source list: price since when and why,
   full cost and how it was derived, whether the agent would argue should-cost, and a bar of full cost
   split into material / conversion / overhead with today's price marked (dashed = margin above cost;
   red text = shortfall below cost). Below it, every should-cost row with its error band; each row is
   the target of its `cost:` ID link.
4. **Price history** (`#price-history`). A step chart of each supplier's price since 2023, with the full
   cost (dashed) and the price now asked (dotted) as reference lines, and a table of every condition:
   validity, reason, price, change, asked → settled, note.
5. **Cost drivers** (`#drivers`). Each index: name and ID, share of cost, a 36-month sparkline (shaded:
   the window the agent would cite, else the last 12 months), 12-month change, contribution, and the
   claim the agent can make with the two `idx:` IDs it would cite. Footer: index-linked share and the
   weighted total.
6. **What we bought** per fiscal year, and **letters about this part** (each opens in its supplier's
   timeline).

## What it means: P01 as the example

Volute casing HN 50-200 (`part:310010`), Gießerei Brandlhuber:

- Brandlhuber asks **+9.5 %** (to €138.55 from 2026-11-01, `doc:20260911-70110-P01`).
- 64 % of the casing's cost follows indices; over 12 months they moved it **+2.3 %** (labour +2.7 %
  at 32 %, steel +6.5 % at 26 %, electricity −3.7 % at 6 %). So **7.2 points of the ask are not
  explained by the market.** Brandlhuber's opening quote cites the two indices that rose and leaves out
  the one that fell.
- The agent can cite electricity **−6.1 %** (`idx:PPI-D351@2025-11` → `idx:PPI-D351@2026-08`). That is
  exactly the claim it sent in the P01 replay, and the supplier verified it.
- Today's €126.53 is €6.11 below Brandlhuber's full cost (margin **−4.8 %**) of €132.64 (`cost:310010`), and every
  past round is noted "accepted below full cost to keep the volume". So the agent does **not** argue
  should-cost here. Squeezing further hurts a supplier we depend on, which the score charges for in
  stabilise cases. This is why the deal settled near cost (€130.90) rather than at the anchor.

## Links

`part:` IDs open `/parts/<number>`; `cost:` IDs open the part at that should-cost row
(`cost:310012-70110` → `/parts/310012#cost:310012-70110`). `idx:` IDs will link to the Market section
in phase 3.

## Files

`scripts/sync-parts.mjs`, `src/lib/parts.ts`, `src/app/parts/`, `src/components/parts/PartTable.tsx`,
`src/components/parts/CostBits.tsx` (cost stack, sparkline), `src/components/charts/PriceHistory.tsx`
(multi-supplier step chart with reference lines and hover).
