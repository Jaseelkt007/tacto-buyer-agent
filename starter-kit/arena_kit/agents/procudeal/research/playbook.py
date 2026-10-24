"""Playbook corpus: our practice negotiations, one compact record per run, for the playbook LLM.

Reads the benchmark run files `runs/<case>/<time>_<agent>_<session>.json` (scripts/bench.py):
the result, the trace (every e-mail with its terms, status, claim results and the supplier's
reasons in words), the supplier's back office and our engine's decision trace. Prices are kept
as shares of the supplier's opening price, so a lesson carries over to other parts and suppliers.

Deterministic code: no arena call, no LLM call, read-only on runs/ and the data package.
See docs/research.md ("playbook.py").

A record (practice_corpus) - prices are shares of that supplier's opening price, C values of C_open:
    case_id, title, type, category_goal, n_suppliers, negotiable, must_haves, alternative, round_limit,
    agent, commit, note, when, session_id, file, features_off,
    score, deal, must_haves_ok, end_reason, c_open, c_deal, c_best, c_alt (EUR) and their *_share,
    winner, deal_price, deal_terms, cost_breakdown, rounds, seconds, close {type, supplier_id, round,
    offer_id, alternative, price},
    threads: [{supplier_id, name, role (who writes), opening_price (EUR), opening_terms, missing_fields,
               opening_delay_days, opening_validity_days, opening_excerpt, status, offers,
               persona {owner_type, country, cash_need, wants_work, capacity_full, hedged, full_cost,
                        full_cost_source, notes} (with a package),
               ours: [{round, step, type (message|timeout|accept|walk_away), price, n_sheets,
                       sheets [{price, terms}], claims [{kind, result, effect}], refs (ID prefixes),
                       excerpt, engine {action, source, anchor, ceiling, claims, asks, traits, why, ...}}],
               theirs: [{round, step, status, price, terms, alternatives [{price, terms}], claims,
                         missing_fields, delay_days, validity_days, excerpt, reasons}],
               backoffice: [{round, from, to, text}]}]
`step` is the position in the trace; `effect` is the supplier's own answer to that claim
("counted", "no effect", "already counted" or its words).

    uv run python -m arena_kit.agents.procudeal.research.playbook            # corpus stats
    uv run python -m arena_kit.agents.procudeal.research.playbook --show P05 # rendered records
"""

import argparse
import json
import logging
import os
import re
from collections import Counter, defaultdict
from pathlib import Path

log = logging.getLogger("arena")

KIT = Path(__file__).resolve().parents[4]  # starter-kit/
RUNS = KIT.parent / "runs"
CASES = KIT / "knowledge" / "practice_cases.json"
PACKAGE = KIT / "data" / "package"

AGENTS = ("procudeal", "llm", "naive")
EXCERPT = 400  # characters of a supplier e-mail kept per reply
OUR_EXCERPT = 300  # characters of our e-mail kept per message (the llm and naive agents write free text)
REASON = 200  # characters per reason
REASONS = 12  # reasons kept per reply
BACKOFFICE = 200  # characters per back-office line
RENDER_CHARS = 6000  # about 1,500 tokens per run
# Detail levels of render(): the first that fits RENDER_CHARS wins. `key`: excerpts only for the
# opening, the first reply, a change of status and the last reply.
LEVELS = (
    {"excerpt": 400, "key": False, "reasons": 8, "backoffice": True, "ours": 200, "engine": True},
    {"excerpt": 250, "key": False, "reasons": 6, "backoffice": True, "ours": 0, "engine": True},
    {"excerpt": 220, "key": True, "reasons": 5, "backoffice": True, "ours": 0, "engine": True},
    {"excerpt": 160, "key": True, "reasons": 4, "backoffice": False, "ours": 0, "engine": True},
    {"excerpt": 120, "key": True, "reasons": 3, "backoffice": False, "ours": 0, "engine": False},
    {"excerpt": 0, "key": True, "reasons": 2, "backoffice": False, "ours": 0, "engine": False},
)
SHORT = {
    "payment_days": "pay",
    "lead_time_days": "lead",
    "volume_per_year": "vol",
    "contract_months": "months",
    "effective_date": "from",
    "index_clause": "clause",
    "incoterm": "inco",
    "tooling_eur": "tooling",
    "ppm_commitment": "ppm",
    "chargeback_eur_per_complaint": "chargeback",
}
# Back-office lines that carry no information (attachments of every quote, the e-mail reading template).
BO_NOISE = re.compile(
    r"^(?:quote attached|delivery schedule attached|order confirmation attached|Read the buyer's e-mail)", re.I
)
GREETING = re.compile(r"^(?:hallo|hello|hi|dear\b.*|guten tag|good (?:morning|afternoon)|sehr geehrte.*)[ ,!]*$", re.I)
SIGN_OFF = re.compile(
    r"^(?:kind regards|best regards|regards|gruß|grüße|viele grüße|beste grüße|freundliche grüße"
    r"|mit freundlichen grüßen|cheers|thanks and regards|sincerely)\b",
    re.I,
)
# The supplier's templated answer to each claim we cited; the effect is kept on our claim.
CLAIM_CHECKS = (
    (
        re.compile(r"^we checked the ([a-z ]+?) data you cited; it holds and we took it into account\.?$", re.I),
        "counted",
    ),
    (
        re.compile(
            r"^we checked the ([a-z ]+?) data you cited; it holds, but it does not change our calculation\.?$", re.I
        ),
        "no effect",
    ),
    (re.compile(r"^we have already taken that ([a-z ]+?) data into account\.?$", re.I), "already counted"),
    (re.compile(r"^as to the ([a-z ]+?(?: and [a-z ]+?)*) data you cited, (.+)$", re.I), None),  # effect: the rest
)
# Sentences of a supplier e-mail the structured fields already hold (its terms, the template opening).
DROP_SENTENCE = re.compile(
    r"a price of €|^we have reviewed your offer and can adjust|^thank you for your enquiry|^please find our angebot",
    re.I,
)
WHY_COST = re.compile(r"C ([\d,]+) below the limit ([\d,.]+|inf)")
SECRETS = re.compile(r"https?://\S+|\bsk-[\w-]{8,}|\b(?:ak|key)_[\w-]{12,}", re.I)


# ---------------------------------------------------------------------------------------------
# Corpus
# ---------------------------------------------------------------------------------------------


def practice_corpus(runs_dir=RUNS, cases=None, package=None, agents=AGENTS):
    """One compact record per run file of `agents`, oldest first. `cases`: case files by case_id
    (default: knowledge/practice_cases.json). `package`: a DataPackage or its folder; with it each
    supplier thread gets persona features from the dossier."""
    runs_dir = Path(runs_dir)
    cases = load_cases(cases)
    package = open_package(package)
    cache, out = {}, []
    for path in sorted(runs_dir.glob("*/*.json")):
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            log.warning("playbook: skip %s (%s)", path.name, e)
            continue
        if not isinstance(raw, dict) or raw.get("agent") not in agents:
            continue
        case = cases.get(raw.get("case_id")) or {}
        try:
            rec = record(raw, case, package, cache)
        except Exception as e:  # one malformed run file must not stop the corpus
            log.warning("playbook: skip %s (%r)", path.name, e)
            continue
        rec["file"] = f"{path.parent.name}/{path.name}"
        out.append(rec)
    out.sort(key=lambda r: (r.get("when") or "", r["file"]))
    return out


def load_cases(cases=None):
    """Case files by case_id, from a dict, a list of case files or a JSON file (default CASES)."""
    if isinstance(cases, dict):
        return cases
    if isinstance(cases, list):
        return {c["case_id"]: c for c in cases if isinstance(c, dict) and c.get("case_id")}
    path = Path(cases) if cases else CASES
    if not path.is_file():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else load_cases(data)


def open_package(package):
    if package is None or hasattr(package, "query"):
        return package
    from ....data import DataPackage

    return DataPackage(package)


def record(raw, case=None, package=None, cache=None):
    """The compact record of one run file (layout in the module docstring); `cache` holds the personas."""
    case = case or {}
    cache = {} if cache is None else cache
    session = raw.get("session") or {}
    result = raw.get("result") or session.get("result") or {}
    trace = (session.get("result") or {}).get("trace") or result.get("trace") or []
    buyer = case.get("buyer") or {}
    openings = _openings(session, trace)
    seen = [*(case.get("suppliers") or []), *openings, *(t["actor"] for t in trace if _is_supplier(t.get("actor")))]
    order = list(dict.fromkeys(seen))
    states = session.get("threads") or {}

    threads, offers = {}, defaultdict(dict)
    for sid in order:
        op = openings.get(sid) or {}
        price = (op.get("terms") or {}).get("unit_price")
        threads[sid] = {
            "supplier_id": sid,
            "name": "",
            "role": "",
            "opening_price": price,
            "opening_terms": _others(op.get("terms")),
            "missing_fields": list(op.get("missing_fields") or []),
            "opening_delay_days": (op.get("signals") or {}).get("reply_delay_days"),
            "opening_validity_days": (op.get("signals") or {}).get("validity_days"),
            "opening_excerpt": excerpt(op.get("text"), EXCERPT),
            "status": (states.get(sid) or {}).get("status"),
            "offers": (states.get(sid) or {}).get("offers"),
            "ours": [],
            "theirs": [],
            "backoffice": [],
        }
        _remember(offers[sid], op)

    close, pending = None, {}
    for n, step in enumerate(trace):
        actor, move, rnd = step.get("actor"), step.get("move") or {}, step.get("round")
        if actor == "buyer":
            sid = move.get("supplier_id") or (order[0] if len(order) == 1 else None)
            kind = move.get("type") or "message"
            th = threads.get(sid)
            base = th["opening_price"] if th else None
            if kind == "message":
                ours = _our_message(move, rnd, base) | {"step": n}
                if th:
                    th["ours"].append(ours)
                    pending[sid] = ours
            elif kind in ("accept", "walk_away"):
                oid = (move.get("action") or {}).get("term_sheet_id") or move.get("offer_id")
                close = {"type": kind, "supplier_id": sid, "round": rnd, "step": n}
                if oid:
                    close |= {"offer_id": oid, "alternative": bool(re.search(r"-a\d*$", oid))}
                    close["price"] = _share(offers[sid].get(oid), base)
                if th:
                    th["ours"].append({k: v for k, v in close.items() if k != "supplier_id"})
            elif th:
                th["ours"].append({"round": rnd, "type": kind, "step": n})
            continue
        th = threads.get(actor)
        if th is None or rnd == 0:  # round 0 is the opening quote, kept above
            continue
        _remember(offers[actor], move)
        reply = _their_reply(step, th["opening_price"]) | {"step": n}
        th["theirs"].append(reply)
        ours = pending.pop(actor, None)
        if ours is not None:
            for res in move.get("claim_results") or []:
                i = res.get("index")
                if isinstance(i, int) and 0 <= i < len(ours["claims"]):
                    ours["claims"][i]["result"] = res.get("result")
            _claim_effects(ours["claims"], claim_checks(reply["reasons"]))

    _attach_decisions(threads, raw.get("decisions") or [])
    _attach_backoffice(threads, raw.get("backoffice"))
    if package is not None:
        for th in threads.values():
            persona = _persona(case, th, package, cache)
            if persona:
                th["persona"] = persona

    c_open, c_deal, c_best, c_alt = (result.get(k) for k in ("c_open", "c_deal", "c_best", "c_alt"))
    deal = bool(result.get("deal"))
    winner = result.get("supplier_id") if deal else None
    terms = result.get("terms") or {}
    base = (threads.get(winner) or {}).get("opening_price")
    first = next((d for d in raw.get("decisions") or [] if isinstance(d, dict) and "features_off" in d), {})
    return {
        "case_id": raw.get("case_id"),
        "title": case.get("title") or "",
        "type": case.get("type"),
        "category_goal": buyer.get("category_goal"),
        "n_suppliers": len(threads),
        "negotiable": list(case.get("negotiable") or []),
        "must_haves": [f"{m.get('field')} {m.get('op')} {m.get('value')}" for m in buyer.get("must_haves") or []],
        "alternative": (buyer.get("alternative") or {}).get("kind"),
        "round_limit": case.get("round_limit"),
        "agent": raw.get("agent"),
        "commit": raw.get("commit"),
        "note": raw.get("note") or "",
        "when": raw.get("when"),
        "session_id": raw.get("session_id") or session.get("session_id"),
        "features_off": list(first.get("features_off") or []),
        "score": result.get("score"),
        "deal": deal,
        "must_haves_ok": result.get("must_haves_ok"),
        "end_reason": session.get("end_reason"),
        "c_open": c_open,
        "c_deal": c_deal,
        "c_best": c_best,
        "c_alt": c_alt,
        "c_deal_share": _share(c_deal, c_open),
        "c_best_share": _share(c_best, c_open),
        "c_alt_share": _share(c_alt, c_open),
        "winner": winner,
        "deal_price": _share(terms.get("unit_price"), base) if deal else None,
        "deal_terms": _others(terms) if deal else {},
        "cost_breakdown": {k: v for k, v in (result.get("cost_breakdown") or {}).items() if v},
        "rounds": session.get("rounds"),
        "seconds": raw.get("seconds"),
        "close": close,
        "threads": list(threads.values()),
    }


def _is_supplier(actor):
    return isinstance(actor, str) and actor.startswith("sup:")


def _openings(session, trace):
    found = {sid: op for sid, op in (session.get("opening") or {}).items() if isinstance(op, dict)}
    for t in trace:
        if t.get("round") == 0 and _is_supplier(t.get("actor")) and t["actor"] not in found:
            found[t["actor"]] = t.get("move") or {}
    return found


def _remember(book, move):
    """Price of every offer id it sent (main sheet and alternatives), to price what we accepted."""
    if move.get("offer_id"):
        book[move["offer_id"]] = (move.get("terms") or {}).get("unit_price")
    for alt in move.get("alternatives") or []:
        if alt.get("offer_id"):
            book[alt["offer_id"]] = (alt.get("terms") or {}).get("unit_price")


def _share(value, base):
    try:
        return round(float(value) / float(base), 4) if value is not None and base else None
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def _others(terms):
    """Every term but the price."""
    return {k: v for k, v in (terms or {}).items() if k != "unit_price"}


def _our_message(move, rnd, base):
    sheets = [s.get("terms") or {} for s in move.get("term_sheets") or []]
    interpreted = move.get("interpreted") or {}
    return {
        "round": rnd,
        "type": "message",
        "price": _share(sheets[0].get("unit_price"), base) if sheets else None,
        "n_sheets": len(sheets),
        "sheets": [{"price": _share(s.get("unit_price"), base), "terms": _others(s)} for s in sheets],
        "claims": [{"kind": c.get("type"), "result": None} for c in interpreted.get("claims") or []],
        "refs": sorted({r.split(":", 1)[0] for r in move.get("refs") or [] if isinstance(r, str)}),
        "excerpt": excerpt(move.get("body"), OUR_EXCERPT),
    }


def _their_reply(step, base):
    move = step.get("move") or {}
    terms, signals = move.get("terms") or {}, move.get("signals") or {}
    reasons = [_trim(r, REASON) for r in (step.get("reasons") or [])[:REASONS] if isinstance(r, str)]
    return {
        "round": step.get("round"),
        "status": move.get("status"),
        "price": _share(terms.get("unit_price"), base),
        "terms": _others(terms),
        "alternatives": [
            {"price": _share((a.get("terms") or {}).get("unit_price"), base), "terms": _others(a.get("terms"))}
            for a in move.get("alternatives") or []
        ],
        "claims": [c.get("type") for c in move.get("claims") or [] if isinstance(c, dict)],
        "missing_fields": list(move.get("missing_fields") or []),
        "delay_days": signals.get("reply_delay_days"),
        "validity_days": signals.get("validity_days"),
        "excerpt": excerpt(move.get("text"), EXCERPT, step.get("reasons") or []),
        "reasons": reasons,
    }


def claim_checks(reasons):
    """[(claim kind, effect)] from the supplier's templated answers to our claims, in order:
    'We checked the rival quote data you cited; it holds, but it does not change our calculation.'
    -> ('rival_quote', 'no effect')."""
    out = []
    for text in reasons:
        for pattern, effect in CLAIM_CHECKS:
            m = pattern.match(str(text).strip())
            if m:
                kinds = [k.strip().replace(" ", "_") for k in m.group(1).split(" and ")]
                out += [(k, effect or _trim(m.group(2), 120)) for k in kinds]
                break
    return out


def _claim_effects(claims, checks):
    """Each answer goes to the next claim of its kind; one answer for several claims of a kind covers them all."""
    last = {}
    for kind, effect in checks:
        last[kind] = effect
        claim = next((c for c in claims if c["kind"] == kind and "effect" not in c), None)
        if claim is not None:
            claim["effect"] = effect
    for c in claims:
        if "effect" not in c and c["kind"] in last:
            c["effect"] = last[c["kind"]]


def is_claim_check(text):
    return any(p.match(str(text).strip()) for p, _ in CLAIM_CHECKS)


def _attach_decisions(threads, decisions):
    """Our engine's trace per move. The decision log is keyed by the supplier offer it answered, not by
    trace round (a late message is sent in the next round), so each message takes the next decision
    of that supplier whose sheet prices are the ones the message carried."""
    by_sid = defaultdict(list)
    for d in decisions:
        if isinstance(d, dict) and d.get("supplier_id") in threads:
            by_sid[d["supplier_id"]].append(d)
    for sid, ds in by_sid.items():
        th, at = threads[sid], 0
        for ours in th["ours"]:
            kind = ours.get("type")
            if kind == "timeout":
                continue
            want = [s.get("price") for s in ours.get("sheets") or []]
            for i in range(at, len(ds)):
                d = ds[i]
                if kind == "message":
                    got = [_share(s.get("unit_price"), th["opening_price"]) for s in d.get("our_sheets") or []]
                    hit = d.get("action") == "send" and got == want
                else:
                    hit = d.get("action") == kind
                if hit:
                    ours["engine"] = _engine(d, th["opening_price"])
                    at = i + 1
                    break


def _engine(d, base):
    out = {"action": d.get("action"), "source": d.get("source")}
    for k in ("anchor", "ceiling", "their_price_on_our_terms"):
        if d.get(k) is not None:
            out[k] = _share(d[k], base)
    for k in ("claims", "asks", "traits"):
        if d.get(k):
            out[k] = list(d[k])
    for k in ("trade", "last_call", "final_push", "hold", "keepalive", "leader", "error"):
        if d.get(k):
            out[k] = d[k] if isinstance(d[k], bool) else _trim(str(d[k]), BACKOFFICE)
    if d.get("why"):
        out["why"] = why_shares(d["why"])
    return out


def why_shares(text):
    """'C 251,462 below the limit 305,545' -> 'C at 0.823 of the limit': no absolute figures."""

    def repl(m):
        c, limit = float(m.group(1).replace(",", "")), m.group(2)
        if limit == "inf":
            return "C below the limit (no limit)"
        share = _share(c, float(limit.replace(",", "")))
        return f"C at {share:.3f} of the limit" if share is not None else m.group(0)

    return WHY_COST.sub(repl, str(text))


def _attach_backoffice(threads, backoffice):
    if not isinstance(backoffice, list):
        return
    roles = defaultdict(Counter)
    for b in backoffice:
        if not isinstance(b, dict) or b.get("supplier_id") not in threads:
            continue
        th = threads[b["supplier_id"]]
        th["name"] = th["name"] or b.get("supplier") or ""
        if b.get("to") == "team" and b.get("from") not in (None, "team"):
            roles[b["supplier_id"]][b["from"]] += 1
        line = {
            "round": b.get("round"),
            "from": b.get("from"),
            "to": b.get("to"),
            "text": _trim(b.get("text"), BACKOFFICE),
        }
        if line not in th["backoffice"]:
            th["backoffice"].append(line)
    for sid, count in roles.items():
        threads[sid]["role"] = count.most_common(1)[0][0]


def _persona(case, th, package, cache):
    """Owner type and the dossier signals of this supplier (dossier.build), cached per case and supplier."""
    sid, price = th["supplier_id"], th["opening_price"]
    key = (case.get("case_id"), sid, price)
    if key not in cache:
        from ..dossier import build

        try:
            d = build(case, sid, package, quote_price=price)
        except Exception as e:  # a supplier the package does not know must not stop the corpus
            log.warning("playbook: no dossier for %s (%r)", sid, e)
            cache[key] = None
        else:
            th["name"] = th["name"] or d.name
            cache[key] = {
                "owner_type": d.owner_type,
                "country": d.country,
                "cash_need": d.cash_need,
                "wants_work": d.wants_work,
                "capacity_full": d.capacity_full,
                "hedged": d.hedged,
                "full_cost": _share(d.full_cost, price),
                "full_cost_source": d.full_cost_source,
                "notes": list(d.notes),
            }
    return cache[key]


def excerpt(text, limit=EXCERPT, reasons=()):
    """The e-mail on one line, at most `limit` characters, without greeting and signature, without
    the sentences that state its terms and without the sentences already in `reasons`."""
    if not text or limit <= 0:
        return ""
    lines = [ln.strip() for ln in str(text).splitlines() if ln.strip()]
    if lines and GREETING.match(lines[0]):
        lines = lines[1:]
    for i, ln in enumerate(lines):
        if SIGN_OFF.match(ln):
            lines = lines[:i]
            break
    known = [k for k in (_letters(r) for r in reasons) if len(k) >= 12]
    keep = []
    for sentence in re.split(r"(?<=[.!?])\s+", " ".join(lines)):
        key = _letters(sentence)
        if not key or DROP_SENTENCE.search(sentence):
            continue
        if len(key) >= 12 and any(key in k or k in key for k in known):
            continue
        keep.append(sentence)
    return _trim(" ".join(keep), limit)


def _letters(text):
    """Letters only: a reason ('… days payment') matches the e-mail sentence it came from ('14 days payment')."""
    return re.sub(r"[^a-zäöüß]+", "", str(text).lower())


def _trim(text, limit):
    text = re.sub(r"\s+", " ", str(text or "")).strip()
    if len(text) <= limit:
        return text
    cut = text[: max(limit - 1, 0)]
    if " " in cut[limit // 2 :]:
        cut = cut[: cut.rindex(" ")]
    return cut.rstrip(" ,;:") + "…"


# ---------------------------------------------------------------------------------------------
# Dedupe, select, render, stats
# ---------------------------------------------------------------------------------------------


def path_key(rec):
    """Case, our path (move type, sheets with their terms, claim kinds) and its path (status, price,
    terms) per thread: equal keys are the same negotiation."""

    def ours(m):
        sheets = [(s.get("price"), _canon(s.get("terms"))) for s in m.get("sheets") or []]
        return m.get("type"), m.get("price"), tuple(sheets), tuple(c.get("kind") for c in m.get("claims") or [])

    return (
        rec.get("case_id"),
        tuple(
            (
                t["supplier_id"],
                tuple(ours(m) for m in t["ours"]),
                tuple((r.get("status"), r.get("price"), _canon(r.get("terms"))) for r in t["theirs"]),
            )
            for t in rec.get("threads") or []
        ),
    )


def _canon(terms):
    return json.dumps(terms or {}, sort_keys=True, default=str)


def dedupe(corpus):
    """Drop exact repeats (same case, same our-path and their-path); the first one stays."""
    seen, out = set(), []
    for rec in corpus:
        key = path_key(rec)
        if key not in seen:
            seen.add(key)
            out.append(rec)
    return out


def select(corpus, per_case=4):
    """Per case: the best, the worst and the most recent run, then more recent ones, procudeal first.
    Returns copies with `selected` (why each was picked), per case in time order."""

    def score(r):
        return r["score"] if isinstance(r.get("score"), int | float) else -1.0

    def when(r):
        return r.get("when") or ""

    by_case = defaultdict(list)
    for rec in corpus:
        by_case[rec.get("case_id")].append(rec)
    out = []
    for case_id in sorted(by_case, key=str):
        runs = by_case[case_id]
        ours = [r for r in runs if r.get("agent") == "procudeal"]
        rest = sorted(
            (r for r in runs if r.get("agent") != "procudeal"), key=lambda r: (score(r), when(r)), reverse=True
        )
        pool = ours or rest
        low = min(score(r) for r in pool)
        picks = [
            ("best", max(pool, key=lambda r: (score(r), when(r)))),
            ("worst", max((r for r in pool if score(r) == low), key=when)),
            ("latest", max(pool, key=when)),
        ]
        picks += [("recent", r) for r in sorted(pool, key=when, reverse=True)]
        picks += [("baseline", r) for r in rest if pool is ours]
        chosen = {}
        for tag, r in picks:
            if id(r) in chosen:
                if tag in ("best", "worst", "latest"):
                    chosen[id(r)][1].append(tag)
            elif len(chosen) < per_case:
                chosen[id(r)] = (r, [tag])
        out += [dict(r, selected=tags) for r, tags in sorted(chosen.values(), key=lambda x: when(x[0]))]
    return out


def render(rec, max_chars=RENDER_CHARS):
    """A compact text block of one run for an LLM prompt: shares, not absolute prices; no URLs or keys.
    Uses the most detailed level that fits `max_chars`."""
    text = ""
    for level in LEVELS:
        text = _render(rec, level)
        if len(text) <= max_chars:
            return text
    return text[: max_chars - 14].rstrip() + "\n… (truncated)"


def _render(rec, lv):
    f3 = _f3
    goal = f"goal {rec.get('category_goal')}" if rec.get("category_goal") else ""
    head = ", ".join(x for x in (rec.get("type") or "", goal, f"{rec.get('n_suppliers')} supplier(s)") if x)
    lines = [f"RUN {rec.get('case_id')} ({head}) agent {rec.get('agent')}, {str(rec.get('when') or '')[:16]}"]
    if rec.get("note"):
        lines[0] += f', note "{_trim(rec["note"], 80)}"'
    if rec.get("title"):
        lines.append(f"CASE {_trim(rec['title'], 120)}")
    case_bits = []
    if rec.get("negotiable"):
        case_bits.append("negotiable " + ", ".join(rec["negotiable"]))
    case_bits.append("must-haves " + ("; ".join(rec["must_haves"]) if rec.get("must_haves") else "none"))
    if rec.get("alternative"):
        case_bits.append(f"alternative {rec['alternative']}")
    if rec.get("features_off"):
        case_bits.append("features off " + ", ".join(rec["features_off"]))
    lines.append("SETUP " + "; ".join(case_bits))

    res = [f"score {f3(rec.get('score'))}"]
    if rec.get("deal"):
        deal = f"deal with {rec.get('winner')} at {f3(rec.get('deal_price'))} of its opening"
        if rec.get("deal_terms"):
            shown = {k: v for k, v in rec["deal_terms"].items() if k in (rec.get("negotiable") or rec["deal_terms"])}
            deal += f" [{terms_text(shown)}]"
        res.append(deal.replace(" []", ""))
    else:
        res.append("no deal" + (f", C_alt {f3(rec.get('c_alt_share'))} x C_open" if rec.get("c_alt_share") else ""))
    if rec.get("must_haves_ok") is False:
        res.append("MUST-HAVE BROKEN")
    if rec.get("c_deal_share") is not None:
        res.append(f"C_deal {f3(rec['c_deal_share'])} x C_open")
    res.append(f"C_best {f3(rec.get('c_best_share'))} x C_open")
    res.append(f"{rec.get('rounds')} rounds, {_num(rec.get('seconds'))} s, end {rec.get('end_reason')}")
    lines.append("RESULT " + "; ".join(res))
    close = rec.get("close")
    if close and close.get("type") == "walk_away" and not close.get("supplier_id"):
        lines.append(f"CLOSE r{close.get('round')} we walked away from the case")

    for th in rec.get("threads") or []:
        lines.append("")
        lines.append(_thread_head(th))
        op = [f"r0 them open 1.000 [{terms_text(th.get('opening_terms')) or '-'}]"]
        if th.get("missing_fields"):
            op.append("missing " + ", ".join(th["missing_fields"]))
        if th.get("opening_validity_days"):
            op.append(f"valid {th['opening_validity_days']} d")
        line = " ".join(op)
        if lv["excerpt"] and th.get("opening_excerpt"):
            line += f': "{_trim(th["opening_excerpt"], lv["excerpt"])}"'
        lines.append(" " + line)
        lines += _bo_lines(th, 0, lv)
        theirs = th.get("theirs") or []
        key = {id(r) for i, r in enumerate(theirs) if _is_key(theirs, i)}
        steps = sorted(
            [(m.get("step", 0), 0, m) for m in th.get("ours") or []] + [(r.get("step", 0), 1, r) for r in theirs],
            key=lambda x: (x[0], x[1]),
        )
        engine = None
        for _, side, item in steps:
            if side == 0:
                got = _our_lines(item, lv)
                if len(got) > 1 and got[1].startswith("    engine:"):
                    if got[1] == engine:  # the same engine state as the move before: said once
                        got.pop(1)
                    else:
                        engine = got[1]
                if rec.get("agent") == "procudeal":  # its text is a template around the claims above
                    got = [g for g in got if not g.startswith("    text:")]
                lines += got
                continue
            lines += _their_lines(item, lv, show_excerpt=not lv["key"] or id(item) in key)
            lines += _bo_lines(th, item.get("round"), lv)
    return SECRETS.sub("[removed]", "\n".join(lines))


def _is_key(theirs, i):
    """The first and the last reply, and every reply whose status differs from the one before."""
    return i in (0, len(theirs) - 1) or theirs[i].get("status") != theirs[i - 1].get("status")


def _thread_head(th):
    who = " ".join(x for x in (th.get("supplier_id"), th.get("name")) if x)
    bits = [who + (f", writer {th['role']}" if th.get("role") else "")]
    p = th.get("persona")
    if p:
        about = [x for x in (f"owner {p['owner_type']}" if p.get("owner_type") else "", p.get("country") or "") if x]
        signals = [k for k in ("cash_need", "wants_work", "capacity_full", "hedged") if p.get(k)]
        about.append("signals " + (", ".join(signals) if signals else "none"))
        if p.get("full_cost") is not None:
            about.append(f"full cost {_f3(p['full_cost'])} of opening ({_trim(p.get('full_cost_source'), 80)})")
        bits.append("; ".join(about))
    end = f"ended {th.get('status')}" if th.get("status") else ""
    if th.get("offers") is not None:
        end += f", {th['offers']} offers"
    if end:
        bits.append(end.strip(", "))
    return "SUPPLIER " + " | ".join(bits)


def _our_lines(m, lv):
    kind, rnd = m.get("type"), m.get("round")
    if kind == "timeout":
        return [f" r{rnd} us TIMEOUT (no message in time)"]
    if kind in ("accept", "walk_away"):
        what = "ACCEPT" if kind == "accept" else "WALK AWAY"
        if m.get("price") is not None:
            what += f" at {_f3(m['price'])}" + (" (its alternative sheet)" if m.get("alternative") else "")
        line = f" r{rnd} us {what}"
        if lv["engine"] and (m.get("engine") or {}).get("why"):
            line += f" - {m['engine']['why']}"
        return [line]
    sheets = m.get("sheets") or []
    if sheets:
        offer = " / ".join(f"{_f3(s.get('price'))} [{terms_text(s.get('terms')) or '-'}]" for s in sheets)
    else:
        offer = "no term sheet"
    line = f" r{rnd} us {offer}"
    if m.get("claims"):
        line += "; claims " + ", ".join(_claim_text(c) for c in m["claims"])
    if m.get("refs"):
        line += "; refs " + ",".join(m["refs"])
    out = [line]
    eng = m.get("engine") or {}
    if lv["engine"] and eng:
        bits = [f"{k} {_f3(eng[k])}" for k in ("anchor", "ceiling") if eng.get(k) is not None]
        bits += [f"{k} {','.join(eng[k])}" for k in ("asks", "traits") if eng.get(k)]
        bits += [k.replace("_", " ") for k in ("last_call", "final_push") if eng.get(k)]
        bits += [f"{k} {eng[k]}" for k in ("hold", "keepalive", "trade", "error") if eng.get(k)]
        if eng.get("source") and eng["source"] != "engine":
            bits.append(f"by {eng['source']}")
        if bits:
            out.append("    engine: " + "; ".join(bits))
    if lv["ours"] and m.get("excerpt"):
        out.append(f'    text: "{_trim(m["excerpt"], lv["ours"])}"')
    return out


def _claim_text(c):
    out = f"{c.get('kind')}={c.get('result') or '?'}"
    return out + f" ({c['effect']})" if c.get("effect") else out


def _their_lines(r, lv, show_excerpt=True):
    line = f" r{r.get('round')} them {r.get('status')}"
    if r.get("price") is not None:
        line += f" {_f3(r['price'])}"
    if r.get("terms"):
        line += f" [{terms_text(r['terms'])}]"
    if r.get("alternatives"):
        alts = " / ".join(f"{_f3(a.get('price'))} [{terms_text(a.get('terms')) or '-'}]" for a in r["alternatives"])
        line += f" alt {alts}"
    if r.get("claims"):
        line += "; its claims " + ", ".join(str(c) for c in r["claims"])
    if lv["excerpt"] and show_excerpt and r.get("excerpt"):
        line += f': "{_trim(r["excerpt"], lv["excerpt"])}"'
    out = [line]
    reasons = [x for x in r.get("reasons") or [] if x and not is_claim_check(x)][: lv["reasons"]]
    if reasons:
        out.append("    reasons: " + " | ".join(reasons))
    return out


def _bo_lines(th, rnd, lv):
    if not lv["backoffice"]:
        return []
    items = []
    for b in th.get("backoffice") or []:
        if b.get("round") != rnd or BO_NOISE.match(b.get("text") or ""):
            continue
        text = b.get("text") or ""
        if text.startswith("My call: "):
            items.append("call " + text[9:].rstrip("."))
        else:
            items.append(f"{b.get('from')}>{b.get('to')}: {text}")
    return ["    back office: " + " | ".join(items)] if items else []


def terms_text(terms):
    """Non-price terms in short form: 'pay14 lead35 clause AS-14404/0.45/db5'."""
    out = []
    for k, v in (terms or {}).items():
        name = SHORT.get(k, k)
        if k == "index_clause":
            if isinstance(v, dict):
                v = f"{v.get('series')}/{v.get('material_share')}/db{_num(v.get('deadband_pct'))}"
                out.append(f"clause {v}")
            else:
                out.append("no clause")
        elif isinstance(v, str) and not v[:1].isdigit():
            out.append(f"{name} {v}")
        else:
            out.append(f"{name}{_num(v)}")
    return " ".join(out)


def _num(v):
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return "?" if v is None else str(v)


def _f3(v):
    return f"{v:.3f}" if isinstance(v, int | float) else "?"


def stats(corpus, selected=None):
    """Runs per case and agent, mean score per case, and the rendered size."""
    by_case = defaultdict(list)
    for rec in corpus:
        by_case[rec.get("case_id")].append(rec)
    sizes = [len(render(r)) for r in corpus]
    out = {
        "runs": len(corpus),
        "unique": len(dedupe(corpus)),
        "agents": dict(Counter(r.get("agent") for r in corpus)),
        "rendered_chars": sum(sizes),
        "rendered_max": max(sizes, default=0),
        "cases": {},
    }
    for case_id in sorted(by_case, key=str):
        runs = by_case[case_id]
        scores = [r["score"] for r in runs if isinstance(r.get("score"), int | float)]
        ours = [r["score"] for r in runs if r.get("agent") == "procudeal" and isinstance(r.get("score"), int | float)]
        out["cases"][case_id] = {
            "runs": len(runs),
            "agents": dict(Counter(r.get("agent") for r in runs)),
            "deals": sum(1 for r in runs if r.get("deal")),
            "mean_score": round(sum(scores) / len(scores), 3) if scores else None,
            "procudeal_mean": round(sum(ours) / len(ours), 3) if ours else None,
            "best": round(max(scores), 3) if scores else None,
        }
    if selected is not None:
        out["selected"] = len(selected)
        out["selected_chars"] = sum(len(render(r)) for r in selected)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description="Corpus stats of our practice runs (no arena, no LLM).")
    ap.add_argument("--runs", default=str(RUNS), help="runs folder (default: the repo's runs/)")
    ap.add_argument("--data", default=None, help="data package folder (default: ARENA_DATA or data/package)")
    ap.add_argument("--no-package", action="store_true", help="skip the persona features")
    ap.add_argument("--per-case", type=int, default=4)
    ap.add_argument("--show", nargs="*", default=None, help="print the selected records of these cases (P05 ...)")
    ap.add_argument("--json", action="store_true", help="print the stats as JSON")
    args = ap.parse_args(argv)
    package = None
    if not args.no_package:
        folder = Path(args.data or os.environ.get("ARENA_DATA") or PACKAGE)
        package = folder if folder.is_dir() else None
    corpus = practice_corpus(args.runs, package=package)
    chosen = select(dedupe(corpus), args.per_case)
    st = stats(corpus, chosen)
    if args.json:
        print(json.dumps(st, indent=1))
    else:
        print(
            f"{st['runs']} runs ({st['unique']} unique), agents {st['agents']}, rendered {st['rendered_chars']:,} "
            f"chars (max {st['rendered_max']:,} per run); selected {st['selected']} runs, "
            f"{st['selected_chars']:,} chars"
        )
        print(f"{'case':<10} {'runs':>4} {'deals':>5} {'mean':>6} {'ours':>6} {'best':>6}  agents")
        for case_id, c in st["cases"].items():
            print(
                f"{case_id:<10} {c['runs']:>4} {c['deals']:>5} {_f3(c['mean_score']):>6} "
                f"{_f3(c['procudeal_mean']):>6} {_f3(c['best']):>6}  {c['agents']}"
            )
    for want in args.show or []:
        for rec in chosen:
            if rec.get("case_id", "").split(":")[-1] == want.split(":")[-1]:
                print(f"\n=== {rec['file']} ({', '.join(rec['selected'])}) ===\n{render(rec)}")


# ---------------------------------------------------------------------------------------------
# LLM synthesis (to be added): build_playbook(corpus, ...) -> knowledge/playbook.json
#
# Takes select(dedupe(practice_corpus(...))) and render()ed records, asks the research LLM
# (research/llm.py `ask`) for arena-wide behaviour lessons by persona and category goal, validates
# the answer and writes knowledge/playbook.json. Not implemented here.
# ---------------------------------------------------------------------------------------------


if __name__ == "__main__":
    main()
