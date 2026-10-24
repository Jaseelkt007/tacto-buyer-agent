# Inside a run: live pipeline replay (phase 8)

**Routes:** `/live` (opens the latest released-engine run of P01), `/live/<session>` (any run).
Linked from the rail ("Live run"), from Home, and from every replay ("Watch it live →").
**Question it answers:** while our agent negotiates, which data does it read, which part of our code
computes each number, what does the arena check, and what does the supplier bot do, in what order and
on what clock?

## What you see

1. **Stats strip**: moves decided by code (and how many by the LLM fallback), our total thinking time
   against the 60-second budget per message, the session's measured wall time, rounds and suppliers,
   arguments verified of those sent, score.
2. **Controls**: supplier-count scenarios (1 = P01, 2 = D02, 3 · RFQ = P05; each the latest run of a
   released engine version, not a one-off experiment), a picker for any of the runs, Play / Pause,
   Restart, step back and forward, speed 1× / 2× / 5×; ← → keys and space. A status line shows the
   stage (session opens, prepare, round n, case closed), the step and the session clock `t`.
3. **The pipeline**, one box per part, coloured by what it is:
   - *Data package*: case file, quote PDFs, data tables, letters and news, facts and indices.
   - *Our code*: quote reader, dossier, claim bank, economics, policy (`decide()`), writer.
   - *Language model*: the kit's LLM agent, used only when the engine raises an error.
   - *Arena*: message routing and claim checks; the 60-second clock.
   - *Supplier bot*: sales (writes the replies) and back office (owner, finance, logistics …).
   - *Result*: score.
   The box working now glows; boxes that have run are marked "done"; the arrow that carries data
   in this step is animated.
4. **Detail panel**: click any box (or follow the live one): when it runs, what it reads, what it
   returns, how its output is checked, and its actual values in this run so far, by round (for
   example the dossier's cost of money and the letter behind a cash signal; the policy's counter
   price, their price on our terms, ceiling and anchor; the arena's verdict per argument). "Open the
   full page" goes to the tab that explains it.
5. **Timeline**: one row per part, bars appearing as the run plays, round boundaries marked, and a
   playhead at the current moment.
6. **Event log**: what just happened, newest first.

## Where the data comes from

`buildLive(run)` in `src/lib/live.ts` turns a saved run into frames, on the server, from `runs.json`
(trace, decision log, back office, result), `inbox.json` (case file) and `suppliers.json` (dossier,
contract). Each frame names the part that works, the part that handed it data, the round, a log line
and the values to show. The browser receives only the frames of the run on screen.

**Timing.** Our decision times are measured (the decision log's `seconds` per move). The session's
total wall time is measured too. The log keeps no timestamp per supplier reply, so the rest of the
session (the supplier thinking, the arena) is spread evenly over its replies; the page says so. Our
moves take milliseconds, so their bars are drawn at a minimum width.

## What it shows

- **No language model sets a number.** P01 on engine v1.7b: 3 of 3 moves by code, 43 ms of thinking in
  a 2.8-second session, 4 of 4 arguments verified, score 91. P05 (three-bidder RFQ): 12 moves by code
  in 64 ms over 274 seconds, 13 of 13 verified.
- **Where the time goes**: almost all of a session is the supplier: its back office (owner,
  sales, finance) deciding, then sales writing. Our side never comes near the 60-second rule.
- **What each part actually produced**, in order: from the case file and quote PDFs, through the
  dossier and claim bank, to each counter, each verdict, and the accept.

## Files

`src/lib/live.ts` (`buildLive`, frame and node types), `src/components/live/LivePipeline.tsx` (diagram,
controls, detail panel, timeline, log), `src/app/live/page.tsx` (redirect), `src/app/live/[id]/page.tsx`;
`.flow` and `.pulse-ring` animations and the `--s-model` colour in `src/app/globals.css` (both
animations stop under reduced motion).
