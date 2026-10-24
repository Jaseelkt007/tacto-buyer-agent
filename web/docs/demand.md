# Demand & Sourcing (phase 5)

**Route:** `/demand` (spend map and all parts), `/demand/<part number>` (one part, e.g. `/demand/340010`).
**Question it answers:** how much do we need, does a deal cover it, where else could we buy, and where
does the money go?

## Where the data comes from

`npm run sync:demand` reads the data package in `../data` and writes `src/data/demand.json` and
`src/data/demand-links.json` (which part an `fc:`, `rfq:` or `quote:` ID belongs to). No arena calls.

| Table / file | Used for |
|---|---|
| `forecasts.csv` (720) + `forecast_lines.csv` (8,640) | quarterly 12-month forecast snapshots per part since 2023-12, and the monthly split of the latest |
| `facts.json` (`fc:` entries) | the `change_pct` the arena checks for an `fc:` claim |
| `po_lines.csv` | what we called off per month (order quantity by requested month), open orders |
| `sourcing.csv` | source list: active / qualified suppliers, quota, tooling owner |
| `rfqs.csv` (47) + `quotes.csv` (108) | every RFQ with its quotes: price, lead time, Incoterm, payment, tooling, fields left out, remarks, award |
| `spend_cube.csv` + `suppliers.csv` | spend per fiscal year by category, supplier country and supplier |
| `inbox.json` (case files) | need, horizon, fallback price and risk, volume and contract-length options per case |

## What an fc: claim means

An `fc:<part>@<month>` claim states how far the 12-month forecast made in that month lies above
what we **called off** (ordered, by requested month) in the 12 months up to it. We worked this out
from the data and the sync checks it: for every snapshot that `facts.json` lists, our calculation
matches the arena's `change_pct`. Snapshots before 2024-09 have no fact, because the order history starts
2023-10. Example: `fc:310010@2026-09` = 8,150 forecast vs 7,400 called off = **+10.1 %**. The case
need per year is usually the latest forecast (P01 needs 8,150 casings).

Our agent cites a rising forecast as its volume argument (`claims.py`: "Our demand forecast for this
part has risen X %"). 54 of 60 parts have a rising latest forecast.

## Coverage

From `brief/api.md` ("Cost and score"), in `src/lib/demand.ts` (`coverage`):

```
years     = min(contract_months / 12, horizon)        a single order counts as 1
covered   = min(volume_per_year, need) × years
uncovered = need × horizon − covered                    bought later at fallback × (1 + fallback risk)
```

The page shows, per case, every volume × contract-length option and what its uncovered need costs on
top of buying those units at today's price. That is the **coverage trap**: a lower unit price on a
shorter or smaller contract can still cost more.

## Overview page

1. **Where the money goes**: spend in the latest fiscal year and its change, suppliers paid, the top-10
   share, the share with the 46 detailed suppliers; spend by category and by supplier country (with
   the change on the year before); the top 15 suppliers.
2. **Demand and sources per part**: latest forecast and called-off quantity, the change (the `fc:`
   figure), a sparkline of every forecast since 2023-12, sources (active / qualified; "single source"
   flagged), the latest RFQ and its cheapest quote against today's price, and cases. Sorted by
   forecast value in euros (forecast × price ÷ price unit). Search included.

## Part page

1. **Tiles**: forecast, called off, change with its `fc:` ID, open orders, sources, today's price and
   the price asked.
2. **What the data says**: the volume argument (or its absence), single or second source, how the
   latest rival quote compares with today's price, and the coverage trap in numbers.
3. **Demand** (`#forecast`): monthly call-offs for 24 months (solid bars) and the latest forecast
   for the next 12 (outlined), and every forecast snapshot with its called-off base, change and
   whether it is citable (each row is the target of its `fc:` ID).
4. **Coverage** (`#coverage`): per case, the volume × contract-length matrix: units uncovered and
   their extra cost, shaded by size; covered options marked.
5. **Source list**: suppliers, status, quota, approved since, tooling owner.
6. **RFQs and quotes** (`#rfqs`): every RFQ (newest first) and its quotes (cheapest first): price
   and the difference from today, lead time, Incoterm, payment, tooling, fields left out, remarks,
   award; quotes a practice case cites are marked. A past quote is checkable only in a case that cites it.

## What it means

- **The coverage trap is big where the options allow it.** P10 (seals): 16,379 a year on 12 months leaves
  30,421 units to buy at €46.70 instead of €29.89, **€511k** extra; P03 (frequency converter): up to
  €401k. P08 €42k, P07 €29k, P18 €11k, P04 €11k for a 12-month contract. Full volume for 24 months
  avoids all of it. No price cut in these cases is worth that.
- **Volume is our most common argument.** 54 of 60 latest forecasts are above last year's call-offs.
  P10's seal: +10.1 % (`fc:340010@2026-09`).
- **Few alternatives.** 21 parts have a single source and 5 none. P10's seal is single-sourced at
  Ravensteiner, so walking away is costly.
- **Second sources are not always cheaper.** P01: Kalwisz quoted €143.22 for the casing in September
  (`quote:7200001`), above today's €126.53 and Brandlhuber's ask of €138.55.
- **Spend**: €34.9 M in FY2026 (+3.6 %), 374 suppliers paid; the top 10 take 44 %, the 46 detailed
  suppliers 75 %. Electrical (€12.6 M) and castings (€6.7 M) dominate; 77 % of spend is with German
  suppliers.

## Links

`fc:`, `rfq:` and `quote:` IDs open the part's demand page at that row. The Parts & Cost page links
here ("demand and sourcing →") and back.

## Files

`scripts/sync-demand.mjs`, `src/lib/demand.ts` (`coverage`, `caseCoverage`), `src/app/demand/`,
`src/components/demand/DemandTable.tsx`, `src/components/charts/DemandBars.tsx`.
