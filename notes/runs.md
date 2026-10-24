# Run log

One row per benchmark run (`scripts/bench.py`). Newest at the bottom.

| when (UTC) | case | agent | commit | deal | score | c_open | c_deal | c_best | rounds | secs | replay | note |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10-24 13:52 | case:D01 | naive | 7a4fa1c-dirty | True | 0.200 | 448,811 | 440,757 | 408,624 | 4 | 1.300 | [replay](https://arena.tacto.ai/replay/7d11b9bfbbf9ff0e) | baseline naive |
| 10-24 13:52 | case:D02 | naive | 7a4fa1c-dirty | True | 0.250 | 214,296 | 199,884 | 156,739 | 5 | 1.900 | [replay](https://arena.tacto.ai/replay/564107d1143ecf40) | baseline naive |
| 10-24 13:55 | case:D01 | llm | 7a4fa1c-dirty | True | 0.725 | 448,811 | 419,679 | 408,624 | 6 | 185 | [replay](https://arena.tacto.ai/replay/8c9682242b06d2c9) | baseline kit llm |
| 10-24 13:56 | case:D02 | llm | 7a4fa1c-dirty | True | 0.347 | 214,296 | 194,322 | 156,739 | 9 | 237 | [replay](https://arena.tacto.ai/replay/28780d4bccad5ebe) | baseline kit llm |
| 10-24 13:59 | case:D01 | procudeal | 7a4fa1c-dirty | True | 0.744 | 448,811 | 418,911 | 408,624 | 6 | 173 | [replay](https://arena.tacto.ai/replay/22a3f49b0d4af3f6) | phase0 wrapper |
| 10-24 13:59 | case:D02 | procudeal | 7a4fa1c-dirty | True | 0.357 | 214,296 | 193,776 | 156,739 | 7 | 187 | [replay](https://arena.tacto.ai/replay/2da2b1ca2c66afc0) | phase0 wrapper |
| 10-24 14:00 | case:P01 | naive | 7a4fa1c-dirty | True | 0.597 | 1,153,780 | 1,119,764 | 1,096,816 | 5 | 2 | [replay](https://arena.tacto.ai/replay/ca12c76d75699b6b) | baseline naive |
| 10-24 14:00 | case:P05 | naive | 7a4fa1c-dirty | True | 0.000 | 305,545 | 261,717 | 223,424 | 5 | 2 | [replay](https://arena.tacto.ai/replay/622e8adba040ab1d) | baseline naive |
| 10-24 14:03 | case:P01 | llm | 7a4fa1c-dirty | True | 0.748 | 1,153,780 | 1,111,182 | 1,096,816 | 5 | 182 | [replay](https://arena.tacto.ai/replay/35eca3b288927ac1) | baseline kit llm |
| 10-24 14:04 | case:P05 | llm | 7a4fa1c-dirty | False | 0.000 | 305,545 |  | 223,424 | 12 | 268 | [replay](https://arena.tacto.ai/replay/3cc6affa8be4df49) | baseline kit llm |
