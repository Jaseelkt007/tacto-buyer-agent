"""hedge_aware (O): the supplier's own letter says its material is covered at fixed prices - cite that,
and drop index falls on that material (they meet "not our reality"). No arena, no quota."""

from pathlib import Path

import pytest

from arena_kit.agents.procudeal import claims as cl
from arena_kit.agents.procudeal import policy as po

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = [p for p in (ROOT / "data" / "package", ROOT.parent / "data") if (p / "facts.json").is_file()]


def claim(kind, sentence, **figures):
    return cl.Claim(kind, sentence, ["x"], 1, figures)


def test_hedge_aware_is_off_by_default():
    assert po.FEATURES["hedge_aware"] is False


def test_letter_pattern():
    text = "for your information: our nickel and alloys requirement is covered at fixed prices until March 2027."
    found = cl.HEDGE_LETTER.search(text)
    assert found.group(1) == "nickel and alloys" and found.group(2) == "March 2027"
    assert cl.HEDGE_LETTER.search("they bought their copper forward until March 2027") is None  # a call note


def test_only_index_claims_on_the_hedged_material_are_dropped():
    hedge = claim("hedge", "", material="nickel and alloys")
    alloy = claim("index_change", "Alloy surcharge 1.4404, Isartal changed -5.5% from 2026-06 to 2026-09 (…).")
    steel = claim("index_change", "Producer prices DE: cold drawn bars changed -2.3% from 2026-06 to 2026-08 (…).")
    assert cl.hedged_index(alloy, hedge) and not cl.hedged_index(steel, hedge)
    assert not cl.hedged_index(claim("delivery_record", "Alloy …"), hedge)  # only index claims


@pytest.mark.skipif(not PACKAGES, reason="no data package")
@pytest.mark.parametrize(
    "supplier, material, date",
    [("sup:70710", "nickel and alloys", "2026-07-06"), ("sup:70520", "copper", "2026-06-20")],
)
def test_hedge_letters_in_the_data(supplier, material, date):
    from arena_kit.data import DataPackage

    class D:
        supplier_id = supplier

    (c,) = cl._hedge_letter({}, D, DataPackage(str(PACKAGES[0])), None)
    first, rest = c.sentence.split(". ", 1)
    assert c.kind == "hedge" and c.figures["material"] == material
    assert date in first and c.refs[0] in first and "March 2027" not in first  # only the date is checked
    assert "March 2027" in rest and "doc:" not in rest


@pytest.mark.skipif(not PACKAGES, reason="no data package")
def test_no_hedge_claim_without_a_letter():
    from arena_kit.data import DataPackage

    class D:
        supplier_id = "sup:70560"  # hedged only in our own call note: not cited (call notes drew requests for proof)

    assert cl._hedge_letter({}, D, DataPackage(str(PACKAGES[0])), None) == []
