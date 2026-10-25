# Default integration verification

The user requested advisory interpretation as the default after the live timing check. `ProcuDealAgent` now constructs an independent `ReplyInterpreter` for each case unless explicitly disabled. The regular CLI factory, final-wave runner, benchmark runner, and synthetic-wave runner share that constructor.

- Default: `PROCUDEAL_REPLY_INTERPRETATION=on` (also used when the variable is absent).
- Opt-out: `PROCUDEAL_REPLY_INTERPRETATION=off`.
- Programmatic baseline: `ProcuDealAgent(..., interpret_replies=False)`.
- Evaluation override: `--interpret-replies` / `--no-interpret-replies`.
- Model and deadline unchanged: `gpt-6.1-sol`, eight seconds per supplier read.
- Binding terms, pricing, claims and acceptance remain controlled by the existing policy. Interpretations are advisory only.

Verification on the final change:

1. Full suite: **265 passed, 1 skipped in 37.30 seconds**.
2. Dedicated test constructs agents through `cli.agent_factory('procudeal', ...)` with no interpretation flag and verifies isolated interpreters and a recorded reading.
3. Dedicated test runs the real `play_waves` loop against two local cases using the production factory and an injected model response. Both cases end, both use the interpreter, and the simulator reports no thread timeout. This opens no hosted sessions.
4. Opt-out and invalid configuration checks pass. Unit tests opt out by default to avoid paid network calls; the dedicated default tests explicitly remove that override.
5. Actual local `.env`/data factory check: interpreter enabled, OpenAI credential present, Sunday release loaded. Only booleans were printed; no secrets or API calls.
6. Changed Python files pass lint; tracked diffs pass whitespace checks. README commands agree with CLI help.

The root README and kit final command now select `--agent procudeal` explicitly. No actual final or rehearsal sessions were opened. No commit or push was performed. Earlier live timing/score evidence remains in [the finalization report](runs/finalization-r01/report.md); this constructor change creates no new score measurement.
