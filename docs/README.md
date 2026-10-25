# ProcuDeal docs

Documentation of our buyer agent for the Tacto Negotiation Arena. **Keep it current:** every
implementation change updates these pages first, or in the same commit (see `CLAUDE.md`).

| Page | What it covers |
|---|---|
| [implementation.md](implementation.md) | Architecture, every module, the decision flow of one case, constants, how to run and test |
| [decision-log.md](decision-log.md) | What we changed, why, and what it did to the score: one entry per engine version |
| [results.md](results.md) | Score tables per case and version, practice-session budget |
| [research.md](research.md) | The LLM layer's plan (four time zones) and zone 0 / zone 1 design |
| [findings.md](findings.md) | What we learned: test results, the P02 deep dive, the source audit of every number and rule, the hybrid requirements |

Related: the challenge rules live in `../brief/`, the team rules in `../CLAUDE.md`, the raw run
records in `../runs/` and the run log in `../notes/runs.md`.
