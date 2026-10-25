# Finalization check

Claim to check: in these end-to-end practice/synthetic runs, the interpreter-enabled buyer prepares each reply within the arena's 60-second per-thread limit, with explicit counts for model failures, buyer fallbacks, and thread timeouts. One pass is a readiness smoke test, not a latency guarantee or a measured improvement in negotiation quality.

Run four hosted practice cases P07/P08/P10/P18 against the saved v1.9 results, then one concurrent ten-case synthetic wave (including two-supplier cases). Keep the interpretation advisory, legacy reconsideration off, and the default final configuration unchanged. No final or rehearsal sessions.

Measure the complete agent.decide call, including interpretation, policy, writing, and observation capture. Supplier response/network waiting is outside that timer and must not be called buyer latency. Inspect server/simulator timeout records as a separate check. Preserve raw interpreter attempts so timeout fallbacks cannot masquerade as fast successful reads. Exercise the eight-second caller deadline. Compare observed scores, actions and final terms without claiming causal score gains from one run.

Completed: four hosted cases and all ten synthetic cases; 72 decisions, maximum 12.98 seconds, no thread timeouts, all valid deals. Three actual provider deadline expirations exercised the fallback, making an additional injected hang unnecessary. Tests passed outside the sandbox after an initial sandboxed simulator test stalled. Full evidence: `runs/finalization-r01/report.md`.
