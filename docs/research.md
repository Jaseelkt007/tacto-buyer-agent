# Zone 0: offline research (LLM knowledge base)

Status: **in progress** (engine v2.0 work). Nothing here changes a live move yet: zone 0 only writes
JSON files that later zones read.

## Why

The engine (v1.7b) decides everything with rules fitted to the 12 suppliers of the hosted practice
cases. The final has "new suppliers and settings" that "practice never shows". Before any session
opens we already hold almost all the information: the case file (at a wave's start) and the whole
data package (now; the Sunday release from 08:00). The engine reads a few regexes of it. Zone 0
reads **all of it, offline, with no time limit**, for every supplier in the package, and turns it
into a dossier that later zones use.

The four time zones of the LLM plan:

| Zone | When | Time | Input | Output |
|---|---|---|---|---|
| **0 offline** | before the final (tonight; again after the Sunday release) | unlimited | whole data package, our practice runs | dossier per supplier, argument library, arena playbook |
| 1 case | wave start, before opening the session | ~20-60 s per case, in parallel | case file + zone 0 | plan for this case |
| 2 opening | session open, first move | inside the 60 s window | + quote e-mails and PDFs | first e-mail |
| 3 rounds | each reply | 6-15 s, pipelined | + replies | move from a code menu |

## Hard rules (unchanged from the engine)

- **Code owns every number.** The LLM never writes a figure that is sent: argument sentences with
  figures come from the code-built argument library; the LLM picks argument IDs.
- Everything a model returns is validated: unknown IDs, fields or values are dropped.
- Dossiers are keyed by supplier and part (data), never by case.
- No reference to other teams' systems in prompts or files.

## Pipeline per supplier

```
evidence.py  (code)  every table row, letter, note, news item about the supplier and its parts, with IDs
library.py   (code)  every verifiable argument with its IDs and exact figure, written as the arena checks it
     │
     ▼
4 specialists (Opus 5.5, in parallel), each one slice of the evidence:
   economics      should-cost, cost drivers and index moves, price history, quotes
   persona        intel, letters, call / meeting notes, e-mails, news, how we pay it
   contract       contracts and clauses, past negotiations, sourcing, dependency
   performance    scorecards, quality notifications, deliveries, forecasts, order history
     │
     ▼
lead strategist (Opus 5.5): one dossier - who decides and what moves them, needs, constraints,
   levers (argument IDs, in order), trades worth offering, traps, tone, notes for the writer
     │
     ▼
red team: a supplier agent plays this supplier (its arguments, weak points, what it would trade);
   a buyer agent answers each argument without figures
     │
     ▼
validate (code) → knowledge/suppliers/<supplier>.json
```

Plus, once: **playbook.py** mines our practice runs (offers, counters, reasons, back office, scores)
into arena-wide behaviour lessons by persona and goal → `knowledge/playbook.json`.

## Interfaces (contract between the pieces)

`arena_kit/agents/procudeal/research/`:

| Module | Function | Returns |
|---|---|---|
| `evidence.py` | `supplier_evidence(pkg, sid)` | dict of sections, every row with its citable ID where one exists |
| | `part_evidence(pkg, part)` | dict for one part (drivers, should-cost, sourcing, quotes, forecasts) |
| | `render(evidence, sections)` | compact text for a prompt, one section per heading |
| `library.py` | `argument_library(pkg, sid)` | list of arguments `{arg_id, kind, part, refs, figures, sentence, checkable, side, note}` |
| `llm.py` | `ask(system, user, schema, effort)` | parsed JSON (Opus 5.5, streaming, structured output, refusal fallback, retries, disk cache, usage log) |
| `agents.py` | prompts and JSON schemas of the specialists, lead, red team, rebuttals | |
| `dossier.py` | `build(pkg, sid)` | the validated dossier |
| `playbook.py` | `practice_corpus(runs_dir)`, `build_playbook(corpus)` | per-run records; lessons |
| `scripts/research.py` | CLI: all suppliers (or a list), in parallel, resumable | files under `knowledge/` |

`side` of an argument: `for_us` (lowers its case) or `for_them` (an argument it can bring, e.g. a
cost driver that rose) - the red team and rebuttals need both.

## Files written

```
starter-kit/knowledge/
  suppliers/<sup_id>.json     dossier: evidence digest, arguments, specialists, strategy, red team, meta
  playbook.json               arena behaviour lessons from our practice runs
  index.json                  what was built, model, data version, token usage and cost
```

## Model and settings

Claude Opus 5.5 (`claude-opus-5-5`), adaptive thinking (always on for this model), structured JSON
output, streaming, server-side refusal fallback. **Effort `low` while we iterate** (`--effort` or
`RESEARCH_EFFORT`; `high` once the pipeline is final). Other providers come later for benchmarking
through the same `ask()` interface.

| Effort | 3-supplier pilot (parallel) | Per supplier | Cost per supplier | All 46 suppliers |
|---|---|---|---|---|
| high | 4 min 48 s | 4-5 min | about $1.6 | not run (estimated 45-50 min at 4 in parallel) |
| **low** | **1 min 38 s** | **about 95 s** | **about $0.75** | **11 min 4 s, $34.17, 299 calls (6 in parallel)** |

At low effort the dossiers keep the key findings (e.g. for the P01 supplier: the second part as a
bundle lever, the calendar-year clause and short notice, the supported +2.3 % against the asked
+9.5 %, stale costing, the cash need, the traps) with fewer levers and traps than at high.

Zone 0 runs **before** the final (tonight; again after the Sunday 08:00 release, about 11 minutes).
It never runs inside a wave: in the final the dossiers are files read in milliseconds. The final's
8-minute cap starts when a wave starts and covers zones 1-3 only.

## Status (25 Oct, 00:20)

- 46 dossiers in `knowledge/suppliers/` (effort low), `knowledge/playbook.json` (20 lessons, effort high).
- Transient API errors (overloaded / 500) are retried by the SDK; a supplier whose agent still failed
  keeps the error in `meta.errors` and is rebuilt with `--suppliers <id> --force` (answers that
  succeeded come from the cache).
