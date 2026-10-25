import csv
import json
import sqlite3

import pytest

from arena_kit.agents.procudeal.dossier import build
from arena_kit.data import DataPackage


@pytest.fixture
def package(tmp_path):
    base = tmp_path / "package"
    base.mkdir()
    (base / "facts.json").write_text("{}")
    db = sqlite3.connect(base / "world.sqlite")
    db.executescript("""
        CREATE TABLE suppliers (id TEXT, name TEXT, country TEXT, contract_id TEXT,
                                skonto_pct REAL, skonto_days INTEGER);
        INSERT INTO suppliers VALUES ('sup:test', 'Test Supplier', 'DE', 'ctr:test', 0, 0);
        CREATE TABLE supplier_intel (supplier_id TEXT, owner_type TEXT);
        INSERT INTO supplier_intel VALUES ('sup:test', 'private');
        CREATE TABLE scorecards (supplier_id TEXT, quarter TEXT, ppm REAL);
        INSERT INTO scorecards VALUES ('sup:test', '2026Q3', 120);
        CREATE TABLE documents (id TEXT, supplier_id TEXT, date TEXT, subject TEXT, body TEXT);
        CREATE TABLE news (id TEXT, supplier_id TEXT, headline TEXT, body TEXT);
        CREATE TABLE should_cost (id TEXT, part_id TEXT, supplier_id TEXT, unit_cost REAL);
        INSERT INTO should_cost VALUES ('cost:test', 'part:test', 'sup:test', 42);
    """)
    db.commit()
    db.close()
    return base


def release(base, kind, text, supplier="sup:test"):
    root = base.parent / "release-sunday"
    (root / "data").mkdir(parents=True)
    ref = f"{'doc' if kind == 'documents' else 'news'}:new"
    fact = {"supplier": supplier, "title": "Update"}  # body is deliberately absent from facts.json
    (root / "facts.json").write_text(json.dumps({ref: fact}))
    row = {"id": ref, "supplier_id": supplier, "body": text}
    with (root / "data" / f"{kind}.csv").open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(row))
        writer.writeheader()
        writer.writerow(row)
    return ref


@pytest.mark.parametrize("kind,text,signal", [
    ("documents", "We need faster payment to support our liquidity.", "cash_need"),
    ("news", "The supplier has free capacity and is looking for new customers.", "wants_work"),
    ("documents", "Our material is covered at fixed prices.", "hedged"),
    ("documents", "Our steel is bought forward at fixed prices with our mill.", "hedged"),
])
def test_release_text_reaches_deterministic_dossier(package, kind, text, signal):
    ref = release(package, kind, text)
    d = build({"parts": ["part:test"]}, "sup:test", DataPackage(package))
    assert getattr(d, signal)
    assert ref in d.source_ids
    assert d.full_cost == 42 and d.ppm == 120 and d.country == "DE"
    assert d.interest_rate == pytest.approx(0.12 if signal == "cash_need" else 0.07)


@pytest.mark.parametrize("supplier", ["", "sup:other"])
def test_global_and_other_supplier_news_do_not_change_our_dossier(package, supplier):
    release(package, "news", "Liquidity crisis: faster payment and free capacity.", supplier)
    d = build({"parts": ["part:test"]}, "sup:test", DataPackage(package))
    assert not d.cash_need and not d.wants_work
    assert d.interest_rate == 0.07


def test_original_sqlite_documents_still_work_without_release(package):
    db = sqlite3.connect(package / "world.sqlite")
    db.execute("INSERT INTO documents VALUES (?, ?, ?, ?, ?)",
               ("doc:old", "sup:test", "2026-09-01", "Request", "Please arrange faster payment."))
    db.commit()
    db.close()
    d = build({"parts": ["part:test"]}, "sup:test", DataPackage(package))
    assert d.cash_need and d.full_cost == 42
