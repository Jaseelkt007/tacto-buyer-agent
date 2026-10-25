# Reconsideration comparison

Two passes per arm; synthetic development evidence, not a leaderboard estimate.
Supplier calls are stochastic. Report fallback-contaminated runs rather than deleting them.

| Arm | Passes | Mean / 100 | Range | Alternatives sent | Gate calls | Adapter errors | Supplier fallbacks |
|---|---:|---:|---|---:|---:|---:|---:|
| decision | 2 | 80.10 | [79.6, 80.6] | 10 | 10 | 0 | 1 |
| deterministic | 2 | 79.60 | [79.5, 79.7] | 8 | 0 | 0 | 1 |
| off | 2 | 79.85 | [79.6, 80.1] | 0 | 0 | 0 | 0 |

| Run | Score | Deals | Alternatives | Gate calls | Max gate seconds |
|---|---:|---:|---:|---:|---:|
| pass1-decision | 79.6 | 10 | 5 | 5 | 0.5723 |
| pass1-deterministic | 79.7 | 10 | 4 | 0 | None |
| pass1-off | 79.6 | 10 | 0 | 0 | None |
| pass2-decision | 80.6 | 10 | 5 | 5 | 0.3156 |
| pass2-deterministic | 79.5 | 10 | 4 | 0 | None |
| pass2-off | 80.1 | 10 | 0 | 0 | None |
