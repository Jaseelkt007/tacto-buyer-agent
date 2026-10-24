"""Tolerant reader for the supplier's quote PDF (v1.7).

The kit's `docs.quote_terms` raises on the first line it cannot read, and then every standard term
of that supplier is lost. Here each line is read on its own with the kit's labels and sections: a
bad line is skipped and the rest kept. An Incoterm the case does not price counts as the costliest
(as `cost.closing_terms` assumes for a missing one), so a cost lookup can never fail on it.
"""

import logging
import re

from ...docs import CLAUSE, LABELS, SECTIONS

log = logging.getLogger("arena")
NUMBER = re.compile(r"-?\d[\d,]*(?:\.\d+)?")


def _value(field, text):
    if field == "index_clause":
        m = CLAUSE.match(text)
        if not m:
            return None  # "none" (or a form we cannot read): no clause
        series, share, deadband, base = m.groups()
        return {
            "series": series,
            "material_share": int(share) / 100,
            "deadband_pct": float(deadband),
            "base_month": base,
        }
    if field in ("effective_date", "incoterm"):
        if not text:
            raise ValueError("empty")
        return text.split()[0] if field == "incoterm" else text
    m = NUMBER.search(text)
    if not m:
        raise ValueError(f"no number in {text!r}")
    number = float(m.group().replace(",", ""))
    return number if "eur" in field or field == "unit_price" else int(number)


def sections(text):
    """Terms per section of a quote or order confirmation: stated, standard, fixed, agreed."""
    out, section = {}, None
    for raw in (text or "").splitlines():
        line = raw.strip()
        section = next((key for head, key in SECTIONS.items() if line.startswith(head)), section)
        label = next((lab for lab in LABELS if line.startswith(lab + " ")), None)
        if not (section and label):
            continue
        field = LABELS[label]
        try:
            out.setdefault(section, {})[field] = _value(field, line[len(label) :].strip())
        except (ValueError, TypeError, AttributeError) as e:
            log.warning("quote line skipped (%s): %r", e, line[:120])
    return out


def _texts(events, newest_first):
    msgs = reversed(events) if newest_first else events
    for msg in msgs:
        for att in msg.get("attachments") or []:
            if att.get("name", "").startswith("quote") and att.get("text"):
                yield att["text"]
                break


def sane(case, terms):
    """Terms with an Incoterm the case prices (an unknown one counts as the costliest)."""
    freight = case["buyer"]["freight_eur_per_unit"]
    if terms.get("incoterm") is not None and terms["incoterm"] not in freight:
        log.warning("unknown Incoterm %r counted as the costliest", terms["incoterm"])
        terms = {**terms, "incoterm": max(freight, key=freight.get)}
    return terms


def standard_terms(case, events):
    """The supplier's standard terms from the latest quote PDF in the thread (empty if none)."""
    for text in _texts(events, newest_first=True):
        return sane(case, sections(text).get("standard", {}))
    return {}


def first_quote(case, events):
    """Every section of the first quote PDF in the thread, Incoterms checked."""
    for text in _texts(events, newest_first=False):
        return {k: sane(case, v) for k, v in sections(text).items()}
    return {}
