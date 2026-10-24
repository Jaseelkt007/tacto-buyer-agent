# Pipeline demo (`/demo`)

A full-screen deck that explains how our engine negotiates one case, for the demo and for our own
analysis. Everything shown about the engine is read from the **code**, not from `docs/`. It covers
the section rail on purpose and follows the arena site's look: a white top bar with the chapters as
monospace caps tabs (orange underline on the current one), one centred column on light grey, flat
white cards with hairline borders, monospace caps labels over light large figures, orange-edged
callouts. Inter for text, Geist Mono for labels and code. Chart colours stay by role (buyer blue,
supplier orange, arena teal, LLM violet). ← → move between chapters.

| # | Chapter | What it answers | Data |
|---|---|---|---|
| 1 | The whole pipeline | The 14 steps from session open to accept/walk, who runs each (code, template, arena, LLM) | `code.json` stages |
| 2 | Who we negotiate with | All 447 suppliers as a dot matrix; the 46 with a dossier and how the engine prices their cost of money | `suppliers.json` |
| 3 | What happens on every move | `Negotiator.decide()` branch by branch, readiness, the pricing formula, all constants | `code.json` decide_flow, ready_flow, pricing, constants |
| 4 | Model calls and prompts | 0 model calls on the engine path; the 1-call LLM fallback, its verbatim prompt, and every run where it fired | `code.json` llm, email_template; `stats.json` moves |
| 5 | Arguments and reading replies | Claim types with their sentence templates and the arena's verdicts; the regexes that read replies | `code.json` claims, signals; `stats.json` claims |
| 6 | Replay a negotiation | Four recorded sessions step by step: price corridor, every e-mail, our logged reason per move | `showcase.json` |
| 7 | RFQ with several suppliers | P05 as swimlanes, the RFQ rules in order, four scenarios | `showcase.json`, `code.json` rfq |
| 8 | Why negotiations stop | How every recorded run ended, messages per session, every case across versions, all 22 exits in code | `stats.json`, `code.json` stop_reasons |
| 9 | What to fix next | The code review's issues by severity, each with its line | `code.json` issues |

## Data and how to refresh it

```bash
cd web
npm run sync:demo   # runs/ + data package -> src/data/demo/{showcase,stats,suppliers}.json (no arena calls)
npm run sync:code   # engine source -> src/data/demo/code.json (stops if a cited line moved)
```

- `sync:demo` reads `runs/` from the local folder (`RUNS_DIR` overrides). It picks the showcase
  sessions (latest P05 RFQ, a strong single-supplier run, a supplier walk-out, a buyer walk-away with
  an LLM fallback) and joins our decision log to each buyer move.
- `sync:code` pulls verbatim strings (the fallback `SYSTEM` prompt, regexes, claim and e-mail
  templates) from the source and checks every cited `file:line`. The prose is written in the
  script; when the engine changes, a failed check names the part to re-read.

## Notes

- `next.config.ts` sends every `*.css` through the Tailwind loader, so CSS modules get no class
  names. The deck uses a plain stylesheet (`src/components/demo/demo.css`) with every selector under
  `.pd-demo`, imported by the page only.
- "Messages per session" counts our messages across all threads (the run file's `session.rounds`),
  so RFQ sessions can exceed the 10-per-thread limit.
