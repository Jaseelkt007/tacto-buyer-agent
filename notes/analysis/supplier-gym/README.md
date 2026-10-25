# Sunday-inspired local supplier practice

Ten fictional cases, six supplier identities, twelve independent supplier instances. Eight cases
have one supplier; two RFQs have two. Supplier LLM choices are constrained by private financial
profiles. The production v1.9 buyer is unchanged by this work.

## Evidence directories

- `reference-suite/`: ten completed deterministic-control episodes; nine deals and the intentional
  alternative-source walkaway. Published offers passed the independent supplier-limit recheck and
  matched recorded choices. This is not evidence about LLM quality.
- `wave-480/`: one eight-minute local wave using unchanged `play_waves`, ten parallel cases and
  twelve supplier instances. **93.6/100 synthetic score**, nine deals, one intended walkaway;
  all cases finished within 39.376 seconds. Ten supplier requests overlapped at peak. All 57 model
  calls succeeded without fallback; no HTTP errors, thread timeouts, cap closures or failed
  must-haves. The runner waited for the full cap and exited automatically. Score/offer checks
  passed. See its summary and report for per-case scores, timing and request overlap.
- `llm-smoke/`: first successful LLM episode, five model calls, no fallback.
- `llm-suite/`: first ten-case LLM diagnostic, 53 model calls, no fallbacks, nine deals and one
  walkaway. Inspection caught missing fixed contract dates in the model context, despite code
  correctly applying those dates to financial limits. This run is retained as diagnostic evidence.
- `llm-enquiry-suite/`: corrected run; the model sees fixed enquiry terms, standard terms and
  allowed options, while buyer alternatives, budgets and internal traces remain excluded. All ten
  cases completed: nine deals, one intentional walkaway, 57 model calls, no model/buyer fallbacks
  and no broken must-haves. Every published offer passed financial and selected-action checks.
- `reference-smoke/` and `reference-debug/`: interrupted local attempts because the sandbox blocked
  the FastAPI test client's async/thread wake-up. They are not completed test episodes.
- `reference-smoke-unrestricted/`: the same local smoke test completed after execution permission
  was granted. No external service was used in reference mode.

Run `scripts/analyse_supplier_gym.py <run-directory>` from `starter-kit/` to regenerate that run's
readable report and reconciliation. It compares every supplier term sheet with private financial
limits and each published counteroffer with the recorded selected action.

## Interpretation

These cases test release ingestion, PDFs, email API semantics, financial package tradeoffs and
closing. They do not model the hosted supplier bots or measure leaderboard performance. Private
costs, financing rates, capacity and RFQ qualification are invented assumptions, separately stored
from public case files. The individual runs did not start a rehearsal. `wave-480` is the separately
requested timed local wave; no hosted arena session was started by any of these runs.

In the financing control the buyer still trades early payment despite inexpensive private funding.
That creates a gap against the synthetic financial benchmark, but is not by itself proof of a
buyer bug: the private funding rate is not visible, and suppliers in this first suite do not issue
simultaneous comparable payment quotes. Testing v1.9's rate inference needs that additional feature.

The date-paired steel cases distinguish hedged 2027 from unhedged 2028 in supplier economics. After
the prompt correction, the supplier explicitly recognizes post-2027 exposure. Both buyer deals
still use fixed pricing in the model run; the 2028 domain contains a cheaper indexed package.
This is an investigation target, not justification for a case-specific buyer rule.

The recycling sentence does not change supplier economics. Reference controls give identical
outcomes. A single LLM pair cannot establish general invariance to irrelevant news.
