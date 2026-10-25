# v1.9 negotiation demo

`/live` opens P01 from the original ten-case v1.9 suite. `/live/<session>` replays one of those
saved sessions. `/demo` redirects here. Historical live links open their original Deals page.

The monitor shows the actual buyer architecture: company records, a Python supplier dossier,
source-backed claims, package economics, decision policy, fixed email templates, and the external
supplier conversation. It contains no experimental research specialists or model writer.

The map also shows the latest [decision reviewer and exchange feedback](reviewer.md) as a dashed
offline branch. Its saved synthetic examples are separate from the original P-case replay.
Review observations do not control buyer actions or change the original case scores.

The benchmark strip covers the ten original hosted cases: 75.0863 mean points, ten valid deals,
50 engine decisions, and zero LLM decisions. Five later baseline passes reproduced the same mean.
The exception LLM fallback exists in the agent but was never triggered in this suite.

## Replay behavior

Play advances an illustrative stage sequence. Previous, Next, Reset, the slider, and the activity
log seek through it. Space toggles playback; Left/Right step; Home/End seek to the ends. Shortcuts
ignore form controls and links. Playback stops at completion. Case navigation starts a new replay.

Selecting an engine card pauses playback and opens its latest available evidence in the Inspector.
Future values and emails stay hidden until playback reaches them. The Conversation tab shows the
supplier and buyer messages recorded by the arena. P05 provides separate supplier threads and a
control to follow the active playback thread. Map values and Inspector details stay scoped to the
selected supplier. At completion, the winning thread shows its deal; other threads identify the
winning supplier and link to it.

The Reviewer tab is an independent evidence explorer. Its examples are explicitly labeled as
separate synthetic snapshots and can be read before playing the original negotiation.

Stage pacing is for presentation. Only total session runtime and the sum of recorded buyer decision
times are measured. Preparation is reconstructed; individual function timings are not available.
Initial dossiers are labeled as data-package estimates after the opening quote cap and before
observed quote-rate updates. A signal that was not detected is not proof of its absence.

## Data and reproduction

`src/data/v19.json` contains the canonical sessions, public messages, decision fields, initial
dossiers, and benchmark totals. It excludes supplier back-office information from buyer inputs.
The exporter runs the original dossier builder from Git commit `44dbff9`, rather than the current
working engine, so ongoing agent changes do not silently change the demo's architecture or estimates.
It records each original run's path, commit, and SHA-256 hash.

From `web/`, run:

```bash
npm run sync:v19
npm run check:v19
```

The exporter uses `starter-kit/.venv/bin/python`, the local data package, practice case files,
and saved runs. It makes no network, arena, or LLM requests. It rejects missing or duplicate cases,
non-engine decisions, model plans, timeouts, and unmatched decisions. It also preserves historical
archive entries while adding the ten canonical traces to `src/data/runs.json`. After a separate
`sync:runs` export, run `sync:v19` again to keep those archive links available.

## Implementation

- `scripts/sync-v19.py`: reproducible data export and integrity checks.
- `src/lib/v19.ts`: snapshot-derived types and a discriminated replay event model.
- `src/components/live/RunMonitor.tsx`: playback, map, conversation, and Inspector.
- `src/components/live/monitor.css`: responsive monitor layout.
- `src/app/globals.css`: fixed light white/gray site theme, including dark OS preferences.

The former research tabs and generic live pipeline player have been removed. The separate legacy
slide deck is no longer routed; `/demo` uses the canonical monitor.
