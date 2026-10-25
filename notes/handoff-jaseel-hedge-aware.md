# Handoff to Jaseel: `hedge_aware` for P08 (off by default)

From Siddharth, Sun 25 Oct 2026, about 05:00. Branch **`engine-hedge-aware`**, stacked on
`engine-stated-limit` (your `main` at `8854a35` + `stated_limit`). One commit on top. The flag is
**off**: with it off, the engine behaves exactly like `engine-stated-limit`. Read
`notes/handoff-jaseel-stated-limit.md` first; that one is the must-do.

**In short:** P08 loses its best opening argument every time, because Donautal's own letter says its
alloy cost is fixed until March 2027. This rule cites that letter instead. It is **not measured on
the arena**: one hosted P08 run decides whether it gets switched on.

---

## 1. The problem in P08 (0.604)

| Finding | Evidence | Meaning |
|---|---|---|
| The gap is the alloy clause, not the price | We close at €5.30 **with** the 0-deadband AS-14404 clause, which costs us €31.7k (index €27.1k + risk €4.5k). The same price without it scores ≈ 0.79 (board best 0.77) | the money is in the clause |
| The clause choice itself is right | Donautal's own alternatives price 0 → 5 % deadband at +€0.12 (2.2 %), about what the deadband saves us | don't touch the clause mechanism |
| **Our opening argument fails every time** | We open with "AS-14404 changed −5.5 % from 2026-06 to 2026-09". In **every** recorded P08 run Donautal answers: *"That is not our reality: our AS-14404 is covered at fixed prices until March 2027, so that fall does not reach our cost."* | the strongest slot of the first email is wasted |
| **We never use its own letter against it** | Letter `doc:20260706-70710-M1` (2026-07-06): *"our nickel and alloys requirement is covered at fixed prices until March 2027."* So the +5.9 % alloy rise in its quote doesn't reach its cost either | the logical argument goes unused |

The engine already knows the supplier is hedged (`dossier.hedged`), and `react()` drops index claims
once it says "not our reality". But that happens one round too late, and the hedge argument only
exists for call notes (`_call_note`, off since v1.7c), not for the supplier's own letters.

## 2. The rule (flag `hedge_aware`, O)

If the supplier's **own letter** says its material is covered at fixed prices **beyond the data month**:
1. **Cite it** (new claim kind `hedge`, strength 7, so it goes first):
   *"In your letter of 2026-07-06 (doc:20260706-70710-M1) you told us your nickel and alloys
   requirement is covered at fixed prices. That cover runs until March 2027, so the index rises in
   your quote do not reach your cost before then."*
   - The **date** is the checked figure: it equals the `date` field of the doc fact.
   - The end of the cover is in **its own sentence without an ID**, so the arena has nothing
     unverifiable to mark as contradicted.
2. **Drop index falls on that material only**, matched by name ("alloys" ~ "Alloy surcharge 1.4404",
   "copper" ~ "Copper notation"). The unhedged steel fall (PPI-C2431) stays.

Guards:
- **Letters only**, the supplier's own words. Hedges that appear only in our call notes are not cited
  (70190, 70560, 70730), because citing call notes drew requests for proof in v1.7b.
- No claim once the cover has expired (until-month ≤ data month).
- Off by default; on with `PROCUDEAL_ON=hedge_aware`.

**Not overfitting:** nothing is keyed to a case or supplier. In the data, 5 of 46 suppliers are hedged
and 2 of them by letter (70710 Donautal, 70520 Vesmo); both are covered by tests. Among the practice
cases only P08 changes; the other 9 send identical opening claims.

## 3. The code (one commit)

| File | Change |
|---|---|
| `procudeal/claims.py` | `HEDGE_LETTER` and `MONTHS`, `_hedge_letter()` (added to `build_bank`), `hedged_index()` |
| `procudeal/policy.py` | `"hedge_aware": False` in `FEATURES`; bank filter right after the `call_note_lever` filter and before your `plan_bank` |
| `tests/test_procudeal_hedge.py` | 6 tests: off by default, letter pattern (and a call note doesn't match), only the hedged material's index claims are dropped, both hedge letters in the data, no claim from a call note |

## 4. Checks (all local, no arena)

| Check | Off | On |
|---|---|---|
| P08 opening claims | AS-14404 fall (always rejected), delivery record, volume | **hedge letter**, PPI-C2431 fall, delivery record |
| Other 9 practice cases | same | same opening claims |
| arena-sim S01 / S02 / S03 / P08 | 0.864 / 0.806 / 0.681 / 0.789 | identical, 0 errors (the sim supplier ignores arguments, so this only proves nothing breaks) |
| `uv run pytest -q` | 121 passed | **127 passed**, 12 skipped |
| `uv run ruff check .` | clean | clean |

## 5. To decide

The effect on Donautal is unknown. The downside is limited: the claim is true and checkable, so the
worst case is that it is ignored, which is today's outcome. The upside is whatever it moves on the
clause or the price; each €0.10/unit is worth about +0.11 on P08. **Run one hosted P08 with
`PROCUDEAL_ON=hedge_aware`.** Switch it on only if P08 beats 0.604, and never on for the final
without that run.

```bash
cd starter-kit
uv run pytest tests/test_procudeal_hedge.py -q                               # 6 passed
PROCUDEAL_ON=hedge_aware uv run python scripts/bench.py --agent procudeal case:P08 --note "O +hedge_aware"
```
