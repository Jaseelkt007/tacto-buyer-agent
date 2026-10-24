# Results

Best score per case for each run note (`uv run python scripts/compare.py --by note`).
Regenerate this table after every benchmark pass.

| case | type | kit llm | v1.1 | v1.2 | **v1.3** |
|---|---|---|---|---|---|
| P01 | price increase | 0.748 | 0.382 | 0.935 | **0.935** |
| P02 | price increase | | 0.264 | 0.000 | **0.507** |
| P03 | renewal | | 0.923 | 0.923 | **0.923** |
| P04 | renewal | | 0.056 | 0.000 | **0.860** |
| P05 | RFQ, 3 bidders | 0.000 | 0.548 | 0.548 | **0.548** |
| P07 | bundling | | 0.740 | 0.121 | **0.736** |
| P08 | raw material | | 0.210 | 0.000 | **0.549** |
| P10 | capacity | | 0.570 | 0.000 | **0.570** |
| P11 | quality | | 0.626 | 0.626 | **0.626** |
| P18 | raw material | | 0.520 | 0.000 | **0.520** |
| **mean** | | 37.4 (2 cases) | 48.4 | 31.5 | **67.7** |
| D01 (sandbox) | price increase | 0.725 | 0.876 | 0.909 | |
| D02 (sandbox) | RFQ, 2 bidders | 0.347 | 0.462 | 0.461 | |

Practice budget: 200 sessions per rolling 24 h. After v1.3 on Sat 24 Oct: 166 left. A full hosted
pass costs 10; the sandbox is free.
