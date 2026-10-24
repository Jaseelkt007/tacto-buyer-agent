# ProcuDeal web app

Sections: **Mail** (below), **Deals** (negotiation replays), **Suppliers**, **Parts & Cost**, **Market**, **Contracts**, **Demand**. Full docs per section,
data sources and the phase plan: [docs/README.md](docs/README.md).

## Mail: what the buyer agent sees

A mail-client view of every practice and sandbox case at the moment it opens: the case file, the
trigger document (supplier letter, internal memo or our RFQ) and each supplier's opening quote with
its PDF. Next to each mail, **Agent view** shows the structured part the agent reads: the binding
term sheet, the fields left to the supplier's standard terms, the supplier's checkable claims,
signals, must-haves and what can be negotiated.

For people only. The agent never imports anything from here.

### Run

```bash
cd web
npm install
npm run sync     # snapshot from the arena (reads starter-kit/.env; uses no practice quota)
npm run dev      # http://localhost:3000, mail at /mail
```

`npm run sync` reads the latest session we already played for each hosted practice and sandbox case,
it never opens a new one. It writes `src/data/inbox.json` and the quote PDFs to `public/inbox/`. The
key stays in the sync script; the web app only reads the snapshot, so it builds and deploys without it.

Deep links open one mail, e.g. `/mail#case:P01/msg:70110-0-0` or `/mail#case:P05/case`. Arrow keys move
through the list.
