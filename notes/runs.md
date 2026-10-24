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
| 10-24 17:05 | case:D01 | procudeal | e9c9e4e-dirty | True | 0.883 | 448,811 | 413,341 | 408,624 | 5 | 74 | [replay](https://arena.tacto.ai/replay/afa15b1840b52537) | engine v1.6 |
| 10-24 17:08 | case:D02 | procudeal | e9c9e4e-dirty | True | 0.461 | 214,296 | 187,768 | 156,739 | 11 | 243 | [replay](https://arena.tacto.ai/replay/76dfbaad56efa7b6) | engine v1.6 |
| 10-24 17:09 | case:D01 | procudeal | e9c9e4e-dirty | True | 0.883 | 448,811 | 413,341 | 408,624 | 5 | 5 | [replay](https://arena.tacto.ai/replay/8c3ca29f375ee23f) | engine v1.6b |
| 10-24 17:13 | case:D02 | procudeal | e9c9e4e-dirty | True | 0.482 | 214,296 | 186,560 | 156,739 | 11 | 246 | [replay](https://arena.tacto.ai/replay/fcaa96694c4fb15a) | engine v1.6b |
| 10-24 17:19 | case:P01 | procudeal | f358cfe | True | 0.914 | 1,153,780 | 1,101,723 | 1,096,816 | 3 | 3 | [replay](https://arena.tacto.ai/replay/1c1ff8bfee6cb36a) | engine v1.6b |
| 10-24 17:19 | case:P02 | procudeal | f358cfe | True | 0.499 | 2,282,867 | 2,259,245 | 2,235,514 | 5 | 4 | [replay](https://arena.tacto.ai/replay/c9761d03a08e4e21) | engine v1.6b |
| 10-24 17:19 | case:P03 | procudeal | f358cfe | True | 0.923 | 4,246,314 | 3,935,069 | 3,909,043 | 3 | 3 | [replay](https://arena.tacto.ai/replay/e2aceca7a4750e3b) | engine v1.6b |
| 10-24 17:19 | case:P04 | procudeal | f358cfe | True | 0.860 | 198,846 | 196,853 | 196,529 | 3 | 3 | [replay](https://arena.tacto.ai/replay/8b7b91eb40422d5f) | engine v1.6b |
| 10-24 17:22 | case:P05 | procudeal | f358cfe | True | 0.685 | 305,545 | 249,256 | 223,424 | 10 | 177 | [replay](https://arena.tacto.ai/replay/14026dde7013a3d3) | engine v1.6b |
| 10-24 17:19 | case:P07 | procudeal | f358cfe | True | 0.717 | 391,027 | 325,229 | 299,241 | 4 | 4 | [replay](https://arena.tacto.ai/replay/b37ed07e581aecc4) | engine v1.6b |
| 10-24 17:19 | case:P08 | procudeal | f358cfe | True | 0.626 | 1,135,887 | 1,025,948 | 960,309 | 5 | 4 | [replay](https://arena.tacto.ai/replay/414bea9cf72743bf) | engine v1.6b |
| 10-24 17:19 | case:P10 | procudeal | f358cfe | True | 0.686 | 1,932,492 | 1,518,252 | 1,328,927 | 3 | 4 | [replay](https://arena.tacto.ai/replay/b4a8a8a314596aa9) | engine v1.6b |
| 10-24 17:19 | case:P11 | procudeal | f358cfe | True | 0.710 | 817,578 | 750,082 | 722,500 | 8 | 5 | [replay](https://arena.tacto.ai/replay/3c3e165e1d91f415) | engine v1.6b |
| 10-24 17:19 | case:P18 | procudeal | f358cfe | True | 0.520 | 295,173 | 257,459 | 222,651 | 4 | 2 | [replay](https://arena.tacto.ai/replay/dd10aaa45ba1e186) | engine v1.6b |
| 10-24 17:33 | case:D02 | procudeal | f358cfe-dirty | True | 0.482 | 214,296 | 186,560 | 156,739 | 11 | 19 | [replay](https://arena.tacto.ai/replay/02fc0d9c0e19c284) | engine v1.6c |
| 10-24 17:33 | case:P05 | procudeal | f358cfe-dirty | True | 0.716 | 305,545 | 246,710 | 223,424 | 8 | 56 | [replay](https://arena.tacto.ai/replay/2e2636cb98a78a1f) | engine v1.6c |
| 10-24 19:01 | case:D01 | procudeal | 5cab21a-dirty | True | 0.869 | 448,811 | 413,877 | 408,624 | 7 | 106 | [replay](https://arena.tacto.ai/replay/66928532c4648d0d) | engine v1.7 |
| 10-24 19:04 | case:D02 | procudeal | 5cab21a-dirty | True | 0.503 | 214,296 | 185,352 | 156,739 | 11 | 298 | [replay](https://arena.tacto.ai/replay/bfd23aa496e9c569) | engine v1.7 |
| 10-24 19:06 | case:D01 | procudeal | 5cab21a-dirty | True | 0.902 | 448,811 | 412,552 | 408,624 | 7 | 53 | [replay](https://arena.tacto.ai/replay/916132859df94dc2) | engine v1.7 |
| 10-24 19:08 | case:D02 | procudeal | 5cab21a-dirty | True | 0.534 | 214,296 | 183,580 | 156,739 | 11 | 174 | [replay](https://arena.tacto.ai/replay/edbe24a7ee8271a6) | engine v1.7 |
| 10-24 19:08 | case:D01 | procudeal | 5cab21a-dirty | True | 0.883 | 448,811 | 413,341 | 408,624 | 5 | 2 | [replay](https://arena.tacto.ai/replay/620fea18faa2642c) | engine v1.7 flags-off |
| 10-24 19:08 | case:D02 | procudeal | 5cab21a-dirty | True | 0.482 | 214,296 | 186,560 | 156,739 | 11 | 3 | [replay](https://arena.tacto.ai/replay/4fd913e5a251feb9) | engine v1.7 flags-off |
| 10-24 19:08 | case:D01 | procudeal | 5cab21a-dirty | True | 0.902 | 448,811 | 412,552 | 408,624 | 7 | 2 | [replay](https://arena.tacto.ai/replay/50f2cc1808927e07) | v1.7 -friendly_ties |
| 10-24 19:13 | case:D02 | procudeal | 5cab21a-dirty | True | 0.524 | 214,296 | 184,144 | 156,739 | 11 | 267 | [replay](https://arena.tacto.ai/replay/ec3b332c44b50419) | v1.7 -friendly_ties |
| 10-24 19:13 | case:D01 | procudeal | 5cab21a-dirty | True | 0.920 | 448,811 | 411,832 | 408,624 | 6 | 47 | [replay](https://arena.tacto.ai/replay/c9b52789597b8cbc) | v1.7 -single_sheet |
| 10-24 19:17 | case:D02 | procudeal | 5cab21a-dirty | True | 0.534 | 214,296 | 183,580 | 156,739 | 11 | 255 | [replay](https://arena.tacto.ai/replay/34cace092666931c) | v1.7 -single_sheet |
| 10-24 19:18 | case:D01 | procudeal | 5cab21a-dirty | True | 0.883 | 448,811 | 413,341 | 408,624 | 5 | 40 | [replay](https://arena.tacto.ai/replay/c0f3a0bf29678252) | v1.7 -patience |
| 10-24 19:17 | case:D02 | procudeal | 5cab21a-dirty | True | 0.534 | 214,296 | 183,580 | 156,739 | 11 | 2 | [replay](https://arena.tacto.ai/replay/395166d644701378) | v1.7 -patience |
| 10-24 19:18 | case:D01 | procudeal | 5cab21a-dirty | True | 0.902 | 448,811 | 412,552 | 408,624 | 7 | 2 | [replay](https://arena.tacto.ai/replay/a8a2eece069e89cb) | v1.7 -strict_accept |
| 10-24 19:18 | case:D02 | procudeal | 5cab21a-dirty | True | 0.534 | 214,296 | 183,580 | 156,739 | 11 | 4 | [replay](https://arena.tacto.ai/replay/b3292beb7ab9fe93) | v1.7 -strict_accept |
| 10-24 19:18 | case:D01 | procudeal | 5cab21a-dirty | True | 0.902 | 448,811 | 412,552 | 408,624 | 7 | 2 | [replay](https://arena.tacto.ai/replay/9d391dd108e38c0a) | v1.7 -rich_value |
| 10-24 19:20 | case:D02 | procudeal | 5cab21a-dirty | True | 0.492 | 214,296 | 186,005 | 156,739 | 11 | 151 | [replay](https://arena.tacto.ai/replay/e9707b3ace757426) | v1.7 -rich_value |
| 10-24 19:38 | case:D01 | procudeal | 5cab21a-dirty | True | 0.902 | 448,811 | 412,552 | 408,624 | 7 | 2 | [replay](https://arena.tacto.ai/replay/f79ec5163e5d6dc2) | engine v1.7 |
| 10-24 19:38 | case:D02 | procudeal | 5cab21a-dirty | True | 0.534 | 214,296 | 183,580 | 156,739 | 11 | 3 | [replay](https://arena.tacto.ai/replay/676a56fb8854e903) | engine v1.7 |
| 10-24 19:38 | case:D01 | procudeal | 5cab21a-dirty | True | 0.883 | 448,811 | 413,341 | 408,624 | 5 | 2 | [replay](https://arena.tacto.ai/replay/e304e721847d362d) | engine v1.7 flags-off |
| 10-24 19:38 | case:D02 | procudeal | 5cab21a-dirty | True | 0.482 | 214,296 | 186,560 | 156,739 | 11 | 3 | [replay](https://arena.tacto.ai/replay/b128a7f29bf0541d) | engine v1.7 flags-off |
| 10-24 19:43 | case:P01 | procudeal | 8ab7b67 | True | 0.914 | 1,153,780 | 1,101,723 | 1,096,816 | 3 | 26 | [replay](https://arena.tacto.ai/replay/ffa7a4c3caa8d217) | engine v1.7 |
| 10-24 19:45 | case:P02 | procudeal | 8ab7b67 | True | 0.465 | 2,282,867 | 2,260,865 | 2,235,514 | 5 | 118 | [replay](https://arena.tacto.ai/replay/926e585a1148c82c) | engine v1.7 |
| 10-24 19:45 | case:P03 | procudeal | 8ab7b67 | True | 0.923 | 4,246,314 | 3,935,069 | 3,909,043 | 4 | 117 | [replay](https://arena.tacto.ai/replay/35c3f123bfa8b03b) | engine v1.7 |
| 10-24 19:44 | case:P04 | procudeal | 8ab7b67 | True | 0.860 | 198,846 | 196,853 | 196,529 | 4 | 65 | [replay](https://arena.tacto.ai/replay/d3ab84c6a7997fef) | engine v1.7 |
| 10-24 19:49 | case:P05 | procudeal | 8ab7b67 | True | 0.762 | 305,545 | 242,976 | 223,424 | 18 | 379 | [replay](https://arena.tacto.ai/replay/5fe54d947e4fd9d2) | engine v1.7 |
| 10-24 19:45 | case:P07 | procudeal | 8ab7b67 | True | 0.743 | 391,027 | 322,829 | 299,241 | 4 | 82 | [replay](https://arena.tacto.ai/replay/2a31ead87a1cf0f1) | engine v1.7 |
| 10-24 19:46 | case:P08 | procudeal | 8ab7b67 | True | 0.538 | 1,135,887 | 1,041,432 | 960,309 | 5 | 156 | [replay](https://arena.tacto.ai/replay/b7c1504adb46f3b8) | engine v1.7 |
| 10-24 19:46 | case:P10 | procudeal | 8ab7b67 | True | 0.671 | 1,932,492 | 1,527,674 | 1,328,927 | 3 | 65 | [replay](https://arena.tacto.ai/replay/579b1f5b8b3ad2e5) | engine v1.7 |
| 10-24 19:48 | case:P11 | procudeal | 8ab7b67 | True | 0.710 | 817,578 | 750,082 | 722,500 | 8 | 171 | [replay](https://arena.tacto.ai/replay/e1883716a501c405) | engine v1.7 |
| 10-24 19:46 | case:P18 | procudeal | 8ab7b67 | True | 0.497 | 295,173 | 259,133 | 222,651 | 4 | 90 | [replay](https://arena.tacto.ai/replay/b06c73ffcdf3f92d) | engine v1.7 |
| 10-24 19:52 | case:P01 | procudeal | 8ab7b67-dirty | True | 0.914 | 1,153,780 | 1,101,723 | 1,096,816 | 3 | 3 | [replay](https://arena.tacto.ai/replay/6a0e3b52abf8659d) | engine v1.7b |
| 10-24 19:52 | case:P02 | procudeal | 8ab7b67-dirty | True | 0.465 | 2,282,867 | 2,260,865 | 2,235,514 | 5 | 12 | [replay](https://arena.tacto.ai/replay/68e9e3bef0563516) | engine v1.7b |
| 10-24 19:52 | case:P03 | procudeal | 8ab7b67-dirty | True | 0.923 | 4,246,314 | 3,935,069 | 3,909,043 | 4 | 11 | [replay](https://arena.tacto.ai/replay/0dffcc9b45f62313) | engine v1.7b |
| 10-24 19:52 | case:P04 | procudeal | 8ab7b67-dirty | True | 0.860 | 198,846 | 196,853 | 196,529 | 4 | 11 | [replay](https://arena.tacto.ai/replay/db21396fc2c59d60) | engine v1.7b |
| 10-24 19:56 | case:P05 | procudeal | 8ab7b67-dirty | True | 0.710 | 305,545 | 247,219 | 223,424 | 14 | 254 | [replay](https://arena.tacto.ai/replay/54a07f2d6e98361f) | engine v1.7b |
| 10-24 19:52 | case:P07 | procudeal | 8ab7b67-dirty | True | 0.743 | 391,027 | 322,829 | 299,241 | 4 | 13 | [replay](https://arena.tacto.ai/replay/ad31154e44acbfbc) | engine v1.7b |
| 10-24 19:54 | case:P08 | procudeal | 8ab7b67-dirty | True | 0.615 | 1,135,887 | 1,027,891 | 960,309 | 6 | 89 | [replay](https://arena.tacto.ai/replay/44f0daef02a305f9) | engine v1.7b |
| 10-24 19:52 | case:P10 | procudeal | 8ab7b67-dirty | True | 0.671 | 1,932,492 | 1,527,674 | 1,328,927 | 3 | 5 | [replay](https://arena.tacto.ai/replay/52e71378ea7a4542) | engine v1.7b |
| 10-24 19:52 | case:P11 | procudeal | 8ab7b67-dirty | True | 0.710 | 817,578 | 750,082 | 722,500 | 8 | 11 | [replay](https://arena.tacto.ai/replay/5016cad16f2361cf) | engine v1.7b |
| 10-24 19:54 | case:P18 | procudeal | 8ab7b67-dirty | True | 0.564 | 295,173 | 254,244 | 222,651 | 5 | 68 | [replay](https://arena.tacto.ai/replay/02fc2e8f0b9d6210) | engine v1.7b |
| 10-24 19:52 | case:P01 | procudeal | 8ab7b67-dirty | True | 0.914 | 1,153,780 | 1,101,723 | 1,096,816 | 3 | 3 | [replay](https://arena.tacto.ai/replay/da105d0b32091188) | v1.7b -patience |
| 10-24 19:53 | case:P02 | procudeal | 8ab7b67-dirty | True | 0.504 | 2,282,867 | 2,258,979 | 2,235,514 | 5 | 56 | [replay](https://arena.tacto.ai/replay/00961be74eff740f) | v1.7b -patience |
| 10-24 19:52 | case:P03 | procudeal | 8ab7b67-dirty | True | 0.923 | 4,246,314 | 3,935,069 | 3,909,043 | 4 | 3 | [replay](https://arena.tacto.ai/replay/29e7fe0e70cecec2) | v1.7b -patience |
| 10-24 19:52 | case:P04 | procudeal | 8ab7b67-dirty | True | 0.860 | 198,846 | 196,853 | 196,529 | 4 | 17 | [replay](https://arena.tacto.ai/replay/116cd9fd0026943a) | v1.7b -patience |
| 10-24 19:57 | case:P05 | procudeal | 8ab7b67-dirty | True | 0.659 | 305,545 | 251,462 | 223,424 | 14 | 274 | [replay](https://arena.tacto.ai/replay/c8bafd96c437a00e) | v1.7b -patience |
| 10-24 19:52 | case:P07 | procudeal | 8ab7b67-dirty | True | 0.743 | 391,027 | 322,829 | 299,241 | 4 | 2 | [replay](https://arena.tacto.ai/replay/6bde64204e468dc0) | v1.7b -patience |
| 10-24 19:54 | case:P08 | procudeal | 8ab7b67-dirty | True | 0.604 | 1,135,887 | 1,029,835 | 960,309 | 6 | 88 | [replay](https://arena.tacto.ai/replay/4f6698a6ffe2bcd4) | v1.7b -patience |
| 10-24 19:52 | case:P10 | procudeal | 8ab7b67-dirty | True | 0.679 | 1,932,492 | 1,522,963 | 1,328,927 | 3 | 17 | [replay](https://arena.tacto.ai/replay/fa357ed1b8e78ef6) | v1.7b -patience |
| 10-24 19:52 | case:P11 | procudeal | 8ab7b67-dirty | True | 0.710 | 817,578 | 750,082 | 722,500 | 8 | 10 | [replay](https://arena.tacto.ai/replay/e23d0bbccab06203) | v1.7b -patience |
| 10-24 19:54 | case:P18 | procudeal | 8ab7b67-dirty | True | 0.564 | 295,173 | 254,244 | 222,651 | 5 | 78 | [replay](https://arena.tacto.ai/replay/605b064ccdf599cd) | v1.7b -patience |
