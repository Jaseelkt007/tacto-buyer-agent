"""One supplier's dossier: evidence and arguments (code) -> four specialists in parallel -> lead
strategist -> red-team supplier -> buyer rebuttals (Opus 5.5) -> validated JSON.

Validation keeps only what code can stand behind: record IDs that exist in the evidence or the
argument library, argument IDs from the library, enum values from their lists, rebuttal numbers that
point at a real argument. Sentences meant for e-mails (rebuttals, press, writer notes, questions) lose
any part with a figure. Everything dropped is listed under `validation`.
"""

import json
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from ..dossier import lookup
from . import agents as ag
from . import evidence as ev
from . import library as lb
from . import llm

log = logging.getLogger("research")
ID = re.compile(r"^(?:[a-z]+:[^\s\[\]]+|EV-[\w-]+)$")  # citable IDs and negotiation-history events
DIGIT = re.compile(r"\d")
HEADER = ["master", "intel"]  # every specialist also sees who the supplier is
PLAYBOOK = Path(__file__).resolve().parents[4] / "knowledge" / "playbook.json"


def playbook_text(path=PLAYBOOK):
    """The playbook's general lessons as prompt lines (empty before it is built)."""
    try:
        general = json.loads(path.read_text(encoding="utf-8"))["general"]
    except (OSError, ValueError, KeyError):
        return ""
    lines = [
        f"- [{lsn.get('confidence')} confidence, {lsn.get('cases_seen')} cases] {lsn.get('rule')} "
        f"DO: {lsn.get('do')} DON'T: {lsn.get('dont')}"
        for lsn in general.get("lessons") or []
    ]
    if general.get("concession_dynamics"):
        lines.append(f"- Concession dynamics: {general['concession_dynamics']}")
    return "\n".join(lines)


def _ids(obj, out=None):
    """Every citable ID anywhere in the evidence."""
    out = set() if out is None else out
    if isinstance(obj, dict):
        for v in obj.values():
            _ids(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _ids(v, out)
    elif isinstance(obj, str) and ID.match(obj):
        out.add(obj)
    return out


def library_text(arguments):
    lines = []
    for a in arguments:
        part = f" part={a['part']}" if a.get("part") else ""
        check = "checkable" if a.get("checkable") else "context"
        lines.append(
            f"- {a['arg_id']} [{a['kind']}, {a['side']}, {check}{part}] {a.get('note') or a.get('sentence') or ''}"
        )
    return "\n".join(lines) or "(no arguments)"


class Checker:
    """Keeps returned values that code can verify; records what it drops."""

    def __init__(self, known_ids, arg_ids, exists=None):
        self.known, self.args, self.dropped = known_ids, arg_ids, []
        self.exists = exists or (lambda ref: False)  # an ID the data package knows, outside this evidence

    def ids(self, values, where):
        """Record IDs and library argument IDs that exist; anything else is dropped."""
        out = []
        for v in values or []:
            v = str(v).strip().strip("[]()")
            if v in self.known or v in self.args or self.exists(v):
                out.append(v)
            else:
                self.dropped.append({"where": where, "value": v, "why": "unknown record ID"})
        return out

    def arg(self, value, where):
        if value in self.args:
            return value
        self.dropped.append({"where": where, "value": value, "why": "not in the argument library"})
        return None

    def plain(self, text, where):
        """Text that may reach an e-mail: no figures. Drops the sentences that carry one."""
        text = " ".join(str(text or "").split())
        keep = [s for s in re.split(r"(?<=[.!?])\s+", text) if s and not DIGIT.search(s)]
        if len(" ".join(keep)) < len(text):
            self.dropped.append({"where": where, "value": text[:200], "why": "figure in e-mail text"})
        return " ".join(keep)


def check_specialist(raw, c, name):
    return {
        "findings": [
            {**f, "evidence": c.ids(f.get("evidence"), f"{name}.findings")} for f in raw.get("findings") or []
        ],
        "leverage": raw.get("leverage"),
        "supplier_wants": raw.get("supplier_wants") or [],
        "risks": raw.get("risks") or [],
        "useful_arguments": [
            u for u in raw.get("useful_arguments") or [] if c.arg(u.get("arg_id"), f"{name}.useful_arguments")
        ],
        "open_questions": raw.get("open_questions") or [],
    }


def check_lead(raw, c):
    out = dict(raw)
    out["needs"] = [{**n, "evidence": c.ids(n.get("evidence"), "lead.needs")} for n in raw.get("needs") or []]
    out["constraints"] = [
        {**k, "evidence": c.ids(k.get("evidence"), "lead.constraints")} for k in raw.get("constraints") or []
    ]
    out["levers"] = [lv for lv in raw.get("levers") or [] if c.arg(lv.get("arg_id"), "lead.levers")]
    out["writer_notes"] = c.plain(raw.get("writer_notes"), "lead.writer_notes")
    out["questions_to_ask"] = [
        q for q in (c.plain(q, "lead.questions") for q in raw.get("questions_to_ask") or []) if q
    ]
    return out


def check_supplier(raw, c):
    out = dict(raw)
    out["arguments"] = [
        {**a, "evidence": c.ids(a.get("evidence"), "red_team.arguments")} for a in raw.get("arguments") or []
    ]
    return out


def check_buyer(raw, c, n_arguments):
    rebuttals = []
    for r in raw.get("rebuttals") or []:
        if not isinstance(r.get("to"), int) or not 1 <= r["to"] <= n_arguments:
            c.dropped.append({"where": "rebuttals", "value": r.get("to"), "why": "no such supplier argument"})
            continue
        answer = c.plain(r.get("answer"), "rebuttals.answer")
        if answer:
            rebuttals.append(
                {
                    "to": r["to"],
                    "answer": answer,
                    "arg_ids": [a for a in r.get("arg_ids") or [] if c.arg(a, "rebuttals")],
                }
            )
    press = [p for p in (c.plain(p, "rebuttals.press") for p in raw.get("press") or []) if p]
    return {"rebuttals": rebuttals, "press": press}


def _safe(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs), None
    except Exception as e:  # one failed agent must not lose the dossier
        log.exception("agent failed: %s", kwargs.get("tag"))
        return None, repr(e)


def build(pkg, sid, effort=None):
    """The validated dossier of one supplier (a dict ready for JSON)."""
    t0 = time.monotonic()
    evidence = ev.supplier_evidence(pkg, sid)
    arguments = lb.argument_library(pkg, sid, evidence)
    known = _ids(evidence) | {r for a in arguments for r in a.get("refs") or []}
    c = Checker(known, {a["arg_id"] for a in arguments}, lambda ref: bool(lookup(pkg, ref)))
    full, lib, lessons = ev.render(evidence), library_text(arguments), playbook_text()
    errors = {}

    with ThreadPoolExecutor(max_workers=len(ag.SPECIALISTS)) as pool:
        jobs = {}
        for name, (role, scope, goal) in ag.SPECIALISTS.items():
            text = ev.render(evidence, list(dict.fromkeys(HEADER + list(ev.SLICES.get(name, [])))))
            system = ag.SPECIALIST_SYSTEM.format(name=role, scope=scope, goal=goal)
            user = ag.specialist_user(role, text, lib)
            jobs[name] = pool.submit(
                _safe, llm.ask, system, user, ag.SPECIALIST_SCHEMA, tag=f"specialist:{name}", effort=effort
            )
        reports = {}
        for name, job in jobs.items():
            raw, err = job.result()
            if err:
                errors[name] = err
            reports[name] = check_specialist(raw, c, name) if raw else None

    report_text = {n: json.dumps(r, ensure_ascii=False) for n, r in reports.items() if r}
    raw, err = _safe(
        llm.ask,
        ag.LEAD_SYSTEM,
        ag.lead_user(full, lib, report_text, lessons),
        ag.LEAD_SCHEMA,
        tag="lead",
        effort=effort,
    )
    strategy = check_lead(raw, c) if raw else None
    if err:
        errors["lead"] = err

    red_team = rebuttals = None
    if strategy:
        summary = json.dumps(
            {k: strategy.get(k) for k in ("summary", "needs", "constraints", "price_view")}, ensure_ascii=False
        )
        raw, err = _safe(
            llm.ask,
            ag.SUPPLIER_SYSTEM,
            ag.supplier_user(full, summary),
            ag.SUPPLIER_SCHEMA,
            tag="red_team",
            effort=effort,
        )
        red_team = check_supplier(raw, c) if raw else None
        if err:
            errors["red_team"] = err
    if red_team and red_team.get("arguments"):
        numbered = "\n".join(f"{i}. {a['text']}" for i, a in enumerate(red_team["arguments"], 1))
        weak = "\n".join(f"- {w}" for w in red_team.get("weak_points") or [])
        user = ag.buyer_user(
            full, lib, json.dumps(strategy, ensure_ascii=False), f"{numbered}\nWEAK POINTS:\n{weak}", lessons
        )
        raw, err = _safe(llm.ask, ag.BUYER_SYSTEM, user, ag.BUYER_SCHEMA, tag="rebuttals", effort=effort)
        rebuttals = check_buyer(raw, c, len(red_team["arguments"])) if raw else None
        if err:
            errors["rebuttals"] = err

    return {
        "supplier_id": sid,
        "name": evidence.get("name"),
        "meta": {
            "model": llm.MODEL,
            "effort": effort or llm.EFFORT,
            "built": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "seconds": round(time.monotonic() - t0, 1),
            "evidence_chars": len(full),
            "arguments": len(arguments),
            "errors": errors,
        },
        "strategy": strategy,
        "specialists": reports,
        "red_team": red_team,
        "rebuttals": rebuttals,
        "arguments": arguments,
        "validation": {"dropped": c.dropped},
    }
