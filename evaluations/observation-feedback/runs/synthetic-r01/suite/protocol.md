# Wave 02 protocol

Status: prospective authored stress suite. No buyer negotiation was run during construction.
This suite was designed after observing Wave 01, so it is not an independently sampled benchmark.

Freeze the v1.9 buyer and this suite before the first run. Run five complete repetitions if making
a robustness claim. Retain every failed case and model fallback. Use fresh output directories.
Do not change financial profiles, supplier prompts or the buyer between those repetitions.

G04/G05 change only opaque case/supplier IDs. Both suppliers are synthetic and have no package
history. G08/G09 change only the case ID and RFQ supplier ordering. These are paired controls,
not independent cases. Report total-cost and term differences across repetitions, not a pass/fail
judgment from one stochastic pair.

Primary outcomes: must-have compliance, cost versus the stated alternative, model/buyer errors,
and financial feasibility. Secondary outcomes: normalized synthetic score, absolute gap to the
private financial oracle, improvement over the cheapest acceptable opening/alternative baseline,
and sensitivity in the two paired controls. The oracle is not guaranteed to be offered by the LLM.

Several suppliers retain a positive final counteroffer margin. Concession pace and patience vary.
Private commitment penalties can reverse the usual benefit of a longer contract. All private
economics and newly created enquiries are hypothetical. Real source IDs are provenance for the
historical context, not evidence for the invented financial values or future opening emails.

This suite covers leverage cases only. It does not test supplier-health scoring, unrestricted
supplier prose, semantic claim verification, simultaneous payment-quote inference, hosted service
latency or multi-wave transitions. Quick completion does not validate waiting through eight minutes.

Detailed rationale and paper language: ../methodology.md. Any buyer tuning after these runs makes
this a development suite. Build a new suite before claiming fresh validation of the tuned buyer.
