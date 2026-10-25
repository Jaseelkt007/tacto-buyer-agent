# Deal anatomy (phase 6)

**Route:** `/negotiations/<session>/anatomy`, opened from every replay ("Deal anatomy: every cost
term, worked out →").
**Question it answers:** how exactly did this deal turn into its total cost and its score, and what
was each lever worth?

## Where the data comes from

No new snapshot. It joins the run (`runs.json`: closing terms, `c_open`, `c_deal`, `c_best`,
`c_alt`, the arena's `cost_breakdown`) with the case file (`inbox.json`: need, horizon, rates,
fixed terms, term options). `src/lib/anatomy.ts` is a line-by-line TypeScript port of the kit's
`cost_breakdown` (`starter-kit/arena_kit/cost.py`), the formula in `brief/api.md` "Cost and score".

The **supplier-health** term needs the supplier's own full cost and cash rates, which the arena keeps
to itself. The page takes that one figure from the run and inverts it:
soft(g) = g²/10 for g ≤ 5, g − 2.5 beyond, so g = √(10·s) or s + 2.5 with s = charge ÷ (€ per point ×
years). That gives how many margin points below a sustainable margin the deal left the supplier.

**Check:** for all 134 runs that ended in a deal (142 runs synced on 2026-10-24, engine v1 to v1.7b),
every recomputed term matches the arena's breakdown within €1. The page flags any term that does not.

## Page

1. **The score**: (C_open − C_deal) ÷ (C_open − C_best) with this run's numbers, the alternative, and
   what one euro of C is worth in score points.
2. **Where the deal's total cost comes from**: every term (price, uncovered need, fallback risk,
   payment terms, freight, late delivery, quality, tooling, index clause, index risk, supplier
   health) with its general formula, the same formula with this deal's numbers in it, the € amount,
   and a ✓ where it matches the arena. Footer: C of the deal, ours and the arena's. Below: horizon
   years, committed and covered units, units bought at today's price before the new price applies.
3. **The closing terms and where each came from**: negotiated (our accepted sheet), fixed by the
   case, or the supplier's standard terms from its quote PDF (anything the sheet left out).
4. **What each lever was worth**: for every negotiable term with options (payment days, contract
   length, volume, lead time, Incoterm, index clause, …), C with that term set to each option and
   everything else as closed, the difference from the deal, and ★ on the cheapest. Buyer's side
   only: the supplier prices each option too, so the cheapest for us is not always reachable.

Runs without a deal show the score line and say that no deal scores the alternative.

## What it means: examples

- **P01 (v1.3, 94)**: 8,150 casings × €130.90 = €1,066,835. Payment at 14 days instead of our
  reference 60 costs €10,905 in interest; FCA freight €15,485; quality €1,584; supplier health
  €5,708: Brandlhuber is left a few points below a sustainable margin, which the score charges
  because the goal is "stabilise".
- **P03 (v1.3, 92)**: 90-day payment earns −€26,390 against the 60-day reference; full volume (4,580)
  and 24 months cover the need. A 12-month contract would have cost €257,880 more; 3,664 a year
  €103,152 more. Supplier health €965 ≈ 0.4 points below an 8 % margin.

## Files

`src/lib/anatomy.ts` (`anatomy`, `withTerm`, `impliedMarginGap`, `TERM_INFO`),
`src/app/negotiations/[id]/anatomy/page.tsx`; the replay page links to it.
