# Reply interpretation design review

Scores: 1 = poor, 5 = strong. These assess the written designs, not implemented behavior.

| Criterion | A: prefix projection | B: categorical selection |
|---|---:|---:|
| Exact supplier/offer scope; preference versus condition | 4 | 4 |
| Policy owns numbers/actions; bounded interpretation | 5 | 5 |
| Prior public exchanges without model self-reinforcement | 5 | 5 |
| Explicit ambiguity/failure behavior; unchanged default | 4 | 4 |
| Small useful consumer and meaningful tests | 3 | 3 |

**Select A as the base**, with revisions. Its single fresh projection can represent several simultaneously relevant conditions and matches the requested message-to-JSON interface. B's single winning observation loses information by design: two linked conditions cannot both survive, and its two model calls add latency without proving semantic correctness. Neither candidate establishes a justified active consumer for P08: structured current alternatives already establish the facts needed to evaluate them.

**Graft from B:** code owns the envelope, references, term values, and evidence text. The model selects registered source/package identifiers and bounded interpretation labels. Return a typed interpretation with an explicit provenance status, never a mutable patch to `Side`. The second evidence-selection call is optional rather than a required proof stage; another model judgment is not verification.

**Revise A's schema:** separate the authoritative package catalog from semantic observations. Do not expose model-written `availability` as if it could supersede the catalog. Each observation records its package, field, interpretation kind, evidence and unresolved scope. A package condition may cite prior messages, but the attachment of that condition to a newer quote remains a model interpretation; an exact quote is not proof of that attachment. Code-resolved values must not be described as extracted from prose when they actually came from a sheet.

**Recommended first implementation:** optional pre-decision interpretation, a typed read-only input to the existing policy, and policy diagnostics that compare extracted package conditions with the planned counteroffer. Record `already_addressed`, `different_counterproposal`, or `unresolved`, without interpreting a mismatch as a violation. This is a real consumer of the JSON and demonstrates how prior exchanges affect the interpretation without granting unproven authority. Default and unavailable results retain existing behavior. Include an offline CLI over captured public prefixes with no scores, proposed current action, private profiles, or future messages in model input.

Keep the deterministic alternative-filter correction as a separately identified policy change. Do not make an LLM permission flag the gateway to evaluating an authoritative current quote; doing so confounds code correction with semantic benefit. If an apply mode is built now, its name and report must explicitly state that it is an experimental package-selection policy, not a verified interpretation update.

Verification should distinguish three questions: can JSON and provenance checks reject malformed/stale/cross-supplier input; can the model interpret a curated set of conditions/preferences/supersession examples; does a later specific policy consumer improve negotiations? A mocked model can prove the first and policy wiring, not the second. A replay can inspect interpretation and next-action differences, not final score benefit.

Both candidates correctly reject arbitrary state patches, persistent model beliefs, resurrected historical offers, and model-controlled acceptance. Preserve those boundaries.
