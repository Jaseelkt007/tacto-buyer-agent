# LLM layer: to-do and progress

Plan and design: `docs/research.md` (zone 0) - zones 1-3 follow. Status: `[ ]` open, `[~]` in progress,
`[x]` done. Owner: `main` = the main session, `sub-A` / `sub-B` = Claude Code sub-agents.

## Zone 0: offline research (Claude Opus 5.5, no time limit)

| # | Task | Owner | Status |
|---|---|---|---|
| 0.1 | Design note `docs/research.md` (pipeline, interfaces, files) | main | [x] |
| 0.2 | `research/evidence.py`: every table, letter, note, news item per supplier and part, with IDs; Sunday release via the ID index | sub-A | [x] |
| 0.3 | `research/library.py`: all verifiable arguments per supplier x part, figures from facts, arena check semantics; `for_us` and `for_them` - 2,713 arguments over 46 suppliers | sub-A | [x] |
| 0.4 | Tests for evidence and library (P01 supplier as the reference: contract 3.1, notes, price history) - 10 tests, independent re-check of every figure | sub-A | [x] |
| 0.5 | `research/llm.py`: Opus 5.5 client (streaming, JSON schema, refusal fallback, retries, disk cache, usage + cost log) - live smoke test OK | main | [x] |
| 0.6 | `research/agents.py`: prompts + schemas (4 specialists, lead, red-team supplier, buyer rebuttals) | main | [x] |
| 0.7 | `research/dossier.py`: orchestration per supplier + validation of every returned ID / field - playbook lessons fed to lead + rebuttals | main | [x] |
| 0.8 | `research/playbook.py` corpus: one compact record per practice run (paths, reasons, back office, score) - 142 runs, 87 unique, 10 tests | sub-B | [x] |
| 0.9 | Playbook synthesis `research/lessons.py`: per-case debriefs -> general lessons by goal / case type / traits (Opus 5.5) - 20 lessons, 19 reply patterns, $1.98 | main | [x] |
| 0.10 | `scripts/research.py` CLI: all suppliers, parallel, resumable, `--playbook`; `knowledge/index.json` | main | [x] |
| 0.11 | Pilot on 3 suppliers (sup:70110 P01, sup:70510 P02, sup:70295 unseen), read the dossiers, fix prompts - validator fixed (arg IDs + EV- events + package IDs accepted) | main | [x] |
| 0.12 | Full run on all 46 suppliers + playbook; cost and token report - effort low: 11 min, $34.17 (+$0.76 rebuild of sup:70410) | main | [x] |
| 0.13 | Human review of the dossiers of the 24 suppliers no practice case uses | user | [ ] |
| 0.14 | Rebuild after the Sunday release (08:00) | main | [ ] |
| 0.15 | Docs: implementation.md, decision-log entry; commit | main | [x] |

## Zones 1-3 (planned, not started)

| # | Task | Status |
|---|---|---|
| 1.1 | `agent.prepare(case)` before opening: done in bench.py; final runner (play_waves with prepare) still to write | [~] |
| 1.2 | Case strategist (`strategist.py`) + bridge (`policy.plan_mix/plan_bank`, stance, paragraph), flag `case_plan`; 5 tests | [x] |
| 2.1 | Opening adapter: quote e-mails + plan -> first e-mail (paragraph + code claims + code sheet) | [ ] |
| 3.1 | Pipelined per-reply reader / tactician / writer choosing from a code menu; v1.7b fallback | [ ] |
| T.1 | Test inputs: 9 non-hosted practice case files; LLM-supplier gym; wave-cap emulation in bench | [ ] |
| T.2 | Hosted A/B: v1.7b vs LLM layers, 2-3 repeats per arm | [ ] |

## Sunday plan (details: `docs/findings.md` section 9)

| # | Task | Status |
|---|---|---|
| H1.1 | Health price refresh when the full-cost estimate changes - flag `health_refresh` | [x] |
| H1.2 | Rule audit vs the arena (`scripts/audit.py`): maths, rate, full cost, pricing of other terms, signals, hidden options, arguments; verdicts in findings.md section 10 | [x] |
| H1.4 | Verdicts as methods: `measured_rate`, `quote_cap` (fixes C_open); per-claim verdict + stock lines go to the packet (H2.1); duplicates already gone since v1.7 | [x] |
| H1.3 | `economics.menu`: every allowed mix priced (cash-equal, health + range); P02 menu holds clause db5 @ 361.82 -> 0.734 if accepted | [x] |
| H2.1 | `context.py`: labelled packet per thread from every module (A / D / E / S, no R) | [ ] |
| H2.2 | Review the P02 packet with the user | [ ] |
| H2.3 | `tactician.py`: prompt + schema of the one judgment call (action, option + rung, claim IDs, body, reason); code validates | [ ] |
| H2.4 | Offline replay: P02 recorded states, then P08, P18, P10, P01, P03; local score vs v1.7c | [ ] |
| H2.5 | Latency per model on the same packets (p95 < 25 s) | [ ] |
| H3.1 | Live loop behind flag `tactician`; v1.7c move computed first, sent on invalid / late; single-supplier first | [ ] |
| H3.2 | Free end-to-end: D01, D02, arena-sim | [ ] |
| H3.3 | RFQ scheduler: per-thread deadlines, parallel calls, send order | [ ] |
| H3.4 | Hosted only after H2.4 + H3.2 pass: P02 once -> touched cases -> full set | [ ] |
| H4 | 08:00 data release; final runner; rehearsal; commit by 12:45 | [ ] |

## Log

- Sun 02:59: v1.8 fixes (flags off) + menu + scripts/replay.py. Replay: same moves as v1.7c in 10 cases; P02 menu holds the winning clause option; choosing it is phase 2's job.

- Sat 24 Oct, evening: zone 0 started (Opus 5.5 for the offline part, no timing limits for benchmarking).
- Model client smoke test: Opus 5.5 with JSON schema + server-side refusal fallback, 3 s, $0.002.
- Sub-agents: sub-A builds evidence + library + tests; sub-B builds the practice corpus + tests.
- sub-B done: corpus of 142 runs (134 procudeal, 4 llm, 4 naive), 87 unique; 47 selected (4 per case). Found: 13 old engine errors (fixed since), 29 buyer timeouts in traces, 0 contradicted claims.
- Playbook build started (12 case debriefs + synthesis, Opus 5.5 high).
- sub-A done: evidence (14 supplier + 9 part sections; 31k chars for sup:70110), argument library (2,713 items, 9 checkable kinds, 18 context kinds), 10 tests; full suite 96 passed.
- Playbook built: 20 lessons, 19 reply patterns (knowledge/playbook.json). Quick wins for the v1.7b fallback engine it suggests: drop the call-note lever (meeting notes without data bring proof requests), switch patience off (token steps led to higher finals).
- Pilot started: 3 suppliers.
- Pilot: 3 dossiers, ~3-4 min each, about $1.6 per supplier (7 Opus calls). Brandlhuber dossier covers all hand-found P01 facts plus the second part (310012) as bundle leverage, the same-price quote 8 days before the letter, the renewal exit date, and a trap list. Validator fix cut drops from 58/28/31 to 1 real one.
- Full run started: all 46 suppliers, parallel 4.
- User decision: effort LOW for zone 0 while iterating (high was 3x slower). High-effort run stopped after 9 dossiers.
- Low pilot: 3 suppliers 1 min 38 s, ~$1/supplier. Full low run: 46 dossiers in 11 min 4 s, $34.17, 299 calls; sup:70410 rebuilt after 2 API errors (overloaded/500), $0.76.
- Committed and pushed 2168e02: zone 0 + engine v1.7c (patience and call-note lever off by default; PROCUDEAL_ON). Sandbox v1.7c: D01 0.883, D02 0.534.
- Zone 1: strategist dry run on all 19 practice case files: 18-31 s per case at Opus low, ~$0.10/case, all plans valid; paragraphs now 22/22 (sentence-level filter; no digits in product names).
- Bridge fixes from the dry run: priced trades must hold at the supplier's equal-value price (P10 lead 42 was refused, P11 chargeback refused); contractual trades (P01 2027-01-01) adopted at the same price; P01 should-cost trap blocked.
- Sandbox with plan: D01 0.878 / D02 0.482 with stance hard -0.03 (D02 supplier finalled earlier); stance now anchor-only and hard -0.01: D01 0.876, D02 0.513 (baseline 0.883 / 0.534; demo suppliers have no dossier).
- Hosted A/B started: v1.7c vs v1.7c + case_plan (10 + 10 sessions).
- Hosted A/B: v1.7c 72.7 (best so far); v1.7c + case plan 66.3 (P02 walk-away, soft stance and paragraph hurt). Plan narrowed to facts; P02 deep dive: see docs/findings.md.
- docs/findings.md written: all findings + requirements for the hybrid architecture.
