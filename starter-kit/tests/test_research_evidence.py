"""Zone 0 evidence and argument library on the real data package (no arena, no LLM).

Reference: sup:70110 (Gießerei Brandlhuber, the supplier of practice case P01). Every checkable
sentence is re-checked here against facts.json the way the arena checks it (api.md, "What counts").
"""

import json
import re
from pathlib import Path

import pytest

from arena_kit.agents.procudeal.claims import _recent, data_month
from arena_kit.agents.procudeal.research import evidence as ev
from arena_kit.agents.procudeal.research import library as lib

PACKAGE = Path(__file__).resolve().parents[1] / "data" / "package"
pytestmark = pytest.mark.skipif(not (PACKAGE / "world.sqlite").is_file(), reason="data package not unpacked")

SID = "sup:70110"
ID = re.compile(r"\b(?:idx|sc|qn|po|fc|cost|news|doc|ctr|quote|offer|sup|part|gr|inv|rfq):[^\s,()]+")
NUMBER = re.compile(r"[+-]?\d+(?:\.\d+)?")
SIDES = {"for_us", "for_them"}


@pytest.fixture(scope="module")
def pkg():
    from arena_kit.data import DataPackage

    return DataPackage(PACKAGE)


@pytest.fixture(scope="module")
def evidence(pkg):
    return ev.supplier_evidence(pkg, SID)


@pytest.fixture(scope="module")
def library(pkg, evidence):
    return lib.argument_library(pkg, SID, evidence)


def by_kind(library, kind):
    return [a for a in library if a["kind"] == kind]


# --- evidence ----------------------------------------------------------------------------------------


def test_evidence_has_the_contract_and_all_its_clauses(evidence):
    (contract,) = evidence["contracts"]
    assert contract["id"] == "ctr:4600070110" and contract["parts"] == ["part:310010", "part:310012"]
    clauses = {c["id"]: c for c in contract["clauses"]}
    assert len(clauses) == 6
    price = clauses["ctr:4600070110#3.1"]
    assert price["type"] == "price" and price["days"] == 90 and "fixed for each calendar year" in price["text"]


def test_evidence_has_every_document_in_full(evidence):
    docs = {d["id"]: d for d in evidence["documents"]}
    assert len(docs) == 7
    for ref, d in docs.items():  # nothing truncated: the text is the file
        assert d["text"] == (PACKAGE / "correspondence" / f"{ref.split(':', 1)[1]}.md").read_text(encoding="utf-8")
    letter = docs["doc:20260911-70110-P01"]
    assert letter["date"] == "2026-09-11" and letter["notice_given_days"] == 51 and "9.5 %" in letter["text"]
    call = docs["doc:20260824-70110-M1"]
    assert call["kind"] == "call_note" and "spreadsheet, last updated two years ago" in call["text"]


def test_evidence_part_block(evidence):
    block = evidence["parts"]["part:310010"]
    own = [r for r in block["price_history"] if r["supplier_id"] == SID]
    assert (own[0]["valid_from"][:4], own[0]["price"]) == ("2023", 136.0)
    assert (own[-1]["valid_from"][:4], own[-1]["price"]) == ("2026", 126.53)
    assert [(r["id"], r["unit_cost"]) for r in block["should_cost"]] == [("cost:310010", 132.64)]
    drivers = {d["series_id"]: d for d in block["drivers"]}
    assert set(drivers) == {"PPI-C241", "PPI-D351", "LCI-C"}
    assert drivers["PPI-D351"]["change_12m_pct"] == -3.7 and drivers["PPI-D351"]["last_id"] == "idx:PPI-D351@2026-08"
    assert drivers["PPI-D351"]["change_from_top_pct"] < -40  # the 2022 energy peak
    assert {r["supplier_id"] for r in block["sourcing"]} == {SID, "sup:70140"}
    assert any(q["id"] == "quote:7200001" for q in block["quotes"])
    assert block["forecasts"][-1]["id"] == "fc:310010@2026-09" and block["forecasts"][-1]["change_pct"] == 10.1
    (orders,) = [o for o in block["orders"] if o["supplier_id"] == SID]
    assert orders["latest_price"] == 126.53 and len(orders["latest"]) == 3


def test_evidence_history_and_performance(evidence):
    renewals = [
        r
        for r in evidence["negotiation_history"]
        if r["part_id"] == "part:310010" and r["asked_pct"] is not None and r["settled_pct"] is not None
    ]
    assert len(renewals) == 3 and len(evidence["negotiation_history"]) == 8
    assert evidence["scorecards"][-1]["id"] == "sc:70110@2026Q3" and evidence["scorecards"][-1]["otd_pct"] == 85.2
    assert evidence["quality"] and all(q["id"].startswith("qn:") for q in evidence["quality"])
    assert evidence["deliveries"]["last_12m"]["receipts"] > 0 and evidence["invoices"]["invoices"] > 0
    assert {r["fiscal_year"] for r in evidence["spend"]} >= {"FY2024", "FY2025", "FY2026"}
    assert evidence["intel"]["owner_type"] == "family" and evidence["master"]["payment_days"] == 30


def test_old_vendor_record_is_merged(pkg):
    e = ev.supplier_evidence(pkg, "sup:70210")
    assert [a["id"] for a in e["aliases"]] == ["sup:71999"]
    assert any(r["supplier_id"] == "sup:71999" for r in e["spend"])


def test_render_slices(evidence):
    full = ev.render(evidence)
    for needle in ("## contracts", "[ctr:4600070110#3.1]", "[doc:20260911-70110-P01]", "### drivers", "[cost:310010]"):
        assert needle in full
    assert "last updated two years ago" in full  # documents in full
    economics = ev.render(evidence, ev.SLICES["economics"])
    assert "### drivers" in economics and "idx:PPI-D351@2026-08" in economics and "## documents" not in economics
    persona = ev.render(evidence, ev.SLICES["persona"])
    assert "## documents" in persona and "### drivers" not in persona
    known = set(ev.TOP_SECTIONS) | set(ev.PART_SECTIONS)
    assert all(set(names) <= known for names in ev.SLICES.values())


def test_release_items_reach_the_evidence(tmp_path):
    from arena_kit.data import DataPackage

    (tmp_path / "data").mkdir()
    (tmp_path / "correspondence").mkdir()
    facts = {"doc:20261025-70110-R1": {"supplier": SID, "date": "2026-10-25", "type": "letter", "title": "Update"}}
    (tmp_path / "facts.json").write_text(json.dumps(facts))
    (tmp_path / "data/documents.csv").write_text("id,file\ndoc:20261025-70110-R1,correspondence/r1.md\n")
    (tmp_path / "correspondence/r1.md").write_text("We can offer free capacity.")
    e = ev.supplier_evidence(DataPackage(PACKAGE, release=tmp_path), SID)
    (added,) = [d for d in e["documents"] if d.get("release")]
    assert added["id"] == "doc:20261025-70110-R1" and added["text"] == "We can offer free capacity."


# --- argument library --------------------------------------------------------------------------------


def test_library_reference_arguments(library):
    (notice,) = by_kind(library, "notice_period")
    assert notice["figures"]["given"] == 51 and notice["figures"]["agreed"] == 90 and notice["side"] == "for_us"
    assert notice["refs"] == ["doc:20260911-70110-P01", "ctr:4600070110#3.1"]

    falls = [
        a
        for a in by_kind(library, "index_change")
        if a["figures"]["series"] == "PPI-D351" and a["part"] == "part:310010" and a["figures"]["change_pct"] < 0
    ]
    assert falls and all(a["side"] == "for_us" for a in falls)
    assert any(a["refs"] == ["idx:PPI-D351@2025-08", "idx:PPI-D351@2026-08"] for a in falls)
    rises = [a for a in by_kind(library, "index_change") if a["figures"]["change_pct"] >= 0.5]
    assert rises and all(a["side"] == "for_them" for a in rises)  # the supplier's own arguments are there too

    (cost,) = [a for a in by_kind(library, "should_cost") if a["part"] == "part:310010"]
    assert cost["figures"]["unit_cost"] == 132.64 and "EUR 132.64" in cost["sentence"]
    assert cost["side"] == "for_them"  # its price 126.53 is below its should-cost

    (otd,) = by_kind(library, "delivery_record")
    assert otd["figures"]["otd_pct"] == 85.2 and "85.2%" in otd["sentence"] and otd["side"] == "for_us"

    orders = [a for a in by_kind(library, "order_history") if a["part"] == "part:310010"]
    assert orders and all(2 <= len(a["refs"]) <= 8 for a in orders)
    assert any("EUR 126.53" in a["sentence"] for a in orders)

    notes = by_kind(library, "call_note")
    assert any("doc:20260824-70110-M1" in a["refs"] for a in notes)
    assert all(not a["checkable"] for a in notes + by_kind(library, "contract_clause"))
    assert any(a["kind"] == "contract_clause" and "calendar year" in a["sentence"] for a in library)


def test_library_items_are_well_formed(pkg, library):
    check_library(pkg, SID, library)


def test_every_supplier_with_documents(pkg):
    suppliers = [r["s"] for r in ev.rows(pkg, "SELECT DISTINCT supplier_id AS s FROM documents ORDER BY s")]
    assert len(suppliers) >= 40
    kinds = set()
    for sid in suppliers:
        e = ev.supplier_evidence(pkg, sid)
        assert e["master"].get("id") == sid and e["documents"]
        assert ev.render(e).startswith(f"# Evidence: {sid}")
        library = lib.argument_library(pkg, sid, e)
        check_library(pkg, sid, library)
        kinds |= {a["kind"] for a in library}
    expected = {"index_change", "should_cost", "delivery_record", "quality_record", "quality_notification"}
    expected |= {"order_history", "volume_change", "news", "notice_period"}
    assert expected <= kinds


# --- the arena's checks, re-done independently ---------------------------------------------------------


def check_library(pkg, sid, library):
    ids = [a["arg_id"] for a in library]
    assert len(ids) == len(set(ids))
    for a in library:
        assert set(a) == {"arg_id", "kind", "part", "refs", "figures", "sentence", "checkable", "side", "note"}
        assert a["side"] in SIDES and a["arg_id"].startswith(a["kind"] + ":")
        assert all(pkg.lookup(r) for r in a["refs"]), a
        cited = {m.rstrip(".") for m in ID.findall(a["sentence"])}
        assert cited <= set(a["refs"]), a
        if a["checkable"]:
            assert a["refs"] and cited == set(a["refs"]), a
            check_sentence(pkg, sid, a)
        else:  # context: no figure the arena could find wrong
            assert not re.search(r"\d", ID.sub("", a["sentence"])), a


def figures(sentence):
    """The numbers of a sentence apart from its IDs and its YYYY-MM months."""
    rest = re.sub(r"\b\d{4}-\d{2}\b", "", ID.sub("", sentence))
    return [float(x) for x in NUMBER.findall(rest)]


def close_pct(ours, true):
    return abs(ours - true) <= 0.5


def close_rel(ours, true):
    return abs(ours - true) <= 0.005 * abs(true) + 1e-9


def check_sentence(pkg, sid, a):
    facts = {r: pkg.lookup(r) for r in a["refs"]}
    nums, kind = figures(a["sentence"]), a["kind"]
    if kind == "index_change":
        (r0, f0), (r1, f1) = sorted(facts.items(), key=lambda x: x[1]["month"])
        assert f0["series"] == f1["series"]
        y0, m0 = map(int, f0["month"].split("-"))
        y1, m1 = map(int, f1["month"].split("-"))
        assert 1 <= (y1 - y0) * 12 + (m1 - m0) <= 12 and _recent(f1["month"], data_month(pkg))
        (ours,) = nums
        assert close_pct(ours, (f1["value"] / f0["value"] - 1) * 100), a
    elif kind == "should_cost":
        (fact,) = facts.values()
        assert close_rel(nums[0], fact["unit_cost"]), a
    elif kind in ("delivery_record", "quality_record"):
        assert all(f["supplier"] == sid for f in facts.values())
        key = "otd_pct" if kind == "delivery_record" else "ppm"
        mean = sum(f[key] for f in facts.values()) / len(facts)
        assert (close_pct if key == "otd_pct" else close_rel)(nums[0], mean), a
    elif kind == "quality_notification":
        assert all(f["supplier"] == sid for f in facts.values())
        mean = sum(f["ppm"] for f in facts.values()) / len(facts)
        assert abs(nums[0] - mean) <= max(1, 0.005 * mean), a
    elif kind == "order_history":
        assert 2 <= len(facts) <= 8 and len({f["part"] for f in facts.values()}) == 1
        assert all(f["supplier"] == sid for f in facts.values())
        units = {int(f.get("price_unit") or 1) for f in facts.values()}
        assert len(units) == 1
        prices = [n for n in nums if n not in units]
        assert all(close_rel(p, f["unit_price"]) for p in prices for f in facts.values()), a
    elif kind == "volume_change":
        (fact,) = facts.values()
        assert close_pct(nums[0], fact["change_pct"]), a
    elif kind == "news":
        (fact,) = facts.values()
        assert fact["supplier"] == sid and not nums, a
    elif kind == "notice_period":
        doc = next(f for r, f in facts.items() if r.startswith("doc:"))
        ctr = next(f for r, f in facts.items() if r.startswith("ctr:"))
        assert doc["supplier"] == sid and nums == [doc["days"], ctr["days"]], a
    else:
        raise AssertionError(f"unknown checkable kind {kind}")
