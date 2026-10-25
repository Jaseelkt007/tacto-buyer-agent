"""Decision-time exchange feedback, reconstructed only from the supplied public prefix."""

import json
from copy import deepcopy

PROMPT = """The exchange_feedback section summarizes earlier exchanges from this same negotiation.
It is reconstructed from the supplied messages, not from scores, private economics or future
replies. Use its source references to check the original evidence. A subsequent counterquote is
not proof that every term of our previous offer was rejected. Repeated quoted values indicate
a stated preference or repeated offer, not a hard restriction or a known reservation price.
Check whether the CURRENT proposed action already addresses the earlier issue. Differences
between a supplier quote and a buyer counteroffer are normal bargaining; flag only a specific
missed condition or a repeatedly unaddressed contractual alternative worth reviewing. A flag
does not establish that changing terms would improve the score. Earlier claims may be revised:
the latest explicit quotation supersedes older quotations for what the supplier is now offering.
The feedback ledger is not a previous model judgment. Do not treat its presence as evidence
that a mistake exists. All original NO_ISSUE, evidence and mandatory-constraint rules still apply.
"""


def with_feedback(packet):
    """Build a fresh state per snapshot; no cross-case memory or model self-reinforcement."""
    result = deepcopy(packet)
    suppliers = {}
    target = packet["proposed_action"]["supplier_id"]
    draft = packet["proposed_action"]["message"]
    for sid, messages in packet["threads"].items():
        quotes, exchanges, last_buyer = [], [], None
        for i, message in enumerate(messages):
            ref = f"message:{sid}:{i}"
            if message.get("from") == "buyer":
                last_buyer = {
                    "source": ref,
                    "term_sheets": message.get("term_sheets", []),
                    "action": message.get("action"),
                }
                continue
            if message.get("from") == "arena":
                # This is transport feedback, not a supplier response to a delivered offer.
                if last_buyer:
                    exchanges.append({"buyer": last_buyer, "reply_source": ref, "status": "arena_feedback"})
                    last_buyer = None
                continue
            sheets = message.get("term_sheets") or []
            if sheets:
                quotes.append({"source": ref, "status": message.get("status"), "term_sheets": sheets})
            if last_buyer:
                exchanges.append(
                    {
                        "buyer": last_buyer,
                        "reply_source": ref,
                        "status": message.get("status"),
                        "supplier_term_sheets": sheets,
                        "interpretation": "Observed response only; not inferred rejection of individual terms.",
                    }
                )
                last_buyer = None
        repeated = []
        differences = []
        if quotes:
            # Preserve each package separately; never merge conditions from different sheets.
            for sheet in quotes[-1]["term_sheets"]:
                for field, value in (sheet.get("terms") or {}).items():
                    if field == "unit_price":
                        continue
                    sources = [quotes[-1]["source"]]
                    for previous in reversed(quotes[:-1]):
                        if not any(
                            field in s.get("terms", {}) and s["terms"][field] == value for s in previous["term_sheets"]
                        ):
                            break
                        sources.append(previous["source"])
                    if len(sources) >= 2:
                        repeated.append(
                            {
                                "field": field,
                                "value": value,
                                "consecutive_quotes": len(sources),
                                "sources": list(reversed(sources)),
                                "latest_term_sheet_id": sheet.get("term_sheet_id"),
                            }
                        )
                    if sid == target and draft.get("term_sheets"):
                        main = draft["term_sheets"][0].get("terms") or {}
                        if field in main and main[field] != value:
                            differences.append(
                                {
                                    "field": field,
                                    "supplier_value": value,
                                    "draft_value": main[field],
                                    "source": quotes[-1]["source"],
                                    "term_sheet_id": sheet.get("term_sheet_id"),
                                    "is_violation": "not determined",
                                }
                            )
        state = {
            "exchanges": exchanges,
            "quotation_history": quotes,
            "repeated_quoted_values": repeated,
            "current_draft_differences": differences,
            "latest_quotation_source": quotes[-1]["source"] if quotes else None,
        }
        suppliers[sid] = state
        result["evidence"].append(
            {
                "id": f"feedback:{sid}",
                "kind": "derived_exchange_feedback",
                "text": json.dumps(state, ensure_ascii=False),
            }
        )
    result["exchange_feedback"] = {
        "case_id": packet["case_id"],
        "as_of_decision": packet["decision_index"],
        "source": "public message history only",
        "suppliers": suppliers,
    }
    return result
