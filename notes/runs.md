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
