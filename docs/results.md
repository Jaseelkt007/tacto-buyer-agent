# Results

Score per case and version, one hosted pass each (`uv run python scripts/compare.py --by note`).
Regenerate this table after every benchmark pass.

| case | type | kit llm | v1.1 | v1.3 | v1.4 | v1.5b | v1.6b/c | v1.7 | **v1.7b** | v1.7b −patience |
|---|---|---|---|---|---|---|---|---|---|---|
| P01 | price increase | 0.748 | 0.382 | 0.935 | 0.963 | 0.914 | 0.914 | 0.914 | **0.914** | 0.914 |
| P02 | price increase | | 0.264 | 0.507 | 0.365 | 0.499 | 0.499 | 0.465 | **0.465** | 0.504 |
| P03 | renewal | | 0.923 | 0.923 | 0.923 | 0.923 | 0.923 | 0.923 | **0.923** | 0.923 |
| P04 | renewal | | 0.056 | 0.860 | 0.860 | 0.860 | 0.860 | 0.860 | **0.860** | 0.860 |
| P05 | RFQ, 3 bidders | 0.000 | 0.548 | 0.548 | 0.654 | 0.654 | 0.716 | 0.762 | **0.710** | 0.659 |
| P07 | bundling | | 0.740 | 0.736 | 0.717 | 0.717 | 0.717 | 0.743 | **0.743** | 0.743 |
| P08 | raw material | | 0.210 | 0.549 | 0.626 | 0.626 | 0.626 | 0.538 | **0.615** | 0.604 |
| P10 | capacity | | 0.570 | 0.570 | 0.686 | 0.686 | 0.686 | 0.671 | **0.671** | 0.679 |
| P11 | quality | | 0.626 | 0.626 | 0.710 | 0.710 | 0.710 | 0.710 | **0.710** | 0.710 |
| P18 | raw material | | 0.520 | 0.520 | 0.520 | 0.520 | 0.520 | 0.497 | **0.564** | 0.564 |
| **mean** | | 37.4 (2 cases) | 48.4 | 67.7 | 70.2 | 71.1 | 71.7 | 70.8 | **71.8** | 71.6 |

Later passes (one hosted run each):

| case | v1.7c | v2.0 tactician (rungs chosen by the model) |
|---|---|---|
| P01 | 0.914 | 0.817 |
| P02 | 0.499 | **0.734** |
| P03 | 0.923 | 0.923 |
| P04 | 0.860 | 0.860 |
| P05 | 0.710 | 0.710 |
| P07 | 0.743 | 0.736 |
| P08 | 0.604 | 0.560 |
| P10 | 0.679 | 0.694 |
| P11 | 0.710 | 0.710 |
| P18 | 0.632 | 0.483 |
| **mean** | **72.7** | 72.3 |

v1.7c + case plan (zone 1): 66.3. Sandbox: v1.7c D01 0.883 / D02 0.534; v1.8 flags the same; v2.0
tactician D01 0.772 (step-backs), then 0.863 with the no-step-back rungs.

v1.2 (31.5, pushed after final_offer) and v1.5 (60.9, a concurrency bug) are in the decision log.
v1.6b/c: the v1.6b pass (mean 71.4) with v1.6c's P05 (0.716). v1.7b = v1.7 with the clause fix (the
supplier's demanded clause beats a cheaper-looking alternative deadband).

**Noise:** the bots do not answer identical messages identically across runs. P05 (three bidders)
scored 0.762 and 0.710 with the same code; the single-supplier cases repeated exactly except P08.
Read a difference below about 0.05 in P05 as noise.

Sandbox (free): v1.2 D01 0.909, D02 0.461 · v1.6 D01 0.883, D02 0.461 · v1.6b D01 0.883, D02 0.482 ·
**v1.7 D01 0.902, D02 0.534** (all flags off: 0.883 / 0.482; per-flag ablation in the decision log).

Practice budget: 400 sessions per rolling 24 h. After the v1.7 / v1.7b passes on Sat 24 Oct: 295
left. A full hosted pass costs 10; the sandbox is free.
