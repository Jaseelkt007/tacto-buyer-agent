# Run the supplier generalization evaluation

The first operator-run Wave 02 trial is recorded at `runs/wave02-r01`: synthetic score 78.0/100,
ten acceptable deals, no runtime or constraint failures. Read the
[transcript-based interpretation](runs/wave02-r01/interpretation.md) before drawing conclusions.
Construction and validation did not run v1.9 on these cases. Four preregistered repetitions remain.

## Files

```text
evaluations/supplier-generalization/
  README.md                  Commands and report handoff
  methodology.md             Construction, controls, limitations and paper language
  report-template.md         Results template to fill after execution
  validation/wave-02.json    Construction checks, with zero buyer/model runs
  wave-02/
    public/G01.json ...      Ten public enquiries
    private/G01.json ...     Twelve independent supplier profiles across those cases
    manifest.json            Mechanisms and paired controls, excluded from buyer input
    protocol.md              Evaluation procedure frozen before the first run
    seal.json                SHA-256 hashes of the frozen inputs
    README.md                Case inventory
  runs/                      Created by your commands; one fresh directory per run
```

## Prepare

Run these commands from the repository root. The existing `starter-kit/.env` supplies
`OPENAI_API_KEY`; do not put the key in a command or report. The supplier model defaults to
`gpt-6.1-sol` at low effort. The buyer remains v1.9 with its default flags.

```bash
cd starter-kit
.venv/bin/python scripts/supplier_wave.py \
  --suite ../evaluations/supplier-generalization/wave-02 \
  --validate-only
```

Validation checks the seal, complete fixtures and financial feasibility. It calls neither a
buyer agent nor a model. The current environment already has the dependencies and Sunday release.
On another checkout, install the kit dependencies and make the same base package and release
available before running negotiations.

## Run a wave and stop after all cases finish

```bash
.venv/bin/python scripts/supplier_wave.py \
  --suite ../evaluations/supplier-generalization/wave-02 \
  --finish-when-done \
  --out ../evaluations/supplier-generalization/runs/wave02-r01

.venv/bin/python scripts/analyse_supplier_gym.py \
  ../evaluations/supplier-generalization/runs/wave02-r01
```

The ten cases run in parallel. Thread clocks and the eight-minute maximum remain active. The
local wave closes when every case has ended, then the normal runner exits on its next polling
cycle. A case that fails without closing may keep the wave open until the cap. This mode avoids
idle waiting; it is not a test of waiting through the entire eight-minute window.

The simulator stays local. Only supplier LLM calls use the network. These commands do not open
hosted arena sessions or consume practice quota. Invalid model responses and timeouts are recorded
as fallbacks, and the run exits unsuccessfully if errors or contract violations occur. It still
writes the report inputs. Inspect them instead of rerunning until a favorable result appears.

## Run the full local rehearsal clock

Omit `--finish-when-done` and use another output directory:

```bash
.venv/bin/python scripts/supplier_wave.py \
  --suite ../evaluations/supplier-generalization/wave-02 \
  --out ../evaluations/supplier-generalization/runs/wave02-full-clock

.venv/bin/python scripts/analyse_supplier_gym.py \
  ../evaluations/supplier-generalization/runs/wave02-full-clock
```

This runs one local eight-minute wave. It does not start the real competition final and does not
test transitions between five waves. Keep those distinctions in the paper.

## Read and share the report

Start with `report.md`, `summary.json`, `reconciliation.json` and `diagnostics.json` in the output
directory. The report shows the synthetic score, failures, total-cost results, the opening
baseline and the two matched controls. The private files retain choices, buyer traces and
dossiers for deeper investigation. `suite/` preserves the exact input files used by that run.

Send the report and summary after the first run. Include diagnostics and reconciliation if there
are failures or surprising paired differences. Keep the private files available for follow-up.
No output file contains an API key.

For the paper, run the five repetitions specified in `wave-02/protocol.md`, changing only the
output suffix from `r01` through `r05`. Compare recorded source and suite hashes; report every
attempt. Do not tune the buyer between repetitions. A high or low score from one synthetic wave
does not settle whether the buyer generalizes.

## Reproduce the fixtures

```bash
.venv/bin/python scripts/build_generalization_wave.py
```

This verifies or recreates the same files. It refuses to overwrite different frozen content.
Use a new version/directory for any later scenario changes. Tests:

```bash
.venv/bin/pytest -q tests/test_generalization_wave.py tests/test_supplier_wave.py tests/test_supplier_gym.py
```
