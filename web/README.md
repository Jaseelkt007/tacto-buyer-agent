# ProcuDeal web app

The homepage and **Demo** present the original v1.9 engine and its ten hosted cases (75.09 mean).
`/live` opens the recorded P01 negotiation; `/demo` opens the same monitor. The site uses a fixed
white/gray theme. **Deals** retains historical versions, while **Mail**, **Suppliers**, **Parts & Cost**,
**Market**, **Contracts**, **Demand**, **Arguments**, and **Facts** expose the supporting data.

Rebuild and validate the v1.9 snapshot with `npm run sync:v19` and `npm run check:v19`.
See [demo documentation](docs/live.md) for provenance and replay behavior.

The demo also exposes the latest offline decision-review model and public exchange feedback.
See [reviewer documentation](docs/reviewer.md) for its saved examples, authority, and data export.

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
