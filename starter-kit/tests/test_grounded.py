import copy
import json

import pytest

from arena_kit.agents.procudeal.research import grounded as g
from arena_kit.agents.procudeal.research import source_audit as sa

SOURCES = {"doc:request": "2026-09-18: For part:new, we require a binding commitment."}
OBS = {"text": "Supplier requires a commitment for part:new.", "kind": "supplier_statement",
       "source": "doc:request", "quote": "For part:new, we require a binding commitment.",
       "parts": ["part:new"], "observed_at": "2026-09-18", "valid_until": None}


def checked():
    obs, error = g.check_observation(OBS, SOURCES, {"part:new": {}})
    assert error is None
    return obs


@pytest.mark.parametrize("change", [
    {"source": "doc:missing"}, {"quote": "We will offer a discount."}, {"quote": ""},
    {"parts": []}, {"parts": ["part:wrong"]}, {"observed_at": "last year"},
    {"valid_until": "2020-01-01"}, {"text": 7}, {"source": {}},
])
def test_unsupported_provenance_or_scope_drops_the_whole_observation(change):
    assert g.check_observation({**OBS, **change}, SOURCES, {"part:new": {}})[0] is None


def test_missing_duplicate_or_rejected_reviews_never_reach_supported():
    obs = checked()
    review = {"id": obs["id"], "verdict": "supported", "reason": "Explicit request."}
    for reviews in ([], [review, review], [{**review, "verdict": "reject"}]):
        supported, _, rejected = g.apply_reviews([obs], {"reviews": reviews})
        assert not supported and len(rejected) == 1


def test_downgraded_hypothesis_stays_labelled_and_loadable():
    obs = checked()
    supported, hypotheses, _ = g.apply_reviews([obs], {"reviews": [
        {"id": obs["id"], "verdict": "hypothesis", "reason": "Inference."}]})
    assert not supported
    h = hypotheses[0]
    assert h["kind"] == "hypothesis"
    raw = {k: h[k] for k in g.OBSERVATION["properties"]}
    assert g.check_observation(raw, SOURCES, {"part:new": {}})[0]["id"] == h["id"]


def test_other_parts_expired_and_future_observations_are_hidden():
    obs = checked()
    assert "binding commitment" in " ".join(g.lines({"observations": [obs]}, ["part:new"], "2026-10-25"))
    for item, parts in ((obs, ["part:other"]), ({**obs, "valid_until": "2026-10-01"}, ["part:new"]),
                        ({**obs, "observed_at": "2026-11-01"}, ["part:new"])):
        assert "binding commitment" not in " ".join(g.lines({"observations": [item]}, parts, "2026-10-25"))


def test_case_scope_preserves_verified_observations_outside_global_lead_shortlist():
    artifact = {"observations": [], "verified_unselected": [checked()]}
    assert "binding commitment" in " ".join(g.lines(artifact, ["part:new"], "2026-10-25"))
    assert "binding commitment" not in " ".join(g.lines(artifact, ["part:other"], "2026-10-25"))


def test_stale_sources_and_unreviewed_artifacts_are_not_used(tmp_path, monkeypatch):
    obs = checked()
    obs["review"] = {"verdict": "supported"}
    artifact = {"schema_version": g.VERSION, "supplier_id": "sup:new", "observations": [obs], "hypotheses": [],
                "meta": {"source_hash": sa.digest(SOURCES), "pipeline_hash": g.pipeline_hash()}}
    monkeypatch.setattr(g, "bundle", lambda pkg, sid: ({"parts": {"part:new": {}}}, SOURCES))
    path = tmp_path / "suppliers" / "sup_new.json"
    path.parent.mkdir()
    path.write_text(json.dumps(artifact))
    assert g.load(object(), "sup:new", tmp_path)
    for field in ("source_hash", "pipeline_hash"):
        broken = copy.deepcopy(artifact)
        broken["meta"][field] = "old"
        path.write_text(json.dumps(broken))
        assert g.load(object(), "sup:new", tmp_path) is None
    artifact["observations"][0].pop("review")
    path.write_text(json.dumps(artifact))
    assert g.load(object(), "sup:new", tmp_path) is None


def test_lead_cannot_invent_an_observation(monkeypatch):
    monkeypatch.setattr(g, "bundle", lambda pkg, sid: ({"supplier": sid, "parts": {"part:new": {}}}, SOURCES))

    def ask(system, user, schema, tag, **kwargs):
        if tag == "grounded:verify":
            candidates = json.loads(user)["candidates"]
            return {"reviews": [{"id": o["id"], "verdict": "supported", "reason": "Explicit."} for o in candidates]}
        if tag == "grounded:lead":
            return {"selected": ["obs:invented"]}
        return {"observations": [OBS]}

    monkeypatch.setattr(g.llm, "ask", ask)
    with pytest.raises(ValueError, match="invalid observation IDs"):
        g.build(object(), "sup:new")
