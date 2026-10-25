from arena_kit.agents.procudeal.research import source_audit as audit


def payload():
    return {"claims": [{"claim_id": "need.0"}],
            "primary_records": {"doc:one": "We ask for faster payment. We cannot increase capacity."}}


def finding(**changes):
    return {"claim_id": "need.0", "verdict": "supported", "reason": "Explicit request.",
            "excerpts": [{"ref": "doc:one", "quote": "We ask for faster payment."}], **changes}


def test_support_requires_a_real_source_excerpt():
    good = audit.validate({"findings": [finding()]}, payload())
    assert good["complete"] and good["verdict_counts"] == {"supported": 1}
    for excerpts in ([], [{"ref": "doc:one", "quote": "We need more volume."}],
                     [{"ref": "doc:missing", "quote": "We ask for faster payment."}],
                     [{"ref": "doc:one", "quote": ""}]):
        bad = audit.validate({"findings": [finding(excerpts=excerpts)]}, payload())
        assert not bad["complete"] and not bad["verdict_counts"]


def test_missing_duplicate_unknown_verdicts_cannot_pass():
    for findings in ([], [finding(), finding()], [finding(claim_id="invented")],
                     [finding(verdict="probably")], [finding(reason="")]):
        assert not audit.validate({"findings": findings}, payload())["complete"]


def test_uncertainty_can_be_reported_without_fabricating_evidence():
    result = audit.validate({"findings": [finding(verdict="unsupported", excerpts=[])]}, payload())
    assert result["complete"] and result["verdict_counts"] == {"unsupported": 1}


def test_literal_validation_does_not_claim_entailment():
    # A real quote can be irrelevant. This layer deliberately claims provenance only.
    result = audit.validate({"findings": [finding(reason="This is about volume.")]}, payload())
    assert result["findings"][0]["provenance_valid"]
    assert "verified" not in result["findings"][0]


def test_inventory_keeps_uncited_claims_visible():
    dossier = {"supplier_id": "sup:new", "strategy": {"needs": [
        {"need": "cash", "detail": "Needs cash", "evidence": []}]}}
    result = audit.inventory([dossier])
    assert result["totals"]["uncited_needs_constraints"] == 1
    assert result["totals"]["unscoped_needs_constraints"] == 1
    assert audit.claims(dossier)[0]["claim_id"] == "strategy.needs.0"


def test_record_index_keeps_nested_clauses_and_full_text():
    evidence = {"contracts": [{"id": "ctr:1", "clauses": [
        {"id": "ctr:1#1", "text": "Prices fixed for the calendar year."}]}],
        "documents": [{"id": "doc:1", "text": "Long source text. No truncation."}]}
    sources = audit.records(evidence)
    assert {"ctr:1", "ctr:1#1", "doc:1"} <= set(sources)
    assert "Long source text. No truncation." in sources["doc:1"]


def test_fingerprint_changes_when_same_ids_have_new_content():
    assert audit.digest({"doc:1": "old"}) != audit.digest({"doc:1": "new"})


def test_verifier_sees_idless_evidence_and_event_ids():
    sources = audit.records({"supplier": "sup:1", "intel": {"owner_type": "family"},
                             "invoices": {"paid_late_pct": 84.1},
                             "negotiation_history": [{"event_id": "EV-1", "note": "kept volume"}],
                             "parts": {"part:1": {"sourcing": [{"supplier_id": "sup:1", "quota_pct": 100}]}}})
    assert "family" in sources["sup:1"]
    assert "84.1" in sources["evidence:invoices"]
    assert "kept volume" in sources["EV-1"]
    assert "100" in sources["evidence:part:1:sourcing"]
