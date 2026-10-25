<p align="center">
  <img src=".github/assets/readme-banner.png" alt="Tacto Negotiation Arena. Your agent. Our suppliers. Real money." width="100%">
</p>

<p align="center">
  <a href="https://arena.tacto.ai/apply"><b>Apply for your key</b></a> ·
  <a href="brief/brief.md">Brief</a> ·
  <a href="brief/api.md">API docs</a> ·
  <a href="starter-kit/">Starter kit</a> ·
  <a href="https://arena.tacto.ai/live">Build page</a> ·
  <a href="https://arena.tacto.ai/results">Results</a>
</p>

# ProcuDeal

Our buyer agent negotiates procurement contracts for Hollerau Pumpenwerke in the Tacto Negotiation
Arena. The default pipeline combines the **v1.9 deterministic negotiation engine** with an
**two advisory LLM stages**, enabled for practice and final waves: a reply interpreter and the
earlier decision reviewer with exchange feedback.

Code calculates total cost, chooses binding terms and claims, and decides when to accept or walk
away. The interpreter reads supplier replies alongside earlier exchanges and records conditions,
preferences, and conflicts with source quotations. After the policy prepares a move, the decision
reviewer checks it against the accumulated exchanges and requests supporting evidence for a flag.
Neither stage changes offers or acceptance. This is separate from the older hybrid strategy,
which remains disabled by default.

## Set up the agent

Use Python 3.12 and [uv](https://docs.astral.sh/uv/). From the repository root:

```bash
cd starter-kit
uv sync --all-extras
```

If `.env` does not exist, copy `.env.example` to `.env`. Configure these values without committing
the file:

| Variable | Purpose |
|---|---|
| `ARENA_URL` | `https://arena.tacto.ai` for hosted practice and the final |
| `ARENA_API_KEY` | Your team’s arena key |
| `ARENA_DATA` | `data/package` |
| `OPENAI_API_KEY` | Key for the `gpt-6.1-sol` interpreter and `gpt-6-luna` decision reviewer |
| `PROCUDEAL_REPLY_INTERPRETATION` | `on` by default; `off` reproduces the engine without this interpreter |
| `PROCUDEAL_DECISION_REVIEW` | `on` by default; controls the `gpt-6-luna` reviewer after the policy |
| `LLM_PROVIDER`, `LLM_MODEL` | Configure the kit's emergency LLM fallback; see `.env.example` |
| `ANTHROPIC_API_KEY` or `LLM_API_KEY` | Credential for that fallback provider, separate from the interpreter setting |

Download the available data, including Sunday's release:

```bash
uv run arena data
uv run arena me
```

Keep `data/package` and `data/release-sunday` beside each other. `DataPackage` merges the release
automatically. Run commands below from `starter-kit/`.

## Check a practice case

This command opens one hosted practice session and saves decisions, interpretation records,
complete buyer decision timings, and the result under `runs/`:

```bash
uv run python scripts/bench.py --agent procudeal case:P08 \
  --data data/package --observe --note final-setup-check
```

No extra model flags are needed. For the original baseline, set both
`PROCUDEAL_REPLY_INTERPRETATION=off` and `PROCUDEAL_DECISION_REVIEW=off` before running. The benchmark
and synthetic-wave commands also accept `--no-interpret-replies` to disable only the interpreter.
That flag does not disable decision review. Explicit interpretation flags override its environment setting.

## Run the final

Start before the first wave and leave the process running. **This command opens actual final
sessions when cases become available.**

```bash
mkdir -p logs
uv run arena run --set final --agent procudeal --data data/package \
  --parallel 10 --waves 5 -v > logs/final.log 2>&1
```

The runner waits for the waves, creates a separate agent for each case, and closes remaining cases
before the wave cap. Both advisory stages are constructed automatically for each ProcuDeal
agent. `-v` records decisions, interpretations and decision reviews in the log. Keep the machine on
power and awake; the final has no human intervention. If the process stops, the runner supports
resuming existing sessions from their public message history.

The interpreter has an **eight-second deadline per supplier read** and continues with the
deterministic policy on a model error or timeout. Final/agreed replies skip interpretation.
Multiple suppliers can require multiple reads, so eight seconds is not a whole-decision bound.
The decision reviewer has a separate eight-second total deadline across its assessment and evidence
check. It uses the remaining time within a 45-second decision budget, skipping review if exhausted.
The deterministic decision proceeds when either model is unavailable.

In the interpreter-only check, 72 buyer decisions across four hosted cases and ten concurrent synthetic
cases took at most **12.98 seconds**, with zero thread timeouts and 14 valid deals. Three
interpreter calls timed out and fell back. This is a measured smoke check, not a guarantee under
all network conditions. Hosted scores and actions were unchanged; no negotiation improvement is
claimed. [Results and commands](evaluations/reply-interpretation/runs/finalization-r01/report.md).

With **both models enabled**, the follow-up check completed 64 buyer decisions across P08/P18 and
ten concurrent synthetic cases. Maximum reply preparation was **10.35 seconds**, with no thread
timeouts and 12 valid deals. The decision reviewer ran on all 64 decisions; both hosted outcomes
were unchanged. [Combined-model report](evaluations/reply-interpretation/runs/dual-default-report-r01/report.md).

## Understand and test the pipeline

```text
Data package + Sunday release → deterministic supplier dossier
Supplier reply + earlier exchanges → advisory JSON interpretation
Existing policy → cost checks and binding decision → claims → email
Prepared action + exchange feedback → advisory decision review → send
```

The model returns source references and interpretation categories. Code resolves quoted values
from the supplier’s actual sheets. Source validation establishes provenance, not semantic truth;
a preference can still be misclassified, so the observations remain advisory.

```bash
uv run pytest -q
uv run python scripts/supplier_wave.py \
  --suite ../evaluations/supplier-generalization/wave-02 --finish-when-done \
  --observe --out ../evaluations/reply-interpretation/runs/my-wave-01
```

The synthetic command uses local cases and LLM suppliers; it makes model API calls but opens no
hosted negotiation sessions. Use a fresh output directory for each run. Unit tests disable real
interpretation calls; dedicated default-pipeline tests verify the production factory and wave
runner with an injected model response.

- [Implementation and policy boundaries](docs/implementation.md)
- [Reply interpretation contract](docs/reply-interpretation.md)
- [Evaluation artifacts and limitations](evaluations/reply-interpretation/README.md)
- [Original kit and local rehearsal instructions](starter-kit/README.md)
- [Competition brief](brief/brief.md), [API](brief/api.md), and [submission requirements](brief/submission.md)

## Links

| What | Where |
|---|---|
| Apply for your key | https://arena.tacto.ai/apply |
| Brief: story, task, score, rules | [brief/brief.md](brief/brief.md) |
| API docs | [brief/api.md](brief/api.md) |
| Starter kit: client, example agents, Live Final runner, local simulator, MCP server | [starter-kit/](starter-kit/) |
| Submission and pitch | [brief/submission.md](brief/submission.md) |
| Practice build page: every team's quota, records and highlights | https://arena.tacto.ai/live |
| Live Final results, team by team and case by case | https://arena.tacto.ai/results |
| Questions | The Tacto team at MUCL, office hours from Sat 14:00 · [FAQ](https://arena.tacto.ai/faq) |

## The weekend at a glance

| When | What |
|---|---|
| Sat 10:30 | Kickoff at the Tacto office: brief, data, kit and practice arena go live |
| Sat 12:00 | Hacking starts at MUCL. Practice all weekend, overnight included: 200 sessions per team per 24 hours |
| Sat from 14:00 | Office hours at MUCL |
| Sun 08:00 | **New market data.** Run `uv run arena data` again; hidden cases may cite it |
| Sun morning | Pre-flight: one practice case through your final setup |
| Sun 13:00 | **Code freeze**: submit on the organisers' platform |
| Sun 13:30 | **Live Final**: five waves, 8 minutes each, every team at once |
| Sun 15:10 | **Top 5 pitch** to the jury at the Tacto office: 5 minutes + 2 minutes of questions |
| Sun 16:20 | Awards |

The clocks go back in the night to Sunday (03:00 becomes 02:00): every Sunday time is the new time.

## Rules that matter

- **No human in the loop** during the Live Final. Start your agent before it starts and leave it running:
  `uv run arena run --set final --agent procudeal --data data/package --parallel 10` picks up each wave by itself.
- **Your agent must not read the live feed** during the Live Final: `/v1/events`, `/screen`,
  `/leaderboard`, `/results` and their JSON. They are for you, not for your agent.
- **One key per team.** No attacks on the service or on other teams.
- Everything else counts, including weaknesses you find in our suppliers. Every replay is open to
  the jury.

All rules: [brief, section 7](brief/brief.md#7-rules).

## What to submit by the code freeze (Sun 13:00)

On the organisers' platform:

- **Your repo** with the agent and a README that says how to run it, and the **commit hash** your
  agent runs in the final. The jury must be able to open it.
- **A short description** of your approach.
- **Slides** for the pitch, if you make the top 5: they pitch at 15:10.

Details: [brief/submission.md](brief/submission.md).

## Prizes

Robots, caps and a small extra. The Live Final decides who pitches (the top 5); the jury sets places 1-3
from the final score and the pitch.

## What is in this repo

| Folder | What |
|---|---|
| [`brief/`](brief/) | The brief, the API docs, the submission guide |
| [`starter-kit/`](starter-kit/) | ProcuDeal, the Python client, Live Final runner, example agents, local simulator, and data MCP server |
| [`data/`](data/) | Data package v1: CSV, SQLite, `facts.json`, contracts, letters, notes. The same as `https://arena.tacto.ai/v1/data/package.zip`; start with [`data/README.md`](data/README.md) |

The company, its suppliers and all names are fictional; the market indices are real open series
([`data/ATTRIBUTION.md`](data/ATTRIBUTION.md)).

## Licence

Code: MIT ([LICENSE](LICENSE)). Data and docs: CC BY 4.0 ([LICENSE-data](LICENSE-data)). Your code
is yours.

<br>
<p align="center"><sub>Tacto · AI for industrial procurement · Industrial Agents Hackathon 2026, Munich</sub></p>
