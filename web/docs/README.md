# ProcuDeal web app: docs

A web app for people (team, jury) to see what our buyer agent sees, how it negotiated, and the data
behind every argument. **The agent never imports anything from `web/`**, and nothing here reads the
arena's live feed or leaderboard.

Every section has one page here: what it shows, where the data comes from, and what it means for
the negotiation. Update the page in the same commit as the code.

| Section | Route | Page | Status |
|---|---|---|---|
| Mail | `/mail` | [../README.md](../README.md) | done |
| Deals (negotiation replay) | `/negotiations` | [deals.md](deals.md) | done |
| Suppliers | `/suppliers` | [suppliers.md](suppliers.md) | done (phase 1) |
| Parts & Cost | `/parts` | [parts.md](parts.md) | done (phase 2) |
| Market (indices) | — | — | phase 3 |
| Contracts & Performance | — | — | phase 4 |
| Demand & Sourcing | — | — | phase 5 |
| Deal anatomy + Facts | — | — | phase 6 |

## Phase plan

1. **Suppliers**: who we negotiate with. Hub page that the others link into.
2. **Parts & Cost**: should-cost split vs price, price history, cost drivers.
3. **Market**: the 33 indices; check any claimed % change the way the arena checks it.
4. **Contracts & Performance**: clauses and notice periods, scorecards, quality notifications, PO → receipt → invoice.
5. **Demand & Sourcing**: forecasts (coverage), past RFQs and quotes, spend map.
6. **Deal anatomy**: one section per cost label (price, payment days, freight, quality, lead time,
   coverage, supplier health, index clause, tooling), the argument ledger, and a fact search over
   `data/facts.json`.

## Traceability: every data ID is a link

`src/lib/links.ts` (`hrefFor`) maps a data ID to the page that explains it. `DataId` in
`src/components/MailBody.tsx` renders the ID as a link when a page exists, everywhere in the app.

| ID | Opens |
|---|---|
| `sup:70110` | `/suppliers/70110` |
| `sc:70110@2026Q3` | `/suppliers/70110#scorecards` |
| `ctr:4600070110`, `ctr:4600070110#3.1` | the supplier's contract card |
| `part:310010` | `/parts/310010` |
| `cost:310010`, `cost:310012-70110` | that should-cost row on the part page |
| `doc:…`, `news:…` | that item in the supplier's timeline |

Later phases add `idx:`, `fc:` and the rest.

## Data snapshots

The app reads committed JSON snapshots, so it builds and deploys without keys.

| Command | Reads | Writes | Arena calls |
|---|---|---|---|
| `npm run sync` | arena (latest played session per case), `../data` | `src/data/inbox.json`, `public/inbox/` | read-only, no quota |
| `npm run sync:runs` | `runs/` on `origin/main` via git (`RUNS_DIR=../runs` for a local folder) | `src/data/runs.json` | none |
| `npm run sync:suppliers` | `../data` (CSV, correspondence) | `src/data/suppliers.json`, `src/data/links.json` | none |
| `npm run sync:parts` | `../data` (CSV) | `src/data/parts.json` | none |

After the **Sunday 08:00 data release**: `uv run arena data`, then `npm run sync:suppliers && npm run sync:parts`
(and later phases' syncs). After new benchmark runs on main: `git fetch origin && npm run sync:runs`.

## Run

```bash
cd web
npm install
npm run dev        # http://localhost:3000
npm run build      # static build, every case/run/supplier page prerendered
npm run lint
```

## Code layout

```
web/
  docs/                    these pages
  scripts/
    lib/package.mjs        CSV + correspondence readers for ../data (shared by the syncs)
    sync-inbox.mjs         Mail snapshot
    sync-runs.mjs          Deals snapshot
    sync-suppliers.mjs     Suppliers snapshot + ID link index
    sync-parts.mjs         Parts & Cost snapshot
  src/
    app/                   one folder per section (mail, negotiations, suppliers, parts)
    components/            AppRail (section list), MailBody/DataId, charts/, negotiation/, suppliers/, parts/
    data/                  committed snapshots
    lib/                   typed loaders: inbox.ts, runs.ts, suppliers.ts, parts.ts, links.ts, format.ts
```

Add a section: a route under `src/app/`, one entry in `SECTIONS` in `src/components/AppRail.tsx`,
and a page in this folder.
