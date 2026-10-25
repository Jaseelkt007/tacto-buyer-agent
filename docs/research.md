# Zone 0: offline research (LLM knowledge base)

## Source-grounded pipeline (experimental)

`research.py --pipeline grounded` writes to `knowledge/grounded/`, leaving the legacy dossiers
available for comparison. Four specialists extract atomic observations from original records,
including company definitions and relevant letters. Each observation carries a literal excerpt,
part scope, source date, expiry (if known), and a fact/statement/hypothesis label. An independent
verifier checks each observation against the complete records. The lead can select observation
IDs but cannot invent new conclusions or choose terms before the case exists. Missing or rejected
support is retained in the build report, not silently promoted into the live packet.

`grounded_dossier` makes both hybrid consumers read only these artifacts, check their source
fingerprint, and filter part and expiry scope. Old strategy prose and rehearsals cannot enter this
path. Missing/stale artifacts yield no Z observations. The argument library retains exact claim
sentences but removes unconditional volume-value and below-cost assertions.

`measured_trades` bounds the hybrid's menu: a term change needs a matching supplier offer pair,
or the existing explicit-driver clause estimate. Unknown values are stated as unknown and are
not used to reduce prices. The packet includes delta C versus E0. Early acceptance remains with
the engine unless the supplier has agreed or declared its final offer. These flags remain off:
five paired hosted passes averaged 73.434 versus v1.9's 75.086. See the
[full comparison](../notes/analysis/zone0-v3/results.md). v1.9 remains the default.

All 46 supplier artifacts have been rebuilt and passed the loader checks: 1,237 supported
observations, 27 separate hypotheses, 81 verifier rejections and 68 source-validation drops.
These are model-assisted support judgments, not a guarantee that every interpretation is correct.
Both selected and unselected supported observations are available when their part/date scope matches.

From `starter-kit/`:

```bash
.venv/bin/python scripts/research.py --pipeline grounded --all --effort low --parallel 4
.venv/bin/python scripts/bench.py --agent procudeal --set practice --on tactician,grounded_dossier,measured_trades --no-model-cache
.venv/bin/python scripts/analyse_grounded_hybrid.py
```

Rebuild after downloading a new data release; source-content or prompt changes invalidate existing
artifacts. A failed build exits unsuccessfully and leaves the previous artifact intact; a stale
artifact is never silently reused by the grounded reader. A second build on the current snapshot
verified all 46 and made zero model calls. No data refresh is performed mid-experiment.

The sections below describe the **original pipeline**, retained behind `--pipeline legacy` for
comparison. Its playbook, lead prose and role-play are not inputs to the grounded pipeline.

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

# Zone 1: the case strategist (in progress)

At a wave's start the case files appear; no supplier clock runs until we open a session. Zone 1 uses
that window: one model call per case turns the case file plus the zone 0 dossiers into a **bounded
plan**, then the session opens and the v1.7c engine plays with the plan. Flag `case_plan` (off by
default until a hosted A/B shows a gain; `PROCUDEAL_ON=case_plan` switches it on).

```
case file (briefing, goal, must-haves, alternative, case facts, trigger letter, negotiable terms)
  + dossier of each supplier (strategy, levers and traps for the case's parts, red team, rebuttals)
  + playbook lessons for this goal and case type
     │  strategist.make_plan (one call, Opus 5.5 effort low while testing)
     ▼
plan per supplier: levers (library arg_ids, opening / later / if challenged), blocked arguments,
  trades (a negotiable field and an option index from term_options, opening / closing / if asked),
  stance (soft / normal / hard), opening paragraph (no figures), tone, what to watch for
     │  code validates every ID, field, option and sentence
     ▼
engine (policy.new_side) with the plan:
  claims   the plan's levers first, as the library's verified sentences; blocked ones removed
  anchor   stance soft +0.03 / hard -0.01 on the opening anchor only, never the term mix (a deeper hard
           anchor drew an earlier final offer in the sandbox RFQ)
  mix      an opening trade replaces the planned option if it keeps the must-haves and costs us no more:
           a contractual one (the contract already grants it) at the same price, any other one once the
           supplier prices it in (our C at each mix's equal-value price, within the tie band)
  e-mail 1 the opening paragraph after the greeting (dropped if it has a digit or a leak)
```

Nothing the model returns sets a price. A supplier without a dossier gets a case-only plan; no plan
(model off, error, timeout) means the engine plays exactly as v1.7c.

**Runner:** the kit's `play()` opens the session before the agent sees the case, so `bench.py` and
our final runner call `agent.prepare(case)` first. In the final the preparation time counts against the
wave's 8 minutes and is logged.
