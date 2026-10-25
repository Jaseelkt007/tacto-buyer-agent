# Exchange-feedback reviewer: small observational experiment

The existing reviewer already receives full thread history. This change adds an explicit,
deterministic exchange ledger to help the same gpt-6-luna reviewer use that history. It does not
introduce a buyer policy or replay final scores into earlier decisions. Prior model judgments
are not accumulated as facts. The ledger can be rebuilt from each public prefix without mutable
cross-case state and records sources, previous proposals, replies, repeated quoted values and
differences in the current draft. Quoted preferences are not mandatory buyer constraints.

Scope: one fresh synthetic wave containing G03/G06/G10, and one hosted practice run each on
P08/P11. Capture v1.9 decisions with the existing --observe flag; no action-changing adapter.
Compare the existing reviewer with --feedback on the exact same snapshots. Two offline passes
per arm, alternating order, keep all errors and unsupported flags. No additional negotiations
are needed for reviewer repetitions. Use only these two practice sessions; no final/rehearsal.

Checks: source-backed prefix-only state, no cross-case leakage, superseded quotations, distinct
packages, transport feedback versus supplier feedback, unchanged buyer actions, normal existing
review behavior with the flag absent. Manually inspect retained findings and targeted G03/G06
duration/clause misses, including whether earlier concerns were already addressed in the current
draft. A cited source or model confidence is not proof of correctness. Do not count ordinary
lower buyer bids as missed conditions. Report raw flags separately from usable observations.

This is development evidence on known cases and two reviewer repetitions, not a measured score
improvement or a generalization claim. Observation-only review cannot change the saved scores.
No model prompt tuning after seeing the comparative outputs in this experiment.
