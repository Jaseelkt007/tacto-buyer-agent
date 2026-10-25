# Decision observer experiment

The first experiment is complete. [Results and interpretation](interpretation.md) explain why the
reviewer remains observation-only. The commands below use new directory names for another run.

An optional `--feedback` mode now summarizes earlier exchanges from each decision-time public
history. It uses the same model and leaves buyer actions unchanged. See the
[exchange-feedback experiment](../observation-feedback/README.md) for the implementation,
paired reviewer comparison and two fresh hosted practice checks.

The question is whether a narrow reviewer notices supported contextual omissions in v1.9 decisions.
This is observation only, not accept/reject control. The buyer never consumes reviewer answers.
Snapshots are captured before sending each decision; model calls run separately after negotiation.
This gives exact decision-time evidence without adding model latency to the supplier deadline.

OpenAI's [Decisions API](https://developers.openai.com/api/docs/guides/decisions) uses `gpt-6-luna`
and fixed choices. One choice selects verdict and affected term together. Flagged actions receive
a second call to select supporting evidence for that specific flag or decline it. The report
shows the selected original source text, not a generated rationale. Confidence is a model signal,
not measured accuracy. Citation existence is not a semantic verification of the finding.

The detailed prompt and request configuration are saved with each report. Missing/malformed answers,
unsupported flags, refusals and timeouts are recorded as unavailable, never NO_ISSUE. Each review has
a 15-second overall hard timeout, no retries, and at most four concurrent reviews. No private profiles,
future replies, outcome scores or back-office data enter the model packet.

From `starter-kit/`:

```bash
.venv/bin/python scripts/supplier_wave.py \
  --suite ../evaluations/supplier-generalization/wave-02 \
  --finish-when-done --observe \
  --out ../evaluations/decision-observer/runs/wave02-next
.venv/bin/python scripts/observe_decisions.py \
  ../evaluations/decision-observer/runs/wave02-next \
  --out ../evaluations/decision-observer/reviews/wave02-next

.venv/bin/python scripts/bench.py --agent procudeal --observe \
  case:D01 case:D02 --note observer-sandbox
# Hosted practice consumes quota. Use the same flags with explicit P case IDs.
# Review exact saved run files (printed by bench.py), not all historical runs:
.venv/bin/python scripts/observe_decisions.py ../runs/D01/EXACT_RUN.json \
  --out ../evaluations/decision-observer/reviews/sandbox-d01
```

Use fresh output directories. Every attempt is retained. Observations can be inspected with no
provider call using `--validate-only`. The capture flag does not enable the earlier hybrid.
The existing supplier model remains independent of the buyer reviewer.
The reviewer exits 1 if any observation is unavailable, including unsupported flags, and still
writes the complete report. An unavailable observation is not an approval.

Review all flags and a sample of NO_ISSUE decisions, separating real mandatory-constraint conflicts
from negotiable preferences and unsupported interpretations. Track missing observations and latency.
Only a later intervention experiment on fresh cases can measure negotiation benefit. These cases
have been inspected before, so this is development evidence, not an unseen generalization test.

The first reviewer used three independent questions. Sandbox and wave replays exposed inconsistent
verdict/field/evidence combinations. `versions/` retains that code; `reviews/sandbox-r02` and
`reviews/wave02-r02` retain its results. Version 2 makes verdict and field one choice and conditions
source selection on it. This is an output-consistency repair, not a supplier-specific prompt rule.
