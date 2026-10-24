# CLAUDE.md — Tacto Negotiation Arena (team repo)

Team repo for the **Tacto challenge** at the Industrial Agents Hackathon, Munich, 24–25 Oct 2026.
We build an **AI buyer agent** for Hollerau Pumpenwerke (a fictional pump maker). It negotiates by
e-mail with Tacto's hosted supplier bots and closes the cheapest **total-cost** deal, or walks away.

The source of truth is Tacto's documents. Read them before changing agent behaviour:
`brief/brief.md` (story, rules, score), `brief/api.md` (API, claims, cost formula),
`brief/submission.md` (hand-in), `starter-kit/README.md` (kit), `data/README.md` (data package).
If this file and Tacto's docs disagree, **Tacto's docs win**. Then fix this file.

---

## 1. Hard rules — never break these

1. **No human in the loop during the Live Final** (Sun 13:30). The agent runs alone from start to
   end of all 5 waves.
2. **The agent must never read the live feed**: `/v1/events`, `/v1/events/stream`, `/screen`,
   `/v1/screen`, `/leaderboard`, `/v1/leaderboard`, `/results`, `/v1/results` (and `arena board`).
   No code path the agent or runner uses may call them. They are for humans only.
3. **Never commit secrets**: `.env`, the arena key, LLM keys. `.env` is git-ignored. Keep it that way.
   The README lists env var **names** only.
4. **One key per team.** No attacks on the service or on other teams. Respect the limits:
   10 calls/s, 10 open sessions, **200 practice sessions per rolling 24 h**. Don't retry a `429`
   practice-limit error, because it won't clear until `resets_at`.
5. **Code freeze: Sun 25 Oct 13:00 (CET).** Clocks go back that night (03:00 becomes 02:00). After the freeze, nothing
   is pushed to `main`. Tacto checks the top 5 for later pushes. The final runs the commit we submit.
6. **Never push to `upstream`** (Tacto's kit). It is fetch-only. We push to `origin` only.
7. **No AI attribution in commits or PRs**: no `Co-Authored-By: Claude` lines and no "Generated with" footers.
8. **Document before you implement.** Every implementation change updates `docs/` first, or in the
   same commit at the latest:
   - `docs/implementation.md`: architecture, modules, constants, how to run.
   - `docs/decision-log.md`: what changed, why, and the measured effect.
   - `docs/results.md`: score tables.

   Code without matching docs is not done.

## 2. Timing rules the agent must respect

- **60 seconds per message per thread**, counted from the supplier's reply. A late message counts
  as a timeout: our last offer is repeated and the supplier's patience drops. **3 timeouts in a
  row**, or one after the last round, end the thread.
- The supplier's own reply can take **up to about 1 minute**. That time does not count against our 60 s.
  HTTP timeout ≥ 180 s (the kit uses 180).
- **Every LLM call needs a hard timeout (aim ≤ 30 s) and a coded fallback move.** Use a fast model
  at low effort. Heavy research (data mining, dossiers) happens **before** a session opens or
  offline, never inside the 60 s window.
- Send every `POST` with a fresh `X-Move-Id`. On a network retry, send the **same** id so the move
  is never sent twice. The kit's client already does this.
- Live Final: **5 waves, 8-minute cap each** (read `seconds_left`, don't assume 8 min). All cases of a
  wave run in parallel (≤ 10 sessions). Threads still open at the cap end with **no deal**. The kit's
  runner closes each case **90 s before the cap** with `play.closing_move`.

## 3. Negotiation mechanics the agent must get right

- **Term sheets bind. Nothing else does.** Each sheet contains **exactly** the case's `negotiable`
  fields. Every field except `unit_price` must take a value from `term_options` (or the
  supplier's standard value). Send at most **3 sheets** per message. An invalid message gets `422`, costs nothing and uses no round.
- **Only we close**: `{"action": {"type": "accept", "term_sheet_id": "offer:…"}}` or `walk_away`.
  `agreed` means the supplier offers exactly our terms, and **we still must accept**.
- **Unstated terms close on the supplier's standard terms** from its quote PDF. Always parse the
  quote PDF (`arena_kit.docs.standard_terms`) and price the sheet **with** those terms.
- **Before any accept**, code must check that:
  (a) `total_cost(case, terms, std)` beats our alternative (`c_alt`),
  (b) every `must_have` is kept (**a broken must-have scores 0**), and
  (c) the sheet ID is the supplier's current standing offer.
  If no sheet passes, walk away.
- **Claims**: the arena checks at most **3 per message**. Write **one argument per sentence**,
  with **our figure next to its ID**. A wrong figure or an unknown ID comes back `contradicted` and costs
  trust. Only cite IDs that exist in `facts.json` (or the case's `facts`), with figures computed
  by code. Tolerance: ±0.5 pp for %, ±0.5 % otherwise. Index claims use 2 months of one series,
  ≤ 12 months apart, ending within the last 12 months of the data.
- **Verified ≠ convincing.** Whether a true argument moves the supplier depends on that supplier.
  Read its notes, letters, news and quote remarks to find what it wants (cash, work, capacity,
  respect) and trade for that.
- **Never leak** urgency, a budget, or that we have no alternative. Don't take the first offer.
  **Never push past `final_offer`.** In engine v1.2, all 6 suppliers we pushed walked away.
- **RFQ cases** (2–3 suppliers) run in parallel threads, each with its own clock. Accepting one ends
  the case. Citing a rival's quote reveals it to the supplier we cite it to.

## 4. Score cheat sheet

- Score per case = `clip((C_open − C_deal) / (C_open − C_best), 0, 1)`.
- C = total cost over the horizon: price + uncovered need × fallback × (1 + risk) + early-payment
  interest + freight (Incoterm) + late-delivery days + expected defects − chargebacks + tooling +
  index clause and risk + (strategic/bottleneck only) the supplier-health charge.
- **No deal** scores the alternative (0 if there is none). Some cases are best left without a deal.
- **Coverage trap**: a cheaper price on a shorter contract or lower volume can score 0.
  Always price with `arena_kit.total_cost`. **Numbers come from code, never from the LLM.**
- `stabilise` / `secure_supply` cases charge us for leaving the supplier below a sustainable margin.
  Pass a supplier estimate (`full_cost` from should-cost, its cost of money) to `total_cost`.
- Final: wave score = mean case score × 100. Total = sum of 5 waves (max 500). Ties go to more deals,
  then fewer rounds.

## 5. Repo layout — where our code goes

```
brief/                    Tacto's brief, API, submission guide        (read-only, from upstream)
data/                     data package v1                              (read-only, from upstream)
starter-kit/
  .env                    our keys (git-ignored)
  data/package/           `arena data` output (git-ignored)
  arena_kit/              Tacto's kit: client, cost, docs, data, play, sim (avoid editing)
  arena_kit/agents/       naive.py, llm.py (Tacto) + OUR agent: agents/procudeal/
  scripts/                bench.py (benchmark runner), compare.py (score tables)
docs/                     OUR documentation: implementation, decision log, results (keep current)
notes/                    run log (notes/runs.md)
runs/                     one JSON per benchmark run: result, trace, back office, our decisions
CLAUDE.md                 this file
```

- **Our agent code** goes in `starter-kit/arena_kit/agents/` (e.g. `ours.py`, or an `ours/`
  package once it grows). Register it in `arena_kit/cli.py` (`agent_factory` and the `--agent`
  choices) so `uv run arena play case:P01 --agent ours` works.
- **Keep edits to Tacto's files minimal.** Pulling kit updates (`git fetch upstream && git merge upstream/main`) must stay easy. Reuse the kit: `ArenaClient`, `total_cost`,
  `complete_offer`, `standard_terms`, `DataPackage`, `play`, `play_waves`, `closing_move`.
- Planned pipeline: **Dossier builder** (offline: per supplier, mine letters, notes, contracts,
  scorecards, should-cost, price history, news, indices) → **Planner** (code: candidate sheets
  priced by `total_cost`, target and walk-away) → **Writer** (Claude: the e-mail text) → **Guard**
  (code: IDs exist, figures match, sheets valid, no leaks) → **Reply reader** → **Closer**.

## 6. Commands (run from `starter-kit/`)

```bash
uv sync --all-extras                                   # install
uv run arena me                                        # key works? quota left?
uv run arena data                                      # unpack data (again on Sunday after 08:00!)
uv run arena cases                                     # practice case files
uv run arena play case:P01 -v                          # naive agent, one hosted case (uses quota)
uv run arena play case:P01 --agent llm -v              # Tacto's LLM agent
uv run arena play case:D02 -v                          # sandbox: free, no quota, no board
uv run arena run --set practice --agent llm --parallel 8   # all hosted practice cases
uv run arena run --set final --agent <ours> --parallel 10  # THE LIVE FINAL RUNNER
uv run pytest                                          # kit contract tests
uv run ruff check .                                    # lint
```

Local simulator (no key, no quota, a plain scripted supplier that only teaches the API):
```bash
uv run arena-sim serve --no-clock --data data/package
ARENA_URL=http://127.0.0.1:8000 uv run arena register "Test" sim     # prints a sim key
ARENA_URL=http://127.0.0.1:8000 ARENA_API_KEY=<key> uv run arena play case:S01 -v
uv run arena-sim serve --final-rehearsal --data data/package          # rehearse waves
```

## 7. Testing ladder — cheapest first

1. **Unit / pytest**: cost math, guard, parsing. Free.
2. **arena-sim**: API plumbing, timeouts, waves (`--final-rehearsal`). Free.
3. **Sandbox `case:D01`, `case:D02`**: real supplier brains, no quota. Use it freely.
4. **Hosted practice cases**: count against the 200/24 h quota. Run them deliberately.
   Our best score per hosted case counts on the practice board.

After every practice run, **log it** in `notes/runs.md`: date/time, case, agent + commit hash,
score, c_open / c_deal / c_best, replay URL, and one line on what the replay taught us. That log
drives our analysis loop: run → read the replay → find the cause → change one thing → rerun.

## 8. Git workflow (two people)

- `main` is what runs in the final, so keep it working. For bigger changes, use a short-lived branch
  and merge once it runs.
- **Pull before you start and before you push**: `git pull --rebase origin main`.
- **Stage explicit paths only** (`git add path/to/file`). Never use `git add -A` or `git add .`. That keeps
  `.env`, data dumps and scratch files out.
- Small commits with clear messages. Never force-push `main`.
- Pull kit updates from Tacto: `git fetch upstream && git merge upstream/main`.

## 9. Data cheat sheet

- Data is as of **2026-09-30**. SQLite: `data/world.sqlite` (same as the CSVs). Citable IDs and their
  checked values: `data/facts.json` (10,356 IDs). Letters and notes: `data/correspondence/`.
  Contracts: `data/contracts/`.
- ID format `<type>:<id>[@period]`: `sup: part: po: gr: inv: qn: ctr:<no>#<clause> quote: rfq:
  fc:<part>@YYYY-MM idx:<series>@YYYY-MM sc:<sup>@YYYYQn cost:<part> news: doc:`.
- Useful tables: `cost_drivers` (which indices drive a part's cost), `should_cost` (full cost without
  margin; ±5 % for strategic/bottleneck parts), `price_conditions`, `negotiation_history`,
  `contract_clauses` (notice periods, index clauses), `scorecards`, `invoices` (do we pay late?),
  `supplier_intel` (credit index, equity ratio, owner type), `news`, `documents`.
- Company policy: standard payment 60 days net, cost of capital 8 %/yr, preferred Incoterm DAP.
  Country cost factors vs DE: AT/CH 1.0–1.1, CZ/PL/HU 0.8–0.85, TR 0.75, CN 0.7.
- Known quirks (`data/KNOWN_ISSUES.md`): 3 delivery dates per PO line, `price_unit` 1/100/1000,
  `sup:71999` is the old record of `sup:70210`, some notes are just noise.
- Practice cases P01–P19 are triggered by `doc:…-P01` … `doc:…-P19`. Example (P01, Brandlhuber):
  its letter gives 51 days' notice but contract §3.1 needs 90, its energy argument is contradicted
  by `idx:PPI-D351`, it asks for faster payment (it needs cash), and should-cost €132.64 is above
  today's €126.53.

## 10. Weekend timeline

| When | What |
|---|---|
| Sat 12:00 | Hacking starts (MUCL). Office hours from 14:00 |
| Sun 08:00 | **New data release**: run `uv run arena data` again and rebuild dossiers |
| Sun morning | Pre-flight: one practice case through the exact final setup |
| **Sun 13:00** | **Code freeze + submission** (event portal + Tacto items below) |
| **Sun 13:30** | **Live Final**: runner already started, on power, logging to a file, laptop not sleeping |
| Sun 15:00–16:10 | Finals and pitches at Tacto · 16:20 awards |

**Submit by 13:00.** Event portal: 1-min demo video, 1-min technical video, architecture +
integration notes, slides. Tacto: repo the jury can open + README (setup, env var names, run
command), the **commit hash** used in the final, a short approach description, slides (top 5).
This repo is private, so make it visible to the jury before the freeze.

## 11. Open questions for Tacto (update with answers)

- Are final suppliers among the 46 detailed suppliers in package v1, or new ones?
- Cases per wave? Do wave themes map to case types?
- Supplier reply latency during the final (how many rounds fit in 8 min)?
- How to estimate full cost for parts without a `should_cost` row?
- Pitch format: top 5 with 5+2 min (Tacto) vs 4 finalists with 3+1 min (event page)?
