# Arguments (phase 6)

**Route:** `/arguments`.
**Question it answers:** which arguments does our agent use, does the arena verify them, and does the
supplier's price move after them?

## Where the data comes from

No new snapshot: `src/lib/arguments.ts` reads `runs.json`. For every message our agent sent, it takes
the claims the arena read from it (`interpreted.claims`), the verdict on each from the supplier's reply
(`claim_results`), and the supplier's price before our message and in that reply. Claims in a message
the supplier never answered are listed as "no reply".

## Page

1. **Agent version** filter (default: the latest, engine v1.3; "all versions" for every run).
2. **By argument type**: how many were sent, the verdict mix (bar: green verified, red contradicted;
   counts of duplicate, irrelevant, no reply), the average change of the supplier's price in the
   reply, and in how many cases. Click a type to filter the list.
3. **Every argument**: case and round (links to the replay), supplier, type and the figure asserted,
   the IDs cited (each links to its page), the verdict, and the supplier's price before → after.
4. **How each argument is checked**: the table from `brief/api.md` (what to cite, what is checked,
   tolerance, the duplicate rule).

The price move belongs to the whole message (up to 3 arguments plus the term sheets) and to the
supplier's own reasoning, so it is a hint, not a measured effect of one argument.

## What it means (engine v1.3, 41 arguments)

- **Everything checks out.** No argument was contradicted: the figures come from code, not from
  the language model.
- **6 of 41 were wasted as duplicates.** Each ID counts once per case. In RFQ case P05 the agent cited
  the same index windows to a second and third bidder (3 duplicates); in P07 it cited forecast IDs
  (`fc:360011`, `fc:360012`, `fc:360030`) it had already used in that case (3 duplicates). A rival's
  quote is the exception (it counts once per supplier), and those were all verified.
- **Index falls come first**: 12 sent, with the largest average price move in reply (−7.2 %). They
  are mostly RFQ openings, where suppliers drop the most anyway.
- **The volume argument** (rising forecast) is the most widespread (8 cases) but comes with the
  smallest move (−0.8 %).

## Files

`src/lib/arguments.ts`, `src/app/arguments/page.tsx`, `src/components/arguments/Ledger.tsx`.
