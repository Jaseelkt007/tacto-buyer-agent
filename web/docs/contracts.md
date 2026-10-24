# Contracts & Performance (phase 4)

**Route:** `/contracts` (all 46 contracts), `/contracts/<number>` (one contract, e.g. `/contracts/4600070110`).
**Question it answers:** what did each supplier sign up to, how does it actually perform, and how do
**we** behave as a customer?

## Where the data comes from

`npm run sync:contracts` reads the data package in `../data` and writes `src/data/contracts.json` and
`src/data/qn-links.json` (which contract a `qn:` ID belongs to). No arena calls. All figures are
computed there from the raw rows.

| Table / file | Used for |
|---|---|
| `contracts.csv` (46) + `contracts/*.md` | the framework agreements: validity, payment, Incoterm, price basis, parts covered |
| `contract_clauses.csv` (280) | every clause: scope, price (notice days), index, payment, delivery, quality, term (notice days) |
| `po_lines.csv` (5,400) | requested and first confirmed dates, rush/changed orders, open orders, stale prices |
| `goods_receipts.csv` (5,580) | when each delivery was posted |
| `quality_notifications.csv` (1,033) | complaints: defect, quantity, supplier-caused, recharge, 8D dates |
| `invoices.csv` (5,578) | due date vs paid date, cash discounts taken |
| `suppliers.csv` | the agreed cash discount (percent and days) |
| `scorecards.csv` | latest scorecard, for colour and the citable `sc:` ID |

## Calculations

| Figure | How |
|---|---|
| **Act by** (termination deadline) | `valid_to` − the term clause's days of notice. After it, the contract renews for 12 months |
| **Price-change deadline** | 31 Dec − the price clause's days of notice: the last day a supplier could announce a 2027 price change |
| **On time** | a goods receipt posted from 5 days before to 2 days after its order line's requested date (`data/SCORECARD.md`); partial deliveries count separately. Also against the first confirmed date |
| **Last 12 months** | 2025-10-01 to 2026-09-30 (fiscal year 2026) |
| **Complaints** | supplier-caused quality notifications; recharge at the €150 flat fee |
| **8D overdue** | supplier-caused, no closed 8D, older than 60 days at 2026-09-30 |
| **We pay late** | paid date − due date per invoice; average and share late |
| **Discount taken late** | a cash discount taken although paid after the agreed discount days; € = invoiced − paid |

Check: the computed 12-month on-time rate equals the latest scorecard's `otd_pct` for every supplier
(e.g. Brandlhuber 85.2 %, Tarsevi 52 %), so the method matches the scorecard's.

## List page

Three tiles: contracts whose notice deadline has passed or falls within 30 days, suppliers below the
95 % on-time target, and how late we pay on average. A table of all 46 contracts, sortable by
deadline, worst delivery, most complaints or latest payment, with search. Columns: act-by date
(red when within 30 days or passed), terms, on-time % with scorecard colour, complaints and 8D
overdue, how late we pay and late cash discounts.

## Contract page

1. **Header**: contract and supplier IDs, validity, price basis, parts covered (each links to Parts & Cost).
2. **Tiles**: act by, on time, scorecard, complaints, how late we pay, terms.
3. **What the record says**: deadlines, the price-change notice rule, delivery (with the `sc:` ID
   to cite when it is below target), complaints and overdue 8Ds, our late payments, late discounts.
4. **Clauses** (`#clause-<n>`): the contract clause by clause, each with its `ctr:…#n` ID; notes where
   it departs from company policy (shorter than 60 days net, not DAP). Index clauses link to the
   series in Market.
5. **Delivery** (`#delivery`): on-time % per month for 24 months against the 95 % target, and how
   late the last 12 months' receipts were (early / on time / 3–7 / 8–14 / 15–30 / > 30 days), plus
   order counts.
6. **Quality** (`#quality`): defects by type, 8D statistics, and the 12 most recent notifications
   (each row is the target of its `qn:` ID).
7. **Our payments** (`#payment`): how late we paid in the last 12 months, unpaid invoices, cash
   discount use.
8. **By fiscal year**: invoiced amount, share paid late, average days late, complaints, recharges.

## What it means

- **Deadlines are now.** 9 contracts can only be left or renegotiated if notice is given by
  **2026-10-02**, two days after the data date. Gleitring-Systeme Kaltenbrunn (`ctr:4600070420`, 180
  days) passed its deadline on 2026-07-04 and will renew.
- **Price letters against the contract.** Fixed-per-year contracts need price-change notice by
  2026-10-02 (90 days). Brandlhuber's letter of 2026-09-11 gave 51 days; the arena checks a letter's
  notice against the contract clause (`doc:` + `ctr:…#3.1`), and our agent cited exactly that.
- **Almost nobody delivers on time.** 43 of 46 suppliers are below the 95 % target; Tarsevi Döküm (52 %),
  Oberflächentechnik Weißacher (53.8 %) and CNC-Technik Obermaier & Huber (56 %) are the worst. Their
  `sc:` scorecards are citable.
- **We pay late, too.** On average 3.9 days after the due date. Motorenwerk Saalach waits **20 days**
  and was paid late on every invoice in the last 12 months; Drehzentrum Ilzauer, Drehteile Fuchsreiter and
  Feinmechanik Rottaler about 10 days. Brandlhuber: 85 % of invoices late, which explains its "pay
  our invoices" e-mail. A supplier that waits for its money values faster payment highly, so paying
  on time is a cheap concession for us.
- **Discounts taken late.** Four suppliers: Zerspanung Dralveck (11 times), Präzisionsteile Lindlbauer
  and Wälzhammer Präzision (7 each, Wälzhammer €2,085), Oberflächentechnik Weißacher (2). They can
  claim that money back.

## Links

`ctr:4600070110` opens the contract; `ctr:4600070110#3.1` opens it at § 3.1. `qn:` IDs open the
contract at that notification. The supplier page's contract card links here.

## Files

`scripts/sync-contracts.mjs`, `src/lib/contracts.ts`, `src/app/contracts/`,
`src/components/contracts/ContractTable.tsx`; `TrendLine` reused for the monthly on-time chart.
