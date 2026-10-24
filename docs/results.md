# Results

Best score per case for each run note (`uv run python scripts/compare.py --by note`).
Regenerate this table after every benchmark pass.

| case | type | kit llm | v1.1 | v1.3 | v1.4 | v1.5 | **v1.5b** |
|---|---|---|---|---|---|---|---|
| P01 | price increase | 0.748 | 0.382 | 0.935 | 0.963 | 0.949 | **0.914** |
| P02 | price increase | | 0.264 | 0.507 | 0.365 | 0.365 | **0.499** |
| P03 | renewal | | 0.923 | 0.923 | 0.923 | 0.000 | **0.923** |
| P04 | renewal | | 0.056 | 0.860 | 0.860 | 0.860 | **0.860** |
| P05 | RFQ, 3 bidders | 0.000 | 0.548 | 0.548 | 0.654 | 0.654 | **0.654** |
| P07 | bundling | | 0.740 | 0.736 | 0.717 | 0.717 | **0.717** |
| P08 | raw material | | 0.210 | 0.549 | 0.626 | 0.626 | **0.626** |
| P10 | capacity | | 0.570 | 0.570 | 0.686 | 0.686 | **0.686** |
| P11 | quality | | 0.626 | 0.626 | 0.710 | 0.710 | **0.710** |
| P18 | raw material | | 0.520 | 0.520 | 0.520 | 0.520 | **0.520** |
| **mean** | | 37.4 (2 cases) | 48.4 | 67.7 | 70.2 | 60.9 | **71.1** |

v1.2 (31.5, pushed after final_offer) is in the decision log.

Sandbox (free): v1.2 D01 0.909, D02 0.461 · v1.6 D01 0.883, D02 0.461 · **v1.6b D01 0.883, D02 0.482**.
v1.6/v1.6b (RFQ tactics) have not been run on the hosted practice cases yet.

Practice budget: 200 sessions per rolling 24 h. After v1.5b on Sat 24 Oct: 136 left. A full hosted
pass costs 10; the sandbox is free.
