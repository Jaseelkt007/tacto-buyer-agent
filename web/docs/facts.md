# Facts (phase 6)

**Route:** `/facts` (`/facts#<text>` opens with that search).
**Question it answers:** is this ID citable, and which value will the arena check a claim against?

## Where the data comes from

`npm run sync:facts` copies `data/facts.json` (10,356 IDs) to `public/facts.json` (1.3 MB). The page
loads it in the browser only when opened, so no other page carries it.

| Type | Count | What the arena checks (brief/api.md) |
|---|---|---|
| `po:` | 5,400 | 2–8 order lines of the same part: the order prices |
| `idx:` | 2,258 | 2 IDs of one series, ≤ 12 months apart, ending in the last 12 months: the % change |
| `qn:` | 1,033 | with `sc:` rows, the mean ppm when the claim is about quality |
| `fc:` | 495 | the forecast change % |
| `sc:` | 414 | the mean on-time % (or mean ppm) |
| `ctr:` | 326 | with a letter `doc:`, the days of notice agreed |
| `doc:` | 208 | price letters: notice given, asked price; notes are context |
| `quote:` | 108 | its price, same part (only quotes the case cites) |
| `rfq:` | 47 | context |
| `news:` | 39 | that it is about this supplier |
| `cost:` | 28 | the unit cost estimate |

## Page

A search box (matches IDs and any value, e.g. a part number or a supplier name) and one chip per
type with its count; picking a type shows how the arena checks it. Results (first 100) show the ID
(linked to its page where the app has one), its type and every field the arena holds, with supplier
and part IDs linked.

## What it means

An ID that is not in this list comes back `contradicted` and costs trust. The agent only cites IDs
from this file, with figures computed by code (CLAUDE.md, "Claims"). This page is the place to check
by hand what a claim would be measured against.

## Files

`scripts/sync-facts.mjs`, `public/facts.json`, `src/app/facts/page.tsx`, `src/components/facts/FactSearch.tsx`.
