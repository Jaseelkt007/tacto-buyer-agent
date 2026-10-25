# Supplier reply projection

## Usage first

```python
# Live default: no interpreter and no behavior change.
agent = ProcuDealAgent(complete, package)

# Explicit experiment: supplier history -> typed projection -> existing policy.
agent.reply_interpreter = ReplyInterpreter(complete_json, mode="observe")
# mode="apply" is a separate opt-in; never enabled by the feature's presence.

# Offline fixture/replay; no hosted negotiation or future outcomes needed.
view = interpreter(case, supplier_id, public_prefix)
print(view.to_json())
```

The only public boundary is `ReplyInterpreter.__call__(case, supplier_id, events) -> ReplyView`. It handles input construction, model invocation, parsing, provenance checks, and diagnostic recording. Policy consumes a typed result, never raw model JSON. The model sees no proposed action, so it cannot justify a decision already made.

## Problem and grounding

`Negotiator.decide()` calls `observe()` for new supplier replies before acceptance and counteroffer logic. `observe()` already reads regex signals, then calls `react()`. `react()` adopts the first supplier clause and can skip other quoted clauses. `offer()` prices `side.mix`, then chooses claims. The current observer runs after a completed action, offline. The earlier reconsideration adapter appends a code-repriced alternative after policy decisions; it cannot supply evidence to the policy's earlier interpretation.

Use a fresh projection of the same supplier's public prefix at every new reply. Do not build another mutable memory ledger or replay previous model statements as facts. Earlier buyer offers and actual supplier responses are the feedback. Existing `feedback.py` supplies the design pattern but depends on a proposed action; it should not be called with a fabricated future action.

## Shape

`reply_interpretation.py` owns the transport schema, request construction, source registry, parsing, and `ReplyView`. `policy.py` owns any resulting term-mix change. Existing `reconsideration.package_terms()` provides useful validation logic, but avoid importing its adapter and model transport just to resolve a reference; move a shared resolver only if reuse warrants it.

Before the model call, code assigns stable message references and registers complete term sheets separately. The request contains latest supplier message, public history, fixed and negotiable fields, allowed options, and all package references. No supplier estimates, benchmark results, private state, or future messages are required.

The model JSON has this exact bounded shape (all objects disallow additional properties):

```json
{
  "packages": [
    {
      "message_ref": "message:supplier:4",
      "term_sheet_id": "sheet:B",
      "availability": "offered",
      "conditions": [
        {
          "field": "contract_months",
          "kind": "required_for_package",
          "evidence": {"message_ref": "message:supplier:4", "quote": "This price requires a three-year agreement."}
        }
      ],
      "availability_evidence": {"message_ref": "message:supplier:4", "quote": "Alternatively, we can offer B."}
    }
  ],
  "unresolved": []
}
```

Schema bounds: `packages` max 12, one item per latest structured supplier package; message and sheet refs are dynamically enumerated from the request. `availability` enum is `offered | withdrawn | unclear`. `conditions` max 12; `field` enum comes from the case's negotiable/fixed fields plus `other`. `kind` enum is `required_for_package | preference | unclear`. Evidence quotes are strings of 1–600 characters and message refs are dynamically enumerated only from this supplier's messages. `unresolved` max 12 exact-evidence records with a `reason` enum `ambiguous_scope | text_sheet_conflict | unsupported_condition | conflicting_history`. No model-generated numeric term values: a condition names a field whose value is resolved from that package. Requirements not represented in its structured sheet are unresolved and diagnostic, not synthesized into new contracts. Quoted packages without a prose availability sentence can cite their structured sheet through a separate typed sheet-evidence branch; do not require invented text.

Internal result:

```python
@dataclass(frozen=True)
class ReplyView:
    prefix_sha256: str
    supplier_id: str
    latest_message_ref: str
    packages: tuple[InterpretedPackage, ...]
    unavailable_reason: str | None
    mode: Literal["observe", "apply"]

def __call__(self, case: dict, sid: str, events: list[dict]) -> ReplyView:
    raise NotImplementedError
```

The caller injects prefix identity; the model does not get to choose it. Cache by the full request hash. A reused result must match supplier and prefix exactly. Timeout, refusal, malformed JSON, duplicate sheet references, invalid sources, or conflict with structured terms yields unavailable interpretation and original policy behavior. Empty results mean unknown/no extracted conditions, not approval.

## What validation means

Code can prove: the message exists, it came from the supplier, quote is an exact substring, sheet belongs to that message, numerical terms match the authoritative sheet, terms obey the case, and computed costs are finite. Code cannot prove: the quotation semantically establishes a condition, a preference was interpreted correctly, or an alternative is a strategically good move. Record `provenance_checked`, not `fact_verified`.

## Policy insertion and bounded effect

Call the interpreter inside `observe()` after identifying a new supplier reply, before `react()`. Keep the result only as the current prefix projection; nothing persists as an inferred permanent rule.

First integration should expose the projection to policy and trace it in observe mode. The explicit apply experiment has one permission: reconsider **complete packages actually quoted in the latest reply**. The policy compares those packages with existing economics, mandatory checks, and finite-cost checks. It may replace the preferred nonprice mix using the existing `set_mix()` and recompute associated clause state and converted supplier price atomically. It must not merge terms from separate packages, manufacture prices, alter estimated supplier costs, create buyer mandatory constraints, directly accept/walk, or revive historical quotes.

An interpreter's preference/unclear observation cannot eliminate an existing candidate. Withdrawal interpretations stay diagnostic; authoritative structured sheets bind and prose cannot revoke them. Acceptance remains based on `play.standing()` (latest main sheet), so alternative sheets are candidates for the next counterproposal, never directly accepted through this interface. `agreed` and `final_offer` bypass intervention. P08's raw alternative enumeration should also be independently testable without an LLM: otherwise one cannot distinguish fixing a deterministic exclusion from adding semantic understanding.

## Tradeoffs and alternatives

- Accept repeated prefix interpretation in exchange for no inferred-state accumulation or retraction machinery.
- Accept limited live authority in exchange for separating semantic usefulness from contract and pricing control.
- Reject mutable JSON patches into `Side`: too many state fields and invariants are hidden from the model.
- Reject regex-to-LLM replacement for all `asks/traits`: those signals currently change financing assumptions and claims globally, exceeding offer-scoped evidence.
- Reject another post-decision append adapter: it cannot correct package selection at the requested layer.

## Verification and next step

Build the typed boundary and fixtures first. Tests should prove cross-supplier/stale/forged citations cannot change behavior; preference cannot become a condition; full packages remain separate; previous model output is excluded; repeated invocation is idempotent; model failure reproduces the original move; default-off reproduces all captured actions. Then drive one actual `Negotiator.decide()` with a controlled interpreter returning a legitimate alternative and show resulting mix/price/claims remain coherent. Negative fixtures include withdrawn historical offers, contradictory prose and sheets, changing duration, and unknown extra conditions. Replay frozen public prefixes for extraction inspection; do not claim these replays measure future negotiation scores. A separately enabled end-to-end practice comparison measures that later.
