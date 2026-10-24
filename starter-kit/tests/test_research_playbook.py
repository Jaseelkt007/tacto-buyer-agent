"""Playbook corpus (research/playbook.py) on the repo's practice runs and on small synthetic runs.
No arena, no LLM."""

import json
from pathlib import Path

import pytest

from arena_kit.agents.procudeal.research import playbook as pb

RUNS = Path(__file__).resolve().parents[2] / "runs"
PACKAGE = Path(__file__).resolve().parents[1] / "data" / "package"
CORE = (
    "case_id",
    "type",
    "category_goal",
    "n_suppliers",
    "note",
    "agent",
    "score",
    "deal",
    "c_open",
    "c_deal",
    "c_best",
    "winner",
    "rounds",
    "seconds",
    "threads",
)
THREAD = ("supplier_id", "opening_price", "opening_terms", "ours", "theirs", "backoffice")


@pytest.fixture(scope="module")
def corpus():
    if not any(RUNS.glob("*/*.json")):
        pytest.skip("no runs/ in this checkout")
    package = PACKAGE if any(PACKAGE.glob("*.sqlite")) else None
    out = pb.practice_corpus(RUNS, package=package)
    assert out, "runs/ has files but the corpus is empty"
    return out


def shares(rec):
    """Every price share in a record."""
    if rec.get("deal_price") is not None:
        yield "deal", rec["deal_price"]
    for th in rec["threads"]:
        for m in th["ours"]:
            for s in m.get("sheets") or []:
                yield "ours", s["price"]
            if m.get("price") is not None:
                yield "ours", m["price"]
        for r in th["theirs"]:
            if r.get("price") is not None:
                yield "theirs", r["price"]
            for a in r.get("alternatives") or []:
                yield "alt", a["price"]


def test_core_fields(corpus):
    for rec in corpus:
        missing = [k for k in CORE if k not in rec]
        assert not missing, (rec.get("file"), missing)
        assert rec["agent"] in pb.AGENTS
        assert rec["threads"] and rec["n_suppliers"] == len(rec["threads"])
        for th in rec["threads"]:
            assert all(k in th for k in THREAD), (rec["file"], th.get("supplier_id"))
            assert th["opening_price"], (rec["file"], th["supplier_id"])
        if rec["deal"]:
            assert rec["winner"] in {th["supplier_id"] for th in rec["threads"]}


def test_shares_in_a_sane_range(corpus):
    bad = [(rec["file"], kind, x) for rec in corpus for kind, x in shares(rec) if x is None or not 0.3 <= x <= 1.5]
    assert not bad, bad[:5]


def test_p05_is_an_rfq_with_three_threads(corpus):
    p05 = [r for r in corpus if r["case_id"] == "case:P05"]
    if not p05:
        pytest.skip("no P05 runs")
    for rec in p05:
        assert rec["type"] == "rfq" and len(rec["threads"]) == 3, rec["file"]
        assert {th["supplier_id"] for th in rec["threads"]} == {"sup:70210", "sup:70240", "sup:70250"}


def test_claim_results_are_paired(corpus):
    claims = [c for rec in corpus for th in rec["threads"] for m in th["ours"] for c in m.get("claims") or []]
    assert claims
    assert {c["result"] for c in claims} <= {"verified", "contradicted", "duplicate", "irrelevant", "unknown", None}
    assert sum(c["result"] == "verified" for c in claims) > len(claims) / 2
    assert any(c.get("effect") == "no effect" for c in claims)  # the supplier's own answer to a claim


def test_render_stays_small_and_clean(corpus):
    for rec in corpus:
        text = pb.render(rec)
        assert len(text) <= 8000, (rec["file"], len(text))
        assert text.startswith(f"RUN {rec['case_id']}")
        assert "http" not in text and "replay" not in text.lower(), rec["file"]


def test_dedupe_and_select(corpus):
    unique = pb.dedupe(corpus)
    assert 0 < len(unique) <= len(corpus)
    assert len(pb.dedupe(unique + unique[:3])) == len(unique)
    chosen = pb.select(unique, per_case=4)
    by_case = {}
    for rec in chosen:
        by_case.setdefault(rec["case_id"], []).append(rec)
    assert set(by_case) == {r["case_id"] for r in unique}
    for case_id, picks in by_case.items():
        assert len(picks) <= 4
        ours = [r for r in unique if r["case_id"] == case_id and r["agent"] == "procudeal"]
        tagged = {t: r for r in picks for t in r["selected"]}
        if ours:
            assert {"best", "worst", "latest"} <= set(tagged)
            assert all(tagged[t]["agent"] == "procudeal" for t in ("best", "worst", "latest"))
            assert tagged["best"]["score"] == max(r["score"] for r in ours)


def test_stats(corpus):
    st = pb.stats(corpus)
    assert st["runs"] == len(corpus) and sum(c["runs"] for c in st["cases"].values()) == len(corpus)
    assert st["rendered_chars"] > 0


# --- synthetic runs: old or partial files must not break the corpus ---------------------------


def _offer(sid, n, price, status="open", **terms):
    return {
        "offer_id": f"offer:{sid}-{n}",
        "round": n,
        "status": status,
        "terms": {"unit_price": price, **terms},
        "alternatives": [],
        "claim_results": [],
        "signals": {"reply_delay_days": 3},
        "text": "Hallo,\nOur terms: a price of €10.00 per unit.\nFaster payment is welcome.\nGruß\nX",
    }


def _raw(**over):
    trace = [
        {"round": 0, "actor": "sup:1", "move": _offer("1", 0, 10.0, payment_days=30), "reasons": []},
        {
            "round": 1,
            "actor": "buyer",
            "move": {
                "type": "message",
                "supplier_id": "sup:1",
                "term_sheets": [{"terms": {"unit_price": 8.0, "payment_days": 14}}],
                "refs": ["idx:X@2026-01", "idx:X@2026-08"],
                "interpreted": {"claims": [{"type": "index_change"}]},
                "body": "Dear Sir or Madam,\nIndex X fell.\nKind regards",
            },
            "reasons": [],
        },
        {
            "round": 1,
            "actor": "sup:1",
            "move": _offer("1", 1, 9.0, payment_days=14) | {"claim_results": [{"index": 0, "result": "verified"}]},
            "reasons": ["We checked the index change data you cited; it holds and we took it into account."],
        },
        {"round": 2, "actor": "buyer", "move": {"type": "accept", "supplier_id": "sup:1", "offer_id": "offer:1-1"}},
    ]
    raw = {
        "case_id": "case:T1",
        "agent": "procudeal",
        "when": "2026-10-24T10:00:00+00:00",
        "result": {"deal": True, "supplier_id": "sup:1", "terms": {"unit_price": 9.0}, "score": 0.5, "c_open": 100.0},
        "session": {"result": {"trace": trace}, "rounds": 2},
    }
    return raw | over


def test_record_from_a_partial_run_file():
    rec = pb.record(_raw())  # no case file, no back office, no decisions, no opening block
    th = rec["threads"][0]
    assert th["opening_price"] == 10.0 and rec["deal_price"] == 0.9
    assert th["ours"][0]["price"] == 0.8 and th["ours"][0]["n_sheets"] == 1
    assert th["ours"][0]["claims"] == [{"kind": "index_change", "result": "verified", "effect": "counted"}]
    accept = {"type": "accept", "round": 2, "step": 3, "offer_id": "offer:1-1", "alternative": False, "price": 0.9}
    assert th["ours"][1] == accept
    assert th["theirs"][0]["excerpt"] == "Faster payment is welcome."  # terms sentence and signature dropped
    text = pb.render(rec)
    assert "r1 us 0.800 [pay14]; claims index_change=verified (counted)" in text
    assert "r2 us ACCEPT at 0.900" in text

    assert pb.record({"case_id": "case:T2", "agent": "naive"})["threads"] == []  # nothing at all: still a record


def test_corpus_skips_broken_files(tmp_path):
    (tmp_path / "T1").mkdir()
    (tmp_path / "T1" / "a_procudeal_x.json").write_text(json.dumps(_raw()))
    (tmp_path / "T1" / "b_procudeal_y.json").write_text("{not json")
    (tmp_path / "T1" / "c_other_z.json").write_text(json.dumps(_raw(agent="other")))
    corpus = pb.practice_corpus(tmp_path, cases={})
    assert [r["file"] for r in corpus] == ["T1/a_procudeal_x.json"]


def test_why_shares_and_claim_checks():
    assert pb.why_shares("final_offer; C 251,462 below the limit 305,545") == "final_offer; C at 0.823 of the limit"
    assert "no limit" in pb.why_shares("final_offer; C 1,518,252 below the limit inf")
    checks = pb.claim_checks(
        [
            "We checked the rival quote data you cited; it holds, but it does not change our calculation.",
            "We have already taken that index change data into account.",
            "As to the volume change and should cost data you cited, that does not change our position.",
        ]
    )
    assert checks == [
        ("rival_quote", "no effect"),
        ("index_change", "already counted"),
        ("volume_change", "that does not change our position."),
        ("should_cost", "that does not change our position."),
    ]
