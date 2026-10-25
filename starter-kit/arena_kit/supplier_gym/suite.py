"""Frozen suite inputs and their arithmetic checks. Never runs a buyer or calls a model."""

import hashlib
import json
from pathlib import Path

from ..cost import must_haves_ok, total_cost
from .chooser import ReferenceChooser
from .sim import GymSim


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def load_suite(root):
    root = Path(root).resolve()
    seal_path = root / "seal.json"
    manifest_path = root / "manifest.json"
    metadata = json.loads(manifest_path.read_text()) if manifest_path.is_file() else {}
    if isinstance(metadata, dict) and metadata.get("suite_id") and not seal_path.is_file():
        raise ValueError("versioned suite is missing its seal")
    integrity = {"sealed": seal_path.is_file()}
    if seal_path.is_file():
        seal = json.loads(seal_path.read_text())
        expected = seal["files"]
        actual = {str(p.relative_to(root)) for kind in ("public", "private") for p in (root / kind).glob("*.json")} | {
            "manifest.json",
            "protocol.md",
        }
        if set(expected) != actual:
            raise ValueError("sealed suite file inventory changed")
        for name, expected_hash in expected.items():
            path = (root / name).resolve()
            if not path.is_relative_to(root) or digest(path) != expected_hash:
                raise ValueError(f"sealed suite changed: {name}")
        integrity["seal_sha256"] = digest(seal_path)
    fixtures, paths = [], {}
    for path in sorted((root / "public").glob("*.json")):
        case = json.loads(path.read_text())
        if case.get("case_id") != f"case:{path.stem}":
            raise ValueError("case ID must match its public filename")
        private_path = root / "private" / path.name
        profiles = json.loads(private_path.read_text())
        if set(profiles) != set(case["suppliers"]) or len(case["suppliers"]) != len(set(case["suppliers"])):
            raise ValueError("private profiles must match public suppliers")
        fixtures.append((case, profiles))
        paths[case["case_id"]] = (path, private_path)
    if not 1 <= len(fixtures) <= 10:
        raise ValueError("a wave requires 1–10 cases")
    return fixtures, paths, integrity


def validate_suite(root):
    fixtures, _, integrity = load_suite(root)
    rows = []
    for case, profiles in fixtures:
        sim = GymSim(case, profiles, ReferenceChooser())
        openings = []
        for sid, policy in sim.policies.items():
            opening = policy.opening()
            if not policy.feasible(opening):
                raise ValueError(f"infeasible opening: {case['case_id']} {sid}")
            if must_haves_ok(case, opening, policy.standard):
                openings.append(total_cost(case, opening, policy.standard))
            for turn in (1, policy.profile.final_round):
                for action in policy.menu(turn, opening, []):
                    if action.terms and not policy.feasible(action.terms):
                        raise ValueError("infeasible menu action")
        if not openings:
            raise ValueError("suite requires at least one opening that keeps the buyer's must-haves")
        best = sim.benchmark(case)
        if best is None:
            raise ValueError("suite requires a feasible supplier package")
        alt_terms = case["buyer"].get("alternative", {}).get("terms", {})
        alt = total_cost(case, alt_terms) if alt_terms.get("unit_price") else None
        baseline = min([*openings, *([alt] if alt is not None else [])])
        rows.append(
            {
                "case_id": case["case_id"],
                "suppliers": len(profiles),
                "opening_baseline_cost": baseline,
                "supplier_financial_floor_cost": best[0],
                "alternative_cost": alt,
            }
        )
    return {"integrity": integrity, "cases": rows, "buyer_runs": 0, "model_calls": 0}
