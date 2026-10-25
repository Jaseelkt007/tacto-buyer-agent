# Local supplier practice

Individual and timed-wave local runners are implemented. They use the local simulator and, in LLM
mode, the model provider. They never open hosted arena sessions. The wave runner is an explicit
separate command; individual-case runs do not start a timed rehearsal.

For the harder new wave and operator-run commands, use
[the generalization evaluation folder](../evaluations/supplier-generalization/README.md).
The wave CLI accepts `--suite <directory>` and `--finish-when-done` to skip idle cap waiting.

The supplier is an LLM choosing from financially feasible actions. Each supplier thread has its own
private, explicitly fictional costs, financing, capacity, hedge dates and conversation. Cases use
public Sunday supplier identities and documents; they are not predictions of hidden final cases.
Ten cases contain twelve supplier instances: eight single-supplier cases and two two-supplier RFQs.
The RFQs assume qualification for the example part; that qualification is fictional.

## Design decision

Two designs were compared: extend the kit simulator, or build an independent match engine. Use the
simulator integration to retain its HTTP, acceptance, attachment and retry contracts. Replace its
opening quotes, bargaining and evaluator together. Adopt the independent engine proposal's immutable
offer snapshots and explicit public/private reports. Keep production buyer source unchanged.

Public cases and private supplier profiles live in separate fixture files. A pure `SupplierPolicy`
calculates full-package financial floors from its private profile and the enquiry's contractual
domain. It receives no buyer budget, alternative, estimates or scoring weights. An `LLMChooser`
selects a legal action ID; code renders binding terms and email text. Invalid model choices and
timeouts use an explicitly recorded fallback. The model cannot change a financial limit.

`GymSim` integrates that policy with the existing simulator API. Each local episode gets a fresh
simulator, client and buyer. `play(RemoteTable(client), case_id, buyer)` crosses in-process HTTP JSON
boundaries, downloads real generated PDFs and runs the existing v1.9 buyer. There is no arena network
connection. Only LLM mode calls the model provider. Reference mode is a deterministic diagnostic.

The initial fixtures cover cash versus normal financing, spare capacity, a hedge within and beyond
its expiry, irrelevant-news wording, a distributor's commitment preference, competing quotes and an
unprofitable negotiation. All use the leverage category: supplier-health scoring is explicitly out
of scope for this suite, rather than silently approximated. Private financial assumptions are not
calibrated to the buyer's policy or leaderboard results.

Evaluation uses published buyer cost math plus the independent supplier floor. Enumerate every
declared nonprice combination at its minimum cent price. These fixtures have positive linear buyer
price costs and no supplier-health term; the enumerated optimum is exact within this deliberately
limited synthetic domain. Report raw costs, benchmark gaps, must-have compliance, financial
feasibility, model failures and all attempted episodes. Synthetic scores do not predict leaderboard
scores. Unsupported numeric claims receive no automatic verification or concession credit.

The individual runner tests negotiations with clocks disabled. The wave runner uses a separate
simulator/API instance per case, avoiding the inherited global request lock across cases. A local
transport routes requests to those instances and exposes a shared wave schedule. One real
`ArenaClient` retains the kit's shared rate limiter; unchanged `play_waves(..., waves=1, parallel=10)`
handles discovery, concurrent sessions, the 90-second closing margin and termination at the cap.
Supplier profiles and message state remain separate even when identities repeat across cases.

The wave adapter enables 60-second thread clocks and a shared 480-second cap. It records actual
request intervals, case finish times, model failures and scores. This is a local timed wave using
the model provider, not the hosted competition. It exercises one wave, not transitions across five.

## Interface sketch

```python
policy = SupplierPolicy(context, private_profile)
actions = policy.menu(round_number, standing, buyer_sheets, final=False)
choice = chooser.choose(policy.supplier_view(), thread_history, actions)
sim = GymSim(public_case, profiles, chooser)
with sim.local_client() as client:
    result = play(RemoteTable(client), public_case['case_id'], unchanged_buyer)
```

Verification covers financial tradeoffs, invalid numbers, hedge expiry, infeasible offers,
immutable PDFs, private-state isolation, model fallback reporting and completed buyer episodes.

## Case inventory

| Case | Supplier agents | What it tests |
|---|---|---|
| L01 | Vrbenský | Expensive financing: faster payment can buy a substantial discount. |
| L02 | Vrbenský, fresh state | Cheap-financing control despite the same public cash-pressure evidence. |
| L03 | Kraslin | More volume spreads fixed costs; excessive volume exceeds capacity. |
| L04 | Steinfelder | 2027 steel delivery is within the hedge period. |
| L05 | Steinfelder, fresh state | 2028 delivery is beyond the same hedge's expiry. |
| L06 | Rhönsberg | Cable order without recycling publicity in the opening email. |
| L07 | Rhönsberg, fresh state | Identical economics with the irrelevant recycling sentence added. |
| L08 | Inntal | A longer commitment has a stated private economic benefit. |
| L09 | Vrbenský + Pfaffenreuth | Compare competing packages with different financing/commitment values. |
| L10 | Vrbenský + Pfaffenreuth, fresh states | Both suppliers cost more than a credible alternative; walk away. |

One agent means one private profile and conversation, not a separate model or process. Both RFQ
suppliers use the same configured model but see only their own thread. Rival quotes enter that
thread only if the buyer explicitly includes them in its message.

## Commands

From `starter-kit/`, with the existing dependencies and Sunday release installed:

```bash
# Optional: regenerate the versioned public/private fictional fixtures.
.venv/bin/python scripts/build_supplier_gym.py

# No model calls: exercise ten individual negotiations and save the evidence.
.venv/bin/python scripts/supplier_gym.py --mode reference --out ../notes/analysis/supplier-gym/reference-new

# Model calls use OPENAI_API_KEY from the existing .env; no arena key is used.
.venv/bin/python scripts/supplier_gym.py --mode llm --model gpt-6.1-sol --out ../notes/analysis/supplier-gym/llm-new

# Limit a diagnostic to selected cases.
.venv/bin/python scripts/supplier_gym.py L04 L05 --out ../notes/analysis/supplier-gym/hedge-new
.venv/bin/pytest -q tests/test_supplier_gym.py

# Recheck the saved offers against supplier limits and the actual selected actions.
.venv/bin/python scripts/analyse_supplier_gym.py ../notes/analysis/supplier-gym/llm-new

# One actual 480-second local wave, ten parallel cases, per-thread clocks enabled.
.venv/bin/python scripts/supplier_wave.py --out ../notes/analysis/supplier-gym/wave-new
.venv/bin/python scripts/analyse_supplier_gym.py ../notes/analysis/supplier-gym/wave-new
```

Use a new output directory for each run. `*-public.json` contains the case and actual emails;
`*-private.json` contains model choices, financial profiles, dossier snapshots and buyer decisions.
`results.json` and `summary.json` retain failures and fallback counts. The runner exits unsuccessfully
if a case fails, a supplier model falls back, the buyer falls back, or a deal breaks a must-have.
A reference run is explicitly labelled and never counted as evidence of working LLM choices.

The model uses [strict structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
to select a menu ID. Binding email prose is rendered from the chosen action, so it cannot add an
unsupported promise. Free-form supplier language is outside the first suite's scope.

The in-process FastAPI client uses threads/async wake-ups. In restricted environments that block
those primitives, run the command with the appropriate local execution permission; do not replace
the test with a hosted arena session.

The JSON field `missed_savings_eur` is a theoretical benchmark gap. The supplier is financially
able to accept that benchmark package, but the LLM is not guaranteed to offer or accept it in a
particular negotiation. Do not interpret the gap as demonstrated savings achievable in production.

Each supplier publishes one binding package per reply. The buyer may propose up to three. This
does not yet validate v1.9's financing-rate inference from simultaneous comparable payment quotes.
The suite tests release ingestion, package tradeoffs, quote parsing, counteroffers and closing;
it is not exhaustive coverage of every negotiation feature.

Wave reports additionally include per-case finish times, the mean synthetic case score × 100,
actual request overlap, HTTP failures, thread timeouts and cap closures. The run remains alive
until the wave closes even if all cases finish earlier. Timings reflect one local pass and real
model requests; local in-process HTTP does not reproduce venue Wi-Fi or the hosted service's latency.
The scoring benchmark includes the cheaper buyer alternative, as required by `brief/api.md`.
