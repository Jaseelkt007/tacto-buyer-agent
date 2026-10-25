# ruff: noqa: E501 - the prompt is prose the model reads; it reads best unwrapped
"""Hybrid judgment (v2.0 phases 2-3): one model call per move over the labelled packet (`context.py`).

The model chooses among options code has priced; it never writes a number. Code checks every field
of its answer and keeps the rule engine's move (E0) when the answer is invalid, late or missing.
The prompt holds the arena's rules and how to read the packet - no tactics of ours (those would be
rules again, tuned on practice suppliers).

Env: TACTICIAN_MODEL (default claude-opus-5-5), TACTICIAN_EFFORT (low), TACTICIAN_TIMEOUT_S (25).
"""

import logging
import os
import time

from ...cost import complete_offer, must_haves_ok
from .research import llm
from .strategist import clean_paragraph

log = logging.getLogger("arena")
MODEL = os.environ.get("TACTICIAN_MODEL", "claude-opus-5-5")
EFFORT = os.environ.get("TACTICIAN_EFFORT", "low")
TIMEOUT_S = float(os.environ.get("TACTICIAN_TIMEOUT_S", "25"))
MAX_TOKENS = 6000

SYSTEM = """You negotiate by e-mail for the buyer, Hollerau Pumpenwerke, with one supplier. You decide our next move. Code has already priced every option and checks your answer; you never write a number.

How the arena scores us (its rules):
- A deal has a total cost C over the horizon: price, payment terms, freight, delivery, quality, an index clause and its risk, and in stabilise / secure_supply cases a relationship charge when the deal leaves the supplier below a sustainable margin. Lower C is better. Score = (C_open - C_deal) / (C_open - C_best); C_best is the best deal this supplier would ever accept, unknown to us. No deal scores our alternative.
- Term sheets bind; words do not. Only we close, by accepting one of its standing sheets. "agreed" means it offers exactly our terms - we still accept.
- "final_offer" is its last word: push further and it may walk away.
- It answers what we send. A price it will never accept gains nothing; a sheet it accepts at once closes at that price.
- Don't leak urgency, a budget or a missing alternative. Don't take the first offer.

How to read the packet. Every line has a source label:
[A] arena case file or published formula - exact. [D] a data record with its ID - exact (should-cost has about +-5 % error).
[E] our estimate - uncertain, with its range. [S] what the supplier said or sent - its position, possibly a bluff.
[Z] an offline model's reading of its records - an interpretation; weigh it against A, D and S. [us] our earlier messages.
In its e-mail, lines marked ~ are stock lines every supplier writes; they say nothing about this one.

Options. E0 is the rule engine's move: a default tuned on practice cases, not a recommendation. o1, o2, ... are other term mixes, each with prices ("rungs") set by code and our C at each. "health" = the price where our C is lowest on those terms (below it the relationship charge outgrows the saving). "its_level" = the price worth as much to the supplier in cash as its standing sheet; the cash model gives no value to terms a supplier may value (an index clause that protects it, a longer contract, a longer lead time), so it may accept less with such terms. "midway" lies between the lowest rung and its_level.

Think about what this supplier needs and fears (S, Z and D lines), which option gives it that while keeping our C low, and how it will answer. Then decide:
- action "counter": option id and rung name; "accept": option = a sheet id listed under ACCEPT, rung ""; "hold": resend our last sheet unchanged (option "", rung "").
- claims: up to 3 argument ids from ARGUMENTS (each kind once per supplier), only ones that help us; [] for none.
- message: 2-4 sentences of e-mail text in the buyer's voice that fit the chosen sheet. No digits or figures (code adds the argument sentences and the term sheet), no promise of any term that is not on our sheet, nothing about our alternative, budget or timing.
- read: what this supplier needs and where it stands, citing packet lines.
- reason: why this option and rung beat the others, including E0."""

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["read", "action", "option", "rung", "claims", "message", "reason"],
    "properties": {
        "read": {"type": "string"},
        "action": {"type": "string", "enum": ["counter", "accept", "hold"]},
        "option": {"type": "string"},
        "rung": {"type": "string"},
        "claims": {"type": "array", "items": {"type": "string"}},
        "message": {"type": "string"},
        "reason": {"type": "string"},
    },
}


def ask(packet, model=None, effort=None, timeout=None, cache=True):
    """The model's raw answer and its latency; None and the error on failure (the caller keeps E0)."""
    t0 = time.monotonic()
    try:
        answer = llm.ask(
            SYSTEM,
            packet["text"],
            SCHEMA,
            tag="tactician",
            model=model or MODEL,
            effort=effort or EFFORT,
            timeout=timeout or TIMEOUT_S,
            cache=cache,
            max_tokens=MAX_TOKENS,
        )
        return answer, time.monotonic() - t0, None
    except Exception as e:  # late, refused, invalid: the engine's move stands
        return None, time.monotonic() - t0, repr(e)


def to_move(neg, packet, answer, engine_move):
    """The checked move for this answer, or (engine_move, why) when any field is invalid.
    Code rules: options, rungs, claims and sheets must be the packet's; never counter a final offer
    (CLAUDE.md: never push past final_offer); must-haves kept."""
    if not answer:
        return engine_move, "no answer"
    case, sid = neg.case, packet["sid"]
    side = neg.sides[sid]
    action = answer.get("action")
    if action == "accept":
        sheet_id = answer.get("option")
        if sheet_id not in packet["accept"]:
            return engine_move, f"accept of {sheet_id!r}, which is not an acceptable standing sheet"
        return {
            "supplier_id": sid,
            "action": {"type": "accept", "term_sheet_id": sheet_id},
            "why": {"tactician": answer.get("reason")},
        }, "ok"
    if packet.get("status") == "final_offer":
        return engine_move, "its final offer: no counter (accept or the engine's move)"
    claims, kinds, dropped = [], set(), []
    for cid in answer.get("claims") or []:
        c = packet["claims"].get(cid)
        if c is None or c.kind in kinds or len(claims) >= 3:
            dropped.append(cid)  # an argument code cannot vouch for is left out, the move stands
            continue
        claims.append(c)
        kinds.add(c.kind)
    if action == "hold":
        if not side.last_main:
            return engine_move, "hold before any sheet of ours"
        sheet = dict(side.last_main)
    elif action == "counter":
        opt = packet["options"].get(answer.get("option"))
        rung = (opt or {}).get("rungs", {}).get(answer.get("rung"))
        if opt is None or rung is None:
            return engine_move, f"option {answer.get('option')!r} / rung {answer.get('rung')!r} is not in the packet"
        sheet = complete_offer(case, {**opt["terms"], "unit_price": round(rung, 2)})
    else:
        return engine_move, f"unknown action {action!r}"
    if sheet.get("unit_price") is None or sheet["unit_price"] <= 0 or not must_haves_ok(case, sheet, side.standard):
        return engine_move, "the sheet breaks a must-have or has no price"
    message, _ = clean_paragraph(answer.get("message") or "")
    move = {
        "supplier_id": sid,
        "sheets": [sheet],
        "claims": claims,
        "why": {"tactician": answer.get("reason"), "option": answer.get("option"), "rung": answer.get("rung"), "claims_dropped": dropped},
        "paragraph": message,
    }
    return move, "ok" if not dropped else f"ok, claims dropped {dropped}"
