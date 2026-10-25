"""Publish small public-prefix examples from saved offline reviews. No model calls."""

import argparse
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
EXPERIMENT = ROOT / "evaluations/observation-feedback"
REVIEW = EXPERIMENT / "reviews/paired-r01/pass1-feedback"
OUT = ROOT / "web/src/data/reviewer.json"
EXAMPLES = {
    "counter": ("G06", 2, "0006.json"),
    "accept": ("G06", 4, "0008.json"),
    "unsupported": ("G03", 2, "0002.json"),
}


def read(path):
    return json.loads(path.read_text())


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False).encode()).hexdigest()


def provenance(path):
    return {"path": str(path.relative_to(ROOT)), "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def display(value):
    if value is None:
        return "None / fixed price"
    if isinstance(value, dict):
        return " · ".join(f"{key.replace('_', ' ')}: {display(part)}" for key, part in value.items())
    return str(value)


def terms_rows(terms):
    return [{"label": key.replace("_", " "),
             "value": f"€{value:.2f}" if key == "unit_price" else f"{value} days" if key == "payment_days" else display(value)}
            for key, value in terms.items()]


def example(case_id, decision_index, review_name):
    capture_path = EXPERIMENT / f"runs/synthetic-r01/{case_id}-observations.json"
    review_path = REVIEW / review_name
    captured = next(record for record in read(capture_path)["observation_packets"]
                    if record["packet"]["decision_index"] == decision_index)
    packet, result = captured["packet"], read(review_path)
    if captured["sha256"] != digest(packet) or result["input_packet_sha256"] != captured["sha256"]:
        raise ValueError(f"packet hash mismatch: {review_path}")
    if packet["case_id"] != result["case_id"] or result["decision_index"] != decision_index:
        raise ValueError(f"case/decision mismatch: {review_path}")
    if not result["feedback_enabled"]:
        raise ValueError(f"feedback is not enabled: {review_path}")
    if result["available"]:
        if result["verdict"] not in {"NO_ISSUE", "RECONSIDER", "CONSTRAINT_CONFLICT"}:
            raise ValueError("unknown available verdict")
        if result["verdict"] != "NO_ISSUE" and not result.get("supporting_source"):
            raise ValueError("retained flag has no supporting source")
    elif not result["error"]:
        raise ValueError("unavailable observation has no reason")
    sid = packet["proposed_action"]["supplier_id"]
    messages = packet["threads"][sid]
    ledger = result["exchange_feedback"]["suppliers"][sid]
    if result["exchange_feedback"]["as_of_decision"] != decision_index:
        raise ValueError("feedback uses a different decision")
    enriched = {**packet, "evidence": list(packet["evidence"]), "exchange_feedback": result["exchange_feedback"]}
    for supplier_id, state in result["exchange_feedback"]["suppliers"].items():
        enriched["evidence"].append({"id": f"feedback:{supplier_id}", "kind": "derived_exchange_feedback",
                                     "text": json.dumps(state, ensure_ascii=False)})
    if digest(enriched) != result["packet_sha256"]:
        raise ValueError("feedback-augmented packet hash mismatch")

    def source_message(ref):
        prefix = f"message:{sid}:"
        if not ref.startswith(prefix):
            raise ValueError(f"unexpected message reference: {ref}")
        index = int(ref.removeprefix(prefix))
        if not 0 <= index < len(messages):
            raise ValueError(f"source outside decision-time history: {ref}")
        return messages[index]

    exchanges = []
    for exchange in ledger["exchanges"]:
        source_message(exchange["buyer"]["source"])
        source_message(exchange["reply_source"])
        exchanges.append({
            "buyer_source": exchange["buyer"]["source"],
            "buyer_terms": [terms_rows(sheet["terms"]) for sheet in exchange["buyer"]["term_sheets"]],
            "reply_source": exchange["reply_source"],
            "status": exchange["status"],
            "supplier_terms": [terms_rows(sheet["terms"]) for sheet in exchange.get("supplier_term_sheets", [])],
        })
    repeats = []
    for repeat in ledger["repeated_quoted_values"]:
        for ref in repeat["sources"]:
            source_message(ref)
        repeats.append({"field": repeat["field"].replace("_", " "), "value": display(repeat["value"]),
                        "count": repeat["consecutive_quotes"], "sources": repeat["sources"]})
    differences = []
    for difference in ledger["current_draft_differences"]:
        source_message(difference["source"])
        differences.append({"field": difference["field"].replace("_", " "),
                            "supplier": display(difference["supplier_value"]),
                            "draft": display(difference["draft_value"]), "source": difference["source"],
                            "violation": difference["is_violation"]})
    latest_ref = ledger["latest_quotation_source"]
    latest = source_message(latest_ref)
    supporting = result.get("supporting_source")
    if supporting:
        source = source_message(supporting["id"])
        if supporting not in packet["evidence"]:
            raise ValueError("review evidence is not in the captured public prefix")
        excerpt = source.get("body") or ""
    else:
        excerpt = ""
    draft = packet["proposed_action"]["message"]
    return {
        "case_id": case_id, "decision_index": decision_index, "model": result["model"],
        "supplier_status": packet["supplier_status"], "moves_left": packet["moves_left"],
        "action": result["action"], "action_target": (draft.get("action") or {}).get("term_sheet_id"),
        "draft_terms": [terms_rows(sheet["terms"]) for sheet in draft.get("term_sheets", [])],
        "latest_source": latest_ref,
        "latest_terms": [terms_rows(sheet["terms"]) for sheet in latest.get("term_sheets", [])],
        "exchanges": exchanges, "repeated_terms": repeats, "draft_differences": differences,
        "result": {"available": result["available"], "verdict": result.get("verdict"),
                   "field": result.get("field"), "assessment": result.get("assessment"),
                   "error": result["error"], "evidence": result.get("evidence"),
                   "source_excerpt": excerpt, "seconds": result["seconds"], "calls": len(result["calls"])},
        "provenance": {"packet_sha256": captured["sha256"], "reviewed_packet_sha256": result["packet_sha256"],
                       "request_sha256": result["request_sha256"],
                       "capture": provenance(capture_path), "review": provenance(review_path)},
    }


def export():
    manifest = read(REVIEW / "manifest.json")
    summary_path = EXPERIMENT / "reviews/practice-all10-r01/summary.json"
    summary = read(summary_path)
    return {
        "mode": "offline_observation", "model": manifest["model"], "status": "experimental",
        "implementation_sources": manifest["source_sha256"],
        "summary": {"decisions": summary["snapshots"], "no_issue": summary["verdicts"].get("NO_ISSUE", 0),
                    "unsupported": summary["errors"].get("unsupported_flag", 0),
                    "retained_flags": sum(count for verdict, count in summary["verdicts"].items() if verdict != "NO_ISSUE"),
                    "changed_actions": summary["changed_buyer_actions"], "source": provenance(summary_path)},
        "examples": {name: example(*args) for name, args in EXAMPLES.items()},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    output = json.dumps(export(), indent=2, ensure_ascii=False, allow_nan=False) + "\n"
    if args.check:
        if not OUT.exists() or OUT.read_text() != output:
            raise SystemExit("Reviewer snapshot differs; run npm run sync:reviewer")
        print("Reviewer examples match saved public prefixes, input hashes and evidence sources")
    else:
        OUT.write_text(output)
        print(f"Wrote {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
