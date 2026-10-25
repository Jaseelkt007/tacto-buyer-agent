"""Zone 1: the case strategist. Before a session opens, one model call turns the case file and the
zone 0 dossiers of its suppliers into a bounded plan the engine plays with (see docs/research.md).

The plan can only point at things code already owns: arguments by their library ID (code holds the
verified sentence), trades as a negotiable field plus an option index from the case's term options,
a stance from a fixed list, and one figure-free opening paragraph. Validation drops anything else.
No plan (model off, error, timeout) leaves the engine exactly as it is.
"""

import json
import logging
import os
import re
import threading
import time
from pathlib import Path

from .research import agents as ag
from .research import llm

log = logging.getLogger("arena")
KNOWLEDGE = Path(__file__).resolve().parents[3] / "knowledge"
MODEL = os.environ.get("STRATEGIST_MODEL", "claude-opus-5-5")
EFFORT = os.environ.get("STRATEGIST_EFFORT", "low")
TIMEOUT_S = float(os.environ.get("STRATEGIST_TIMEOUT_S", "180"))
STANCES = ("soft", "normal", "hard")  # the engine maps them to an anchor shift (policy.STANCE_SHIFT)
WHEN = ["opening", "later", "if_challenged"]
TRADE_WHEN = ["opening", "closing", "if_asked"]
# e-mail text: no figure, no data ID, nothing that leaks urgency, a budget or a missing alternative
FORBIDDEN = re.compile(
    r"\d|\b(?:idx|quote|offer|sc|qn|po|cost|fc|news|doc|ctr|sup|part):|urgent|urgency|deadline|budget|"
    r"no alternative|walk away|other options|last chance|must close|time pressure|target price|ultimatum",
    re.I,
)
_LOCK, _DOSSIERS = threading.Lock(), {}

SYSTEM = (
    ag.WORLD
    + """

YOUR ROLE
A new negotiation case has just arrived. Before we send the first e-mail, you plan it. You have the
case file (our need, goal, rates, must-haves, our alternative, the letter that started it, what is
negotiable and the allowed options), our team's dossier on each supplier (prepared earlier from all
our records), and the lessons from our practice negotiations.

Plan for EACH supplier of the case:
- levers: the arguments to use, by arg_id from that supplier's ARGUMENTS list only, in order, with
  when to use each (opening = first e-mail, at most three of different kinds; later = one per round;
  if_challenged = only if it disputes our data). Prefer checkable arguments for this case's parts.
- blocked: arg_ids that would backfire in this case (they argue its side, reveal a weak alternative,
  or are not checkable).
- trades: terms to offer, each as a negotiable field and the INDEX of one allowed option from the
  case's TERM OPTIONS, with when (opening = in our main proposal; closing = keep for the last step;
  if_asked = only if it asks). Only terms likely worth more to this supplier than they cost us.
  contractual = true only when the contract or the supplier's own position already grants the option
  (e.g. a price change can only start on the date the contract allows), so it needs no price.
- opening_paragraph: 2-4 short sentences (at most 600 characters) for the first e-mail, written to
  this supplier's people in the tone that fits them: acknowledge what matters to them, frame the case.
  NO digits at all - not in years, part numbers or product names (write "the motor", "the bearing",
  "in the last crisis") - no record IDs, no urgency, budget or threats. Code adds every figure.
- tone, and what to watch for in its replies.
Then the case-level stance: soft (open close to its price: strategic or fragile supplier), normal, or
hard (open low: competition, overpriced, strong leverage). Code sets every price from the stance;
you never write a price."""
)

PLAN_SCHEMA = ag._obj(
    {
        "key_points": ag._arr(ag.STR),
        "stance": ag._enum(list(STANCES)),
        "stance_why": ag.STR,
        "suppliers": ag._arr(
            ag._obj(
                {
                    "supplier_id": ag.STR,
                    "role": ag._enum(["main", "competitor", "unlikely"]),
                    "levers": ag._arr(ag._obj({"arg_id": ag.STR, "when": ag._enum(WHEN), "why": ag.STR})),
                    "blocked": ag._arr(ag.STR),
                    "trades": ag._arr(
                        ag._obj(
                            {
                                "field": ag._enum(ag.FIELDS),
                                "option": {"type": "integer"},
                                "when": ag._enum(TRADE_WHEN),
                                "contractual": {"type": "boolean"},
                                "why": ag.STR,
                            }
                        )
                    ),
                    "opening_paragraph": ag.STR,
                    "tone": ag._enum(["warm", "businesslike", "firm"]),
                    "watch_for": ag._arr(ag.STR),
                }
            )
        ),
        "risks": ag._arr(ag.STR),
    }
)


def dossier(sid):
    """The zone 0 dossier of a supplier, or None (cached; files are read once)."""
    with _LOCK:
        if sid not in _DOSSIERS:
            path = KNOWLEDGE / "suppliers" / f"{sid.replace(':', '_')}.json"
            try:
                _DOSSIERS[sid] = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                _DOSSIERS[sid] = None
        return _DOSSIERS[sid]


def _document(package, ref):
    if not package or not ref:
        return ""
    try:
        from .dossier import document

        return document(package, ref)
    except Exception:  # a missing letter must not stop the plan
        return ""


def case_text(case, package=None):
    b = case["buyer"]
    options = case.get("term_options") or {}
    lines = [
        f"CASE {case['case_id']}: {case.get('title')} (type {case.get('type')}, goal {b.get('category_goal')})",
        f"BRIEFING: {case.get('briefing')}",
        f"PARTS: {case.get('parts')}   SUPPLIERS: {case.get('suppliers')}",
        f"NEED: {b.get('need_per_year')} per year over {b.get('horizon_years')} years; current price "
        f"{b.get('current_unit_price')}; fallback price {b.get('fallback_unit_price')}; our cost of money "
        f"{b.get('interest_rate')}; our standard payment {b.get('reference_payment_days')} days; need lead time "
        f"{b.get('need_lead_time_days')} days",
        f"MUST-HAVES: {json.dumps(b.get('must_haves'))}",
        f"OUR ALTERNATIVE (no deal): {json.dumps(b.get('alternative'), ensure_ascii=False)}",
        f"NEGOTIABLE: {case.get('negotiable')}   FIXED: {json.dumps(case.get('fixed_terms'), ensure_ascii=False)}",
        "TERM OPTIONS (use the index):",
    ]
    for field, values in options.items():
        lines.append(
            f"  {field}: " + "  ".join(f"[{i}] {json.dumps(v, ensure_ascii=False)}" for i, v in enumerate(values))
        )
    for key in ("sustainable_margin_pct", "relationship_eur_per_point", "index_paths", "index_risk_pct"):
        if b.get(key) not in (None, {}, []):
            lines.append(f"{key}: {b.get(key)}")
    lines.append(f"REFS: {case.get('refs')}")
    letter = _document(package, case.get("trigger_doc"))
    if letter:
        lines.append(f"TRIGGER LETTER ({case.get('trigger_doc')}):\n{letter}")
    for ref, fact in (case.get("facts") or {}).items():
        lines.append(f"CASE FACT {ref}: {json.dumps(fact, ensure_ascii=False)[:1500]}")
    return "\n".join(lines)


def _for_case(arguments, case):
    parts = set(case.get("parts") or [])
    return [a for a in arguments if not a.get("part") or a["part"] in parts]


def supplier_text(sid, d, arguments):
    if not d or not d.get("strategy"):
        head = [f"SUPPLIER {sid}: no dossier (a new supplier) - plan from the case file alone."]
    else:
        s = d["strategy"]
        head = [
            f"SUPPLIER {sid} - {d.get('name')}",
            f"SUMMARY: {s.get('summary')}",
            f"PERSONA: {json.dumps(s.get('persona'), ensure_ascii=False)}",
            f"NEEDS: {json.dumps(s.get('needs'), ensure_ascii=False)}",
            f"CONSTRAINTS: {json.dumps(s.get('constraints'), ensure_ascii=False)}",
            f"PRICE VIEW: {json.dumps(s.get('price_view'), ensure_ascii=False)}",
            f"TONE: {json.dumps(s.get('tone'), ensure_ascii=False)}",
            f"TRAPS: {json.dumps(s.get('traps'), ensure_ascii=False)}",
            f"TRADES IT VALUES: {json.dumps(s.get('trades'), ensure_ascii=False)}",
            f"WRITER NOTES: {s.get('writer_notes')}",
        ]
        red = d.get("red_team") or {}
        reb = {r["to"]: r["answer"] for r in (d.get("rebuttals") or {}).get("rebuttals") or []}
        for i, a in enumerate(red.get("arguments") or [], 1):
            head.append(f"ITS LIKELY ARGUMENT {i}: {a.get('text')}  OUR ANSWER: {reb.get(i, '-')}")
    head.append("ARGUMENTS (arg_id [kind, side, checkable or context, part] text):")
    for a in arguments:
        check = "checkable" if a.get("checkable") else "context"
        head.append(
            f"- {a['arg_id']} [{a['kind']}, {a['side']}, {check}, {a.get('part') or 'all'}] "
            f"{a.get('sentence') or a.get('note') or ''}"
        )
    return "\n".join(head)


def lessons_text(case):
    try:
        book = json.loads((KNOWLEDGE / "playbook.json").read_text(encoding="utf-8"))["general"]
    except (OSError, ValueError, KeyError):
        return ""
    goal, kind = case["buyer"].get("category_goal"), case.get("type")
    lines = []
    for lsn in book.get("lessons") or []:
        if {goal, "any"} & set(lsn.get("goals") or ["any"]) and {kind, "any"} & set(lsn.get("case_types") or ["any"]):
            lines.append(f"- [{lsn.get('confidence')}] {lsn.get('rule')} DO: {lsn.get('do')} DON'T: {lsn.get('dont')}")
    return "\n".join(lines)


MAX_PARAGRAPH = 900


def clean_paragraph(text):
    """(kept, cut): the sentences without a figure, ID or leak, up to MAX_PARAGRAPH characters."""
    sentences = re.split(r"(?<=[.!?])\s+", " ".join(str(text or "").split()))
    kept, cut = [], []
    for sentence in filter(None, sentences):
        if FORBIDDEN.search(sentence) or len(" ".join(kept + [sentence])) > MAX_PARAGRAPH:
            cut.append(sentence)
        else:
            kept.append(sentence)
    paragraph = " ".join(kept)
    return (paragraph if len(paragraph) >= 40 else ""), " ".join(cut)


def validate(raw, case, arguments):
    """The plan with every value checked against the case and the libraries; drops are listed."""
    options, negotiable = case.get("term_options") or {}, set(case.get("negotiable") or [])
    dropped, suppliers = [], {}
    for entry in raw.get("suppliers") or []:
        sid = entry.get("supplier_id")
        if sid not in (case.get("suppliers") or []) or sid in suppliers:
            dropped.append({"where": "suppliers", "value": sid, "why": "not a supplier of this case"})
            continue
        library = {a["arg_id"]: a for a in arguments.get(sid, [])}
        levers, seen = [], set()
        for lv in entry.get("levers") or []:
            arg = library.get(lv.get("arg_id"))
            if not arg or arg["arg_id"] in seen:
                dropped.append({"where": f"{sid}.levers", "value": lv.get("arg_id"), "why": "unknown or repeated"})
                continue
            seen.add(arg["arg_id"])
            levers.append({"arg_id": arg["arg_id"], "when": lv.get("when"), "why": lv.get("why"), "argument": arg})
        blocked = [
            {"arg_id": b, "kind": library[b]["kind"], "refs": list(library[b].get("refs") or [])}
            for b in dict.fromkeys(entry.get("blocked") or [])
            if b in library and b not in seen
        ]
        trades = []
        for t in entry.get("trades") or []:
            field, i = t.get("field"), t.get("option")
            values = options.get(field) or []
            if field not in negotiable or field == "unit_price" or not isinstance(i, int) or not 0 <= i < len(values):
                dropped.append({"where": f"{sid}.trades", "value": f"{field}[{i}]", "why": "not an allowed option"})
                continue
            trades.append(
                {
                    "field": field,
                    "option": i,
                    "value": values[i],
                    "when": t.get("when"),
                    "contractual": bool(t.get("contractual")),
                    "why": t.get("why"),
                }
            )
        paragraph, cut = clean_paragraph(entry.get("opening_paragraph"))
        if cut:
            dropped.append(
                {"where": f"{sid}.opening_paragraph", "value": cut[:300], "why": "figure, ID, leak or length"}
            )
        suppliers[sid] = {
            "role": entry.get("role"),
            "levers": levers,
            "blocked": blocked,
            "trades": trades,
            "opening_paragraph": paragraph,
            "tone": entry.get("tone"),
            "watch_for": entry.get("watch_for") or [],
        }
    return {
        "key_points": raw.get("key_points") or [],
        "stance": raw.get("stance") if raw.get("stance") in STANCES else "normal",
        "stance_why": raw.get("stance_why"),
        "suppliers": suppliers,
        "risks": raw.get("risks") or [],
        "dropped": dropped,
    }


def arguments_for(case, package=None):
    """Each supplier's argument library for this case's parts: from its dossier, else built now."""
    out = {}
    for sid in case.get("suppliers") or []:
        d = dossier(sid)
        args = (d or {}).get("arguments")
        if args is None and package is not None:
            try:
                from .research import library

                args = library.argument_library(package, sid)
            except Exception:  # a supplier the package does not know
                args = []
        out[sid] = _for_case(args or [], case)
    return out


def make_plan(case, package=None, effort=None, model=None, timeout=None):
    """The validated plan for a case, with `meta` (seconds, model, which dossiers existed)."""
    t0 = time.monotonic()
    arguments = arguments_for(case, package)
    parts = [case_text(case, package)]
    for sid in case.get("suppliers") or []:
        parts.append(supplier_text(sid, dossier(sid), arguments[sid]))
    lessons = lessons_text(case)
    if lessons:
        parts.append(f"{ag.PLAYBOOK_HEAD}:\n{lessons}")
    parts.append("Plan the negotiation.")
    raw = llm.ask(
        SYSTEM,
        "\n\n".join(parts),
        PLAN_SCHEMA,
        tag=f"strategist:{case['case_id']}",
        effort=effort or EFFORT,
        model=model or MODEL,
        timeout=timeout or TIMEOUT_S,
    )
    plan = validate(raw, case, arguments)
    plan["meta"] = {
        "model": model or MODEL,
        "effort": effort or EFFORT,
        "seconds": round(time.monotonic() - t0, 1),
        "dossiers": {sid: dossier(sid) is not None for sid in case.get("suppliers") or []},
        "prompt_chars": sum(len(p) for p in parts),
    }
    return plan
