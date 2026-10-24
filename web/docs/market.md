# Market (phase 3)

**Route:** `/market` (all series), `/market/<series>` (one series, e.g. `/market/PPI-D351`).
**Question it answers:** do the market numbers back a supplier's price argument, which falls can we
cite back, and would the arena verify a given claim?

## Where the data comes from

`npm run sync:market` reads the data package in `../data` and writes `src/data/market.json` (76 KB).
No arena calls.

| Table | Used for |
|---|---|
| `index_series.csv` (33) | name, unit, source, frequency, licence, URL, formula for derived series, first and last month |
| `index_values.csv` (2,258) | every monthly value, 2021-01 to 2026-08/09 (sources publish with different lags) |
| `cost_drivers.csv` | the parts whose cost each series drives, with weight |
| `contract_clauses.csv` (type `index`) + `contracts.csv` | contracts that index a price to the series |

Joined in the app from the other snapshots: the claims made with each series in our runs
(`runs.json`), and the practice cases that offer an index clause with their expected index move
(`inbox.json`: `buyer.index_paths`, `term_options.index_clause`, `buyer.index_risk_pct`).

Families: Producer prices DE (16, Eurostat, index 2021 = 100), Labour cost (LCI-C, quarterly, carried
to each month of the quarter), Commodities (World Bank, USD), Exchange rates (ECB, units per euro: a
rise is a stronger euro), Power price (SMARD day-ahead), Derived notations (copper for cables and
motors, stainless alloy surcharges 1.4404 and 1.4301; index clauses use these).

## The arena's rule, in one place

`src/lib/indexRules.ts` holds the check from `brief/api.md` ("Data you cite is checked") as pure
functions, used by the server pages and the in-browser checker:

- two `idx:` IDs of one series, **at most 12 months apart**, the later one **within the last 12
  months of the data** (2025-10 or later; data as of 2026-09); otherwise the arena answers
  `irrelevant`;
- change = (later ÷ earlier − 1) × 100;
- a figure within **±0.5 percentage points** is `verified`; otherwise `contradicted`, which costs trust.

`extremeWindow` finds the largest fall (or rise) over 1–12 months that ends at the latest month,
the same search the agent's `claims.py` (`_index_falls`) runs; a fall of at least 0.5 % is what our
agent cites.

## Overview page

One card per series, grouped by family, each with a short note on what the family means: the last
36 months as a sparkline (shaded: the last 12), the latest value, the 12-month change, and badges for
how many parts it drives, contract clauses, claims made with it in our runs, and a **citable fall**
when there is one.

## Series page

1. **Tiles.** Latest value and its ID; last 12 months; largest fall to the latest month (what our agent
   cites); largest rise (what a supplier would cite); how many parts it drives.
2. **Check a claim** (`#explorer`). The whole series with a window set by two month pickers or presets
   (last 12 months, largest fall, largest rise). It shows the change, whether the arena accepts the
   window (blue shading) or calls it irrelevant (yellow, with the reason), and the sentence to cite,
   with the figure next to both IDs. **Check a figure**: type any claimed % and get the arena's verdict
   and how far off it is. Every `idx:` chip in the app opens this page with its month selected;
   `#idx:S@A..idx:S@B` selects a window.
3. **Claims made with this index in our runs.** Every index claim in the saved runs, merged across
   runs: who made it (supplier, or our agent to which supplier), window (click to load it into the
   checker), figure claimed, the data's figure, and the result. Ours carry the arena's verdict from
   the supplier's reply (verified / duplicate / irrelevant / contradicted); suppliers' are checked here
   (holds / off). Each links to the latest replay of that case.
4. **Parts whose cost it drives**, with share of cost and what the 12-month move did to that part's
   cost (weight × change).
5. **Index clauses.** Contract clauses on this series, and practice cases that offer one: the expected
   index move over the contract, and for each clause option (share, deadband) its cost as a share of
   spend by the brief's formula: share × max(0, |move| − deadband) × sign(move) + share × risk.
6. **About this series**: source, licence, formula, data URL, months.

## What it means

- **Electricity (`PPI-D351`)**: −3.7 % over 12 months, and **−6.1 % from 2025-11 to 2026-08**. That is
  the fall our agent cites; it sent it to Brandlhuber (P01), Dralveck (P05) and Kalwisz (P11), and the
  arena verified it every time. It drives 30 parts, mostly castings.
- **Suppliers cite the rises.** Brandlhuber's labour (+2.7 %) and steel (+6.5 %) figures hold, but it
  leaves out electricity. Checked against cost weights (see Parts & Cost), the true cost move is far
  smaller than the +9.5 % it asks.
- **Copper (`CU-NOTATION`)**: +47.7 % in 12 months. Nordmark (P02) and Selvbrunn (P03) cite it and they are
  right; there is no fall for us to cite. Their leverage is real, so the argument has to come from
  elsewhere (index clause terms, payment, volume).
- **Index clause in P02**: with copper expected +5 %, a 20 % share clause costs 1.80 % of spend with no
  deadband, 1.20 % with 3 %, 0.80 % with 5 %. A clause is only worth taking if the base price drops by
  more than that.

## Also in this phase

The supplier margin on the Parts & Cost pages now uses the arena's formula, (price − full cost) ÷
price (`brief/api.md`), instead of price ÷ full cost − 1. P01: −4.8 % instead of −4.6 %.

## Files

`scripts/sync-market.mjs`, `src/lib/indexRules.ts`, `src/lib/market.ts` (types, `claimsFor`,
`clauseCases`, `clauseCostPct`), `src/app/market/`, `src/components/market/IndexExplorer.tsx`.
