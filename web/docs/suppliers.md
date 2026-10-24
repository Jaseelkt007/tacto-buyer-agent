# Suppliers (phase 1)

**Route:** `/suppliers` (list), `/suppliers/<number>` (one supplier, e.g. `/suppliers/70110`).
**Question it answers:** who is our agent negotiating with, and what does the data say about them
that can move the price?

## Where the data comes from

`npm run sync:suppliers` reads the data package in `../data` (as of 2026-09-30) and writes
`src/data/suppliers.json` and `src/data/links.json`. No arena calls.

| Table / file | Used for |
|---|---|
| `suppliers.csv` (447) | vendor master: country, category, payment days, cash discount, Incoterm, lead time, ABC class, contract |
| `supplier_intel.csv` (46) | register facts: founded, owner type, staff, turnover, equity ratio, credit index now and 12 months ago, VDA 6.3, certificates |
| `spend_cube.csv` | spend and invoice count per fiscal year (October–September) |
| `sourcing.csv` + `parts.csv` | parts they supply: status, quota, approved since, tooling owner |
| `contracts.csv` | framework contract: validity, notice days for price changes, price basis |
| `scorecards.csv` | rolling 12-month on-time %, ppm, complaints, 8D overdue, score and class per quarter |
| `documents.csv` + `correspondence/*.md` | letters, e-mails, our meeting and call notes, with full text |
| `news.csv` | press items |

Only 46 suppliers are detailed; the other 401 exist only in the vendor master and spend cube, so
their pages show terms and spend only. `sup:71999` is the old record of `sup:70210` (data
`KNOWN_ISSUES.md` #5); both pages say so.

## List page

The 46 detailed suppliers by default (toggle to all 447), sorted by latest-year spend, with search and
a category filter. Columns: spend, latest scorecard (colour dot + score), credit index with its 12-month
change (**higher is worse**: the downgraded supplier in the news went 248 → 343), signals, and the
practice cases the supplier is in.

## Supplier page

1. **Header.** Name, ID, country, category, ABC class; links to the cases it is in (opens Mail) and the
   latest replay of each (opens Deals).
2. **Tiles.** Spend (vs previous year), scorecard, on-time delivery (target 95 %), defects in ppm,
   credit index, equity ratio.
3. **What our agent reads into this supplier.** The same logic as the agent's dossier
   (`starter-kit/arena_kit/agents/procudeal/dossier.py` on main):
   - **What money is worth to them** = owner-type rate (group 5 %, private 7 %, family 7.5 %,
     founder 10 %) + 5 points when its letters or news show a cash need. Our cost of capital is 8 %.
     Above that, paying earlier is worth more to them than it costs us, so the agent can trade
     shorter payment terms for price.
   - **Needs cash / Looks for work / Capacity full**: regex signals over its letters and news. Each
     one lists the document ID and the exact phrase that triggered it, linked to the timeline.
4. **Company** and **Terms and contract** (links to the full contract page in Contracts). Vendor master terms are what closes any field a deal
   leaves open, so they matter for total cost. Notes flag terms that differ from our policy
   (60 days net, DAP). The contract card shows the notice period for price changes.
5. **Spend with us** per fiscal year, and **Parts they supply** (source list).
6. **Scorecards.** On-time % against the 95 % target and ppm over time (hover for values), plus one
   chip per quarter with score and class (A green ≥ 85, B amber 70–85, C red < 70; method in
   `data/SCORECARD.md`).
7. **Letters, notes and news.** One timeline, newest first, each item expandable to its full text.
   Price letters show what they ask (+ %, € price, effective date, days of notice). When the notice is
   shorter than the contract requires, a red chip says so and links to the contract.

## What it means: P01 as the example

Gießerei Brandlhuber (`sup:70110`) asks +9.5 % from 1 November. Its page shows the three facts our
agent used to get the price down (P01 v1.3 scored 94):

- **It needs cash.** Its e-mail `doc:20260902-70110-M2` mentions "pay our invoices" and "cash
  discount", so money is worth 12.5 % a year to it against our 8 %. Our agent offered 14-day payment
  in exchange for price.
- **Its notice is too short.** The letter `doc:20260911-70110-P01` gives 51 days; contract
  `ctr:4600070110` needs 90.
- **Its delivery has slipped.** On-time 85.2 % against a 95 % target, latest scorecard class B.

## Keep in step

The signal regexes and owner rates in `scripts/sync-suppliers.mjs` copy `dossier.py` at commit
c3f38a1. If the agent's dossier changes, change them too, or this page will disagree with what
the agent actually believes.

## Files

`scripts/lib/package.mjs`, `scripts/sync-suppliers.mjs`, `src/lib/suppliers.ts`, `src/lib/links.ts`,
`src/app/suppliers/`, `src/components/suppliers/SupplierTable.tsx`, `src/components/charts/TrendLine.tsx`
(reusable single-series trend chart with target line and hover).
