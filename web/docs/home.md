# Home and Story: step through a negotiation (phase 7)

**Routes:** `/` (Home: plays the latest run of P01), `/story/<session>` (the same player for any run).
**Question it answers:** what happened when our agent negotiated, chapter by chapter, and where do I go
to understand each part? The page to open first, and the demo for the jury.

## The player

- **Chapter strip**: every chapter as a numbered chip (visited chapters stay highlighted); click to jump.
- **Previous / Play / Next** buttons; Play advances every 7 seconds and stops at the end, then offers
  Replay. **← →** keys step, **space** plays or pauses.
- **Progress bar**, and `#step-N` in the URL, so a chapter can be linked or reloaded.
- **Run picker**: every saved run (by case, newest first, with version and score) opens its own story.
- **Go deeper**: each chapter ends with buttons into the tab that explains it; every data ID inside a
  chapter links to its page too.

## The chapters

Built by `buildStory(run)` in `src/lib/story.ts` from the snapshots; a chapter whose data is missing is
left out.

| # | Chapter | What it shows | Goes deeper into |
|---|---|---|---|
| 1 | The case opens | the trigger letter (excerpt, increase asked, effective date, notice) and the case file (goal, need, price today, alternative, suppliers, negotiable terms, must-haves) | Mail |
| 2 | The agent reads who it is dealing with | per supplier: what money is worth to it vs our 8 %, on-time delivery, how often we pay it late, price-change notice, and each cash / work / capacity signal with the phrase and document | Suppliers, Contracts |
| 3 | The agent checks what the part should cost | price against full cost (material / conversion / overhead), each cost driver with weight, 12-month change and a 36-month sparkline, the falls it can cite (each opens the Market checker on that window), market move vs increase asked | Parts & Cost, Market |
| 4 | How much we need, and the alternatives | call-offs and forecast bars, the citable `fc:` change, the coverage-trap table for this case's options, sources and latest quotes | Demand |
| 5 | The agent plans its opening | per supplier: their opening, their price on our terms, our ceiling and our anchor on one scale, the gap to close, engine or LLM fallback and its time, term sheets, arguments picked | Deals (replay) |
| 6… | Openings, Round 1, Round 2, … | the price path of every thread drawn up to that round; per supplier: offer and change, the verdict on each of our previous arguments, its stated reasons, its back-office messages, then our engine's decision (counter or accept, time, why) and the arguments it sends next | Deals, Arguments |
| last | The deal (or no deal), and the score | score with the opening → deal → best bar and the formula, the alternative, and the cost on top of the price | Deal anatomy, Deals |

RFQ cases show every supplier thread side by side in each round (P05: three bidders). Runs that end
badly show it: P02 on engine v1.2 ends in round 5 with the supplier walking away after we pushed past
its final offer.

## Data

No new snapshot: `inbox.json`, `runs.json`, `parts.json`, `suppliers.json`, `contracts.json`,
`demand.json`. The story is built on the server; the browser only receives the chapters of the run it
shows (the run logs themselves never reach the browser bundle). To change the run Home plays, change
`FEATURED` in `src/app/page.tsx`.

## Files

`src/lib/story.ts` (`buildStory`, `pathUpTo`, `storyRuns`), `src/components/story/StoryPlayer.tsx`,
`src/app/page.tsx`, `src/app/story/[id]/page.tsx`. Reuses `PricePath`, `CostStack`, `Sparkline`,
`DemandBars` and `DataId`.
