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
| 10-24 15:04 | case:D01 | procudeal | 0d34d9c-dirty | True | 0.649 | 448,811 | 422,736 | 408,624 | 5 | 170 | [replay](https://arena.tacto.ai/replay/5038c13c6ad06315) | engine v1 |
| 10-24 15:04 | case:D02 | procudeal | 0d34d9c-dirty | True | 0.229 | 214,296 | 201,088 | 156,739 | 8 | 222 | [replay](https://arena.tacto.ai/replay/ead8fb55a7bea6c1) | engine v1 |
| 10-24 15:07 | case:D01 | procudeal | 0d34d9c-dirty | True | 0.876 | 448,811 | 413,600 | 408,624 | 6 | 118 | [replay](https://arena.tacto.ai/replay/024fe5d410b14467) | engine v1.1 |
| 10-24 15:09 | case:D02 | procudeal | 0d34d9c-dirty | True | 0.462 | 214,296 | 187,720 | 156,739 | 10 | 266 | [replay](https://arena.tacto.ai/replay/eefde64d12b487df) | engine v1.1 |
| 10-24 15:10 | case:P01 | procudeal | 0d34d9c-dirty | True | 0.382 | 1,153,780 | 1,132,011 | 1,096,816 | 2 | 42 | [replay](https://arena.tacto.ai/replay/929b929572be0dd7) | engine v1.1 |
| 10-24 15:11 | case:P02 | procudeal | 0d34d9c-dirty | True | 0.264 | 2,282,867 | 2,270,369 | 2,235,514 | 5 | 86 | [replay](https://arena.tacto.ai/replay/81869c28490e9964) | engine v1.1 |
| 10-24 15:13 | case:P03 | procudeal | 0d34d9c-dirty | True | 0.923 | 4,246,314 | 3,935,069 | 3,909,043 | 6 | 181 | [replay](https://arena.tacto.ai/replay/83cbdc55fe118e1a) | engine v1.1 |
| 10-24 15:11 | case:P04 | procudeal | 0d34d9c-dirty | True | 0.056 | 198,846 | 198,716 | 196,529 | 4 | 69 | [replay](https://arena.tacto.ai/replay/2956c48e2673442e) | engine v1.1 |
| 10-24 15:13 | case:P05 | procudeal | 0d34d9c-dirty | True | 0.548 | 305,545 | 260,571 | 223,424 | 8 | 168 | [replay](https://arena.tacto.ai/replay/1fb01993a237c8ee) | engine v1.1 |
| 10-24 15:12 | case:P07 | procudeal | 0d34d9c-dirty | True | 0.740 | 391,027 | 323,061 | 299,241 | 4 | 74 | [replay](https://arena.tacto.ai/replay/6a86315077af07a4) | engine v1.1 |
| 10-24 15:12 | case:P08 | procudeal | 0d34d9c-dirty | True | 0.210 | 1,135,887 | 1,099,048 | 960,309 | 4 | 86 | [replay](https://arena.tacto.ai/replay/9886bd8c7779325c) | engine v1.1 |
| 10-24 15:12 | case:P10 | procudeal | 0d34d9c-dirty | True | 0.570 | 1,932,492 | 1,588,298 | 1,328,927 | 2 | 47 | [replay](https://arena.tacto.ai/replay/710ab64d46bc6c7f) | engine v1.1 |
| 10-24 15:15 | case:P11 | procudeal | 0d34d9c-dirty | True | 0.626 | 817,578 | 758,032 | 722,500 | 8 | 193 | [replay](https://arena.tacto.ai/replay/53bbbe0b16e0f85f) | engine v1.1 |
| 10-24 15:14 | case:P18 | procudeal | 0d34d9c-dirty | True | 0.520 | 295,173 | 257,459 | 222,651 | 4 | 83 | [replay](https://arena.tacto.ai/replay/693138064a4010d1) | engine v1.1 |
| 10-24 15:18 | case:D01 | procudeal | 0d34d9c-dirty | True | 0.909 | 448,811 | 412,286 | 408,624 | 6 | 89 | [replay](https://arena.tacto.ai/replay/654bab0da6147523) | engine v1.2 |
| 10-24 15:20 | case:D02 | procudeal | 0d34d9c-dirty | True | 0.461 | 214,296 | 187,768 | 156,739 | 10 | 211 | [replay](https://arena.tacto.ai/replay/35df82351dbfbd20) | engine v1.2 |
| 10-24 15:22 | case:P01 | procudeal | 0d34d9c-dirty | True | 0.935 | 1,153,780 | 1,100,518 | 1,096,816 | 3 | 60 | [replay](https://arena.tacto.ai/replay/c1fbbc1f79ca8122) | engine v1.2 |
| 10-24 15:23 | case:P02 | procudeal | 0d34d9c-dirty | False | 0.000 | 2,282,867 |  | 2,235,514 | 5 | 169 | [replay](https://arena.tacto.ai/replay/51f113fec68bd63c) | engine v1.2 |
| 10-24 15:23 | case:P03 | procudeal | 0d34d9c-dirty | True | 0.923 | 4,246,314 | 3,935,069 | 3,909,043 | 6 | 119 | [replay](https://arena.tacto.ai/replay/128d9617f67a6d0e) | engine v1.2 |
| 10-24 15:22 | case:P04 | procudeal | 0d34d9c-dirty | False | 0.000 | 198,846 |  | 196,529 | 3 | 80 | [replay](https://arena.tacto.ai/replay/419cec44cee2280d) | engine v1.2 |
| 10-24 15:21 | case:P05 | procudeal | 0d34d9c-dirty | True | 0.548 | 305,545 | 260,571 | 223,424 | 7 | 3 | [replay](https://arena.tacto.ai/replay/24075d217e9c6056) | engine v1.2 |
| 10-24 15:22 | case:P07 | procudeal | 0d34d9c-dirty | False | 0.121 | 391,027 |  | 299,241 | 4 | 70 | [replay](https://arena.tacto.ai/replay/0c581be26bcbdd45) | engine v1.2 |
| 10-24 15:23 | case:P08 | procudeal | 0d34d9c-dirty | False | 0.000 | 1,135,887 |  | 960,309 | 4 | 94 | [replay](https://arena.tacto.ai/replay/5acb8611d22160a5) | engine v1.2 |
| 10-24 15:22 | case:P10 | procudeal | 0d34d9c-dirty | False | 0.000 | 1,932,492 |  | 1,328,927 | 2 | 34 | [replay](https://arena.tacto.ai/replay/6a30ed3be0dd7829) | engine v1.2 |
| 10-24 15:22 | case:P11 | procudeal | 0d34d9c-dirty | True | 0.626 | 817,578 | 758,032 | 722,500 | 8 | 2 | [replay](https://arena.tacto.ai/replay/b90f48457b40d4dc) | engine v1.2 |
| 10-24 15:23 | case:P18 | procudeal | 0d34d9c-dirty | False | 0.000 | 295,173 |  | 222,651 | 4 | 82 | [replay](https://arena.tacto.ai/replay/f21073f64a6e6654) | engine v1.2 |
| 10-24 15:24 | case:P01 | procudeal | 0d34d9c-dirty | True | 0.935 | 1,153,780 | 1,100,518 | 1,096,816 | 3 | 4 | [replay](https://arena.tacto.ai/replay/7f148673a78904dc) | engine v1.3 |
| 10-24 15:24 | case:P02 | procudeal | 0d34d9c-dirty | True | 0.507 | 2,282,867 | 2,258,872 | 2,235,514 | 5 | 4 | [replay](https://arena.tacto.ai/replay/8400476452122360) | engine v1.3 |
| 10-24 15:24 | case:P03 | procudeal | 0d34d9c-dirty | True | 0.923 | 4,246,314 | 3,935,069 | 3,909,043 | 6 | 5 | [replay](https://arena.tacto.ai/replay/b816118ddeab8fd1) | engine v1.3 |
| 10-24 15:24 | case:P04 | procudeal | 0d34d9c-dirty | True | 0.860 | 198,846 | 196,853 | 196,529 | 3 | 3 | [replay](https://arena.tacto.ai/replay/546d7f1eef865861) | engine v1.3 |
| 10-24 15:24 | case:P05 | procudeal | 0d34d9c-dirty | True | 0.548 | 305,545 | 260,571 | 223,424 | 7 | 8 | [replay](https://arena.tacto.ai/replay/efadd89bc06387e2) | engine v1.3 |
| 10-24 15:24 | case:P07 | procudeal | 0d34d9c-dirty | True | 0.736 | 391,027 | 323,429 | 299,241 | 4 | 4 | [replay](https://arena.tacto.ai/replay/1a393b818f31e552) | engine v1.3 |
| 10-24 15:24 | case:P08 | procudeal | 0d34d9c-dirty | True | 0.549 | 1,135,887 | 1,039,550 | 960,309 | 4 | 4 | [replay](https://arena.tacto.ai/replay/d545e7223145380d) | engine v1.3 |
| 10-24 15:24 | case:P10 | procudeal | 0d34d9c-dirty | True | 0.570 | 1,932,492 | 1,588,298 | 1,328,927 | 2 | 3 | [replay](https://arena.tacto.ai/replay/5d264504b2bc6648) | engine v1.3 |
| 10-24 15:24 | case:P11 | procudeal | 0d34d9c-dirty | True | 0.626 | 817,578 | 758,032 | 722,500 | 8 | 5 | [replay](https://arena.tacto.ai/replay/1bd8c9ed9650945f) | engine v1.3 |
| 10-24 15:24 | case:P18 | procudeal | 0d34d9c-dirty | True | 0.520 | 295,173 | 257,459 | 222,651 | 4 | 3 | [replay](https://arena.tacto.ai/replay/012109dce902f484) | engine v1.3 |
| 10-24 16:21 | case:P01 | procudeal | fe06386-dirty | True | 0.963 | 1,153,780 | 1,098,934 | 1,096,816 | 3 | 39 | [replay](https://arena.tacto.ai/replay/66bd98c764be88ed) | engine v1.4 |
| 10-24 16:21 | case:P02 | procudeal | fe06386-dirty | True | 0.365 | 2,282,867 | 2,265,573 | 2,235,514 | 3 | 68 | [replay](https://arena.tacto.ai/replay/c026c5e9fa991937) | engine v1.4 |
| 10-24 16:21 | case:P03 | procudeal | fe06386-dirty | True | 0.923 | 4,246,314 | 3,935,069 | 3,909,043 | 3 | 54 | [replay](https://arena.tacto.ai/replay/2f479494fd9e3b53) | engine v1.4 |
| 10-24 16:20 | case:P04 | procudeal | fe06386-dirty | True | 0.860 | 198,846 | 196,853 | 196,529 | 3 | 3 | [replay](https://arena.tacto.ai/replay/f693832e4a6286f4) | engine v1.4 |
| 10-24 16:24 | case:P05 | procudeal | fe06386-dirty | True | 0.654 | 305,545 | 251,831 | 223,424 | 9 | 208 | [replay](https://arena.tacto.ai/replay/cbf2236f6a783d27) | engine v1.4 |
| 10-24 16:21 | case:P07 | procudeal | fe06386-dirty | True | 0.717 | 391,027 | 325,229 | 299,241 | 4 | 51 | [replay](https://arena.tacto.ai/replay/8b651861d33f9482) | engine v1.4 |
| 10-24 16:22 | case:P08 | procudeal | fe06386-dirty | True | 0.626 | 1,135,887 | 1,025,948 | 960,309 | 5 | 90 | [replay](https://arena.tacto.ai/replay/0af2cce3bed8f753) | engine v1.4 |
| 10-24 16:22 | case:P10 | procudeal | fe06386-dirty | True | 0.686 | 1,932,492 | 1,518,252 | 1,328,927 | 3 | 68 | [replay](https://arena.tacto.ai/replay/153e9c2480afa851) | engine v1.4 |
| 10-24 16:23 | case:P11 | procudeal | fe06386-dirty | True | 0.710 | 817,578 | 750,082 | 722,500 | 8 | 135 | [replay](https://arena.tacto.ai/replay/5c62cb4edfaccd22) | engine v1.4 |
| 10-24 16:23 | case:P18 | procudeal | fe06386-dirty | True | 0.520 | 295,173 | 257,459 | 222,651 | 4 | 84 | [replay](https://arena.tacto.ai/replay/d7e1a99553965059) | engine v1.4 |
| 10-24 16:28 | case:P01 | procudeal | fe06386-dirty | True | 0.949 | 1,153,780 | 1,099,723 | 1,096,816 | 6 | 197 | [replay](https://arena.tacto.ai/replay/0d3d95b3870568f5) | engine v1.5 |
| 10-24 16:25 | case:P02 | procudeal | fe06386-dirty | True | 0.365 | 2,282,867 | 2,265,573 | 2,235,514 | 3 | 25 | [replay](https://arena.tacto.ai/replay/0f25b61324e82baf) | engine v1.5 |
| 10-24 16:28 | case:P03 | procudeal | fe06386-dirty | False | 0.000 | 4,246,314 |  | 3,909,043 | 6 | 234 | [replay](https://arena.tacto.ai/replay/c6b2bf40508f3cc6) | engine v1.5 |
| 10-24 16:25 | case:P04 | procudeal | fe06386-dirty | True | 0.860 | 198,846 | 196,853 | 196,529 | 3 | 17 | [replay](https://arena.tacto.ai/replay/3e6c0fcdbab2ff75) | engine v1.5 |
| 10-24 16:26 | case:P05 | procudeal | fe06386-dirty | True | 0.654 | 305,545 | 251,831 | 223,424 | 7 | 47 | [replay](https://arena.tacto.ai/replay/f44781e665311299) | engine v1.5 |
| 10-24 16:26 | case:P07 | procudeal | fe06386-dirty | True | 0.717 | 391,027 | 325,229 | 299,241 | 4 | 32 | [replay](https://arena.tacto.ai/replay/c57e2605b4ac0f46) | engine v1.5 |
| 10-24 16:26 | case:P08 | procudeal | fe06386-dirty | True | 0.626 | 1,135,887 | 1,025,948 | 960,309 | 5 | 42 | [replay](https://arena.tacto.ai/replay/7ea8203ceb044f04) | engine v1.5 |
| 10-24 16:27 | case:P10 | procudeal | fe06386-dirty | True | 0.686 | 1,932,492 | 1,518,252 | 1,328,927 | 3 | 59 | [replay](https://arena.tacto.ai/replay/b3356662f836bf60) | engine v1.5 |
| 10-24 16:27 | case:P11 | procudeal | fe06386-dirty | True | 0.710 | 817,578 | 750,082 | 722,500 | 8 | 67 | [replay](https://arena.tacto.ai/replay/f0cd3caae4ece785) | engine v1.5 |
| 10-24 16:27 | case:P18 | procudeal | fe06386-dirty | True | 0.520 | 295,173 | 257,459 | 222,651 | 4 | 30 | [replay](https://arena.tacto.ai/replay/710cbfc4fc6dae22) | engine v1.5 |
| 10-24 16:32 | case:P01 | procudeal | fe06386-dirty | True | 0.914 | 1,153,780 | 1,101,723 | 1,096,816 | 3 | 45 | [replay](https://arena.tacto.ai/replay/ef1a2e3b6f394c8d) | engine v1.5b |
| 10-24 16:32 | case:P02 | procudeal | fe06386-dirty | True | 0.499 | 2,282,867 | 2,259,245 | 2,235,514 | 5 | 62 | [replay](https://arena.tacto.ai/replay/3f6acc36e537f094) | engine v1.5b |
| 10-24 16:32 | case:P03 | procudeal | fe06386-dirty | True | 0.923 | 4,246,314 | 3,935,069 | 3,909,043 | 3 | 54 | [replay](https://arena.tacto.ai/replay/0d0e844fcf1839a1) | engine v1.5b |
| 10-24 16:31 | case:P04 | procudeal | fe06386-dirty | True | 0.860 | 198,846 | 196,853 | 196,529 | 3 | 2 | [replay](https://arena.tacto.ai/replay/d78329f2c8b5a74f) | engine v1.5b |
| 10-24 16:31 | case:P05 | procudeal | fe06386-dirty | True | 0.654 | 305,545 | 251,831 | 223,424 | 7 | 4 | [replay](https://arena.tacto.ai/replay/99d24a103a1930cc) | engine v1.5b |
| 10-24 16:31 | case:P07 | procudeal | fe06386-dirty | True | 0.717 | 391,027 | 325,229 | 299,241 | 4 | 2 | [replay](https://arena.tacto.ai/replay/72aa10440a8f7024) | engine v1.5b |
| 10-24 16:31 | case:P08 | procudeal | fe06386-dirty | True | 0.626 | 1,135,887 | 1,025,948 | 960,309 | 5 | 2 | [replay](https://arena.tacto.ai/replay/bf30afff08811cd3) | engine v1.5b |
| 10-24 16:31 | case:P10 | procudeal | fe06386-dirty | True | 0.686 | 1,932,492 | 1,518,252 | 1,328,927 | 3 | 2 | [replay](https://arena.tacto.ai/replay/d4a5148d158f9ba1) | engine v1.5b |
| 10-24 16:31 | case:P11 | procudeal | fe06386-dirty | True | 0.710 | 817,578 | 750,082 | 722,500 | 8 | 3 | [replay](https://arena.tacto.ai/replay/40adc59e732410c7) | engine v1.5b |
| 10-24 16:31 | case:P18 | procudeal | fe06386-dirty | True | 0.520 | 295,173 | 257,459 | 222,651 | 4 | 2 | [replay](https://arena.tacto.ai/replay/e2c6ef25c6ad701a) | engine v1.5b |
