# Handoff to Jaseel: engine fix `stated_limit` (and what to leave alone)

From Siddharth, Sun 25 Oct 2026, about 04:30. Branch **`engine-stated-limit`**, rebased on your `main` at
`8854a35` (v1.8 flags, strategist). The fix sits on top of your work; the new flag comes after yours in `FEATURES`. It holds **only** the `stated_limit` fix, its tests and this note. Nothing from
`web/`, and none of the experiments in section 2. Not merged into `main`: you decide.

**In short:** one change must go in before the freeze: **`stated_limit`**, a bug fix in `ready()`.
Everything else from tonight stays **off**, or should be deleted. One setup problem
(`ARENA_DATA`) must be fixed before the final, or the runner can't find the data.

---

## 1. Must do (strict)

### 1.1 Add `stated_limit`: take a limit the supplier states in an *open* reply

**The bug.** `ready()` treats a supplier as finished only when `status == "final_offer"`, it has
`agreed`, or the round count runs out. Suppliers also state a hard limit in plain words while the
status is still `open`. The engine doesn't read that, sends another counter below the limit, and
the supplier walks away.

**Seen on the hosted arena.** P02, session `19aabaded4ee3dd1`
(replay https://arena.tacto.ai/replay/19aabaded4ee3dd1), scored **0.000**:

| Round | Nordmark (status `open`) | Engine |
|---|---|---|
| R1 | €373.88, 90 days | counter €355.99 |
| R2 | €372.88 | counter €361.06 |
| R3 | **€371.88: "this represents our limit under the requested 90-day payment terms … Which figures is that based on?"** | **counter €364.31, no data** |
| R4 | `walked_away`: "We are withdrawing from this negotiation." | no deal → 0.000 |

€371.88 is *better* than the €371.95 that v1.7c normally closes at (0.499).

**The evidence that this isn't a made-up rule.** I scanned every supplier email in the 142 recorded
runs (`web/src/data/runs.json`, 881 supplier emails) for limit-style wording and checked what the
supplier offered **after** it:

| Wording in an `open` reply | What it did next | Matches the new signal? |
|---|---|---|
| "this represents our limit", "we have reached our (absolute) limit", "we really cannot go below €X", "€X is the best we can do", "absolute bottom line", "I can't go any lower" | **never went lower**: 11 of 11 held that price to the end, 2 threads ended | **yes** |
| "our flexibility is **reaching** its limit", "we are **reaching** the limit of our flexibility", "financing costs that **limit** …" | **went lower** in all 3 (P01 `ca12c7`, P02 `3f6acc`, `c9761d`) | **no** |

The regex matched 26 emails in the corpus: 13 formal `final_offer` replies (no change) and 13 `open`
replies, none of which was followed by a lower price.

**It follows the arena rules.** We still close only by `accept` on the supplier's current sheet ID,
and api.md lets us accept any standing sheet, not just a final offer. The fix only makes the
supplier `ready`; **the existing accept check still decides**, unchanged: C below the walk-away
limit / beats `c_alt`, must-haves kept, current standing sheet. It never fires before our first
counter (`side.ours` must be non-empty), so we never take the opening quote. In stabilise /
secure-supply cases it doesn't fire below the health band (same guard as `agreed`).

**The code: three edits, all in `starter-kit/arena_kit/agents/procudeal/`.**

(a) `signals.py`: a new trait at the end of `TRAITS`:

```python
    # A limit it states in an open reply: "this represents our limit", "we have reached our absolute limit",
    # "we really cannot go below €45.50", "€46.00 is the best we can do", "the absolute bottom line".
    # In 142 recorded runs it never went lower after these; "reaching the limit of our flexibility" and
    # "costs that limit …" are not limits (it did go lower) and do not match.
    "limit": r"(?:represents|reached|is) (?:our|the) (?:absolute )?limit|our absolute limit"
    r"|(?:cannot|can't|can not) go (?:any )?(?:below|lower)|the best we can do|bottom line",
```

(b) `policy.py`, `FEATURES`: one flag, **on**:

```python
    "stated_limit": True,  # N: a limit it states in an open reply is ready like a final offer (P02: it walked)
```

(c) `policy.py`, `Negotiator.ready()`: directly after
`if not side.ours or not side.theirs: return False` and **before** the `proactive_clause` check:

```python
        if on("stated_limit") and "limit" in side.last.traits and not below_health:
            return "it states its limit"  # pushed past a stated limit it walks (P02); the accept check still runs
```

(d) The test file `starter-kit/tests/test_procudeal_stated_limit.py` (15 tests): 7 real limit phrases
match; 4 soft phrases don't; `ready()` returns the reason with the flag on; nothing happens with it
off, after a soft phrase, or on the opening quote.

**What it changes, measured locally (no hosted runs):**

| Check | Before | After |
|---|---|---|
| Offline replay of the P02 walk-away thread through the engine | R3: counter €364.31 → walk-away, 0.000 | **R3: accept €371.88 → ≈ 0.506** (arena C at €371.95 shifted by the kit's `total_cost` delta) |
| Offline replay of the P11 v1.7c thread (`275333afbf6b9fa4`) | €45.50 accepted at R7 | same €45.50 accepted at **R3**: same score, 4 fewer rounds (rounds break ties) |
| arena-sim S01 / S02 / S03 / P02 (P02 loaded from the local inbox snapshot) | 0.864 / 0.806 / 0.681 / 0.619 | **identical**, 0 errors, 0 fallbacks |
| `uv run pytest` on this branch (`uv sync --all-extras`) | 106 passed | **121 passed**, 12 skipped (see 1.2); with the code removed, 8 of the new tests fail |
| `uv run ruff check .` | clean | clean |

How to read the impact: it does **not** make deals cheaper. It stops the engine from throwing away a
deal (or wasting rounds) once a supplier has said it won't move. Where a supplier states a limit,
it's worth up to a whole case (0 → about 0.5 here). Elsewhere nothing changes.

**To verify on your side:**

```bash
cd starter-kit
uv run pytest tests/test_procudeal_stated_limit.py -q    # 15 passed
uv run pytest -q                                         # 121 passed, 12 skipped
uv run ruff check .
PROCUDEAL_OFF=stated_limit uv run pytest -q              # the switch-off path still passes
```

If you want one hosted confirmation, P02 is the case (1 session). But the supplier's wording varies
between runs, so one run may never show the limit sentence.

### 1.2 Fix the data path before the final

`starter-kit/.env` has `ARENA_DATA=data/package`, but **`starter-kit/data/package` does not exist**
on my machine. Effects:
- `scripts/bench.py` crashes with `FileNotFoundError: no facts.json or .sqlite` unless you pass
  `--data ../data`. **If the final runner reads the same setting, it would fail the same way.**
- 12 pytest tests (the ones that need the real package) are being **skipped**, not run.

Fix: after the Sunday 08:00 data release, run `uv run arena data` from `starter-kit/`, check
that `starter-kit/data/package/facts.json` exists, then confirm `uv run pytest -q` shows fewer skips.
Then do one dry run of the exact final command.

---

## 2. Experiments that are NOT on this branch

These stay on my local branch `engine-index-fix`, all off by default. They are listed so nobody
redoes them. Don't port any of them for the final.

| Flag | What it does | Result | Do |
|---|---|---|---|
| `clause_buyout` (I) | next to a costly index clause, a no-clause sheet | P08 +2.2, **P18 −6.8** (hosted A/B, rule set in advance) | **delete or keep off** |
| `volume_commit` (J) | state the volume commitment unasked | P11 no change, **D02 −4.2** (hosted / sandbox) | **delete** |
| `rival_cheaper` (K) | cite a rival's price only if it is below the recipient's own | not measured on real suppliers; offline it removes 3 harmful P05 citations (we told the cheapest bidder about a *higher* rival, and it raised its price) | keep off; candidate for later |
| `stall_alt` (L) | once a supplier stalls, an equal-cost second package every round | not measured; the P11 history supports it (two packages every round → 0.875; one → 0.710) | keep off; candidate for later |
| `contract_otd` (M) | argue on-time delivery below the contract's 95 % target | hosted P02: **verified but ignored** ("does not change our calculation") | **delete or keep off** |

The **full menu** (`PROCUDEAL_OFF=single_sheet`) is also rejected: mean 63.9 vs 72.7, P07 lost its
deal, and P08 and P18 dropped. Keep `single_sheet` on.

---

## 3. What was wrong, case by case (for context)

| Case | v1.7c | Cause (from the supplier's own emails) | Status |
|---|---|---|---|
| P02 | 0.499 | Nordmark sells **at cost** (should-cost €374.95 > price; arena relationship charge shows margin ≈ 0.07 %). All its cost claims are true (copper +47.7 %; since our Jan 2026 price ≈ +6.4 %). Room to the best deal is ≈ 1 % (€3.9/unit); each €1/unit ≈ ±0.13 score. Payment is already optimal (it charges ≈ 3.5 %/yr for longer terms; ours costs 8 %). A copper clause doesn't pay (≈ €18k index risk). | `stated_limit` protects the deal; no safe lever found for a lower price |
| P11 | 0.710 | With one package, Kalwisz holds at €45.50 ("hands are tied" without faster payment, which isn't negotiable) | `stall_alt` is a candidate, untested |
| P05 | 0.710 | We cited a higher rival price to the cheapest bidder (70240), and it raised its price | `rival_cheaper` is a candidate, untested |
| P08 | 0.604 | Concedes steadily to its own floor of ≈ €5.28–5.30; nothing we tried moved it | no fix |

Two smaller engine notes:
- In P02, all our arguments are spent in round 0 (only 2–3 in the bank), so rounds 1–3 go out with
  none, including after "please send us the data". Not changed; it would alter pacing in every case.
- The claim bank cuts off on-time delivery at a fixed < 90 %; contracts say 95 %. Only P02 sits in
  between among the practice cases, and the argument didn't move Nordmark, so it's left off.

---

## 4. What this branch contains

| File | What |
|---|---|
| `starter-kit/arena_kit/agents/procudeal/signals.py` | `limit` trait (+6 lines) |
| `starter-kit/arena_kit/agents/procudeal/policy.py` | `stated_limit` flag + 2 lines in `ready()` (+3 lines) |
| `starter-kit/tests/test_procudeal_stated_limit.py` | 15 tests, self-contained |
| `notes/handoff-jaseel-stated-limit.md` | this note |

To switch it off without a code change: `PROCUDEAL_OFF=stated_limit`.

Practice quota: 231 of 400 left when this was written. Rules unchanged: no pushes to `main` after
13:00, the agent never reads `/leaderboard`, `/events` or `/results`, and stage files by explicit path.
