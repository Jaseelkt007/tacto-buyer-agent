"""The arena playbook: what our practice negotiations teach about how these suppliers behave.

Two stages (Opus 5.5): one analyst per practice case compares every run of that case (what separated
the high scores from the low ones, how the supplier reacted to each kind of move), then a synthesizer
turns the case reports into general lessons keyed by goal, case type and supplier traits - never by
a supplier or case name, because the final has new suppliers. A lesson seen in one case only is
marked low confidence. Input: `playbook.practice_corpus` records.
"""

import json
import logging
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor

from . import agents as ag
from . import llm
from . import playbook as pb

log = logging.getLogger("research")
LEVEL = ag.LEVEL

CASE_SYSTEM = (
    ag.WORLD
    + """

YOUR ROLE
You are the debrief analyst. Below are several runs of the SAME practice negotiation, played by our
buyer agents with different versions of their rules, with the supplier's replies, its reasons in
its own words, its back office (its internal roles talking) and the score of each run (1.0 = the best
deal that was possible, 0 = no better than its opening offer). Prices are shares of the supplier's
opening price.

Compare the runs: what did the high-scoring runs do that the low ones did not? How did the supplier
react to each kind of move (opening level, step sizes, arguments, extra term sheets, clauses,
payment or volume trades, holding firm)? When did it stop conceding, make a final offer, agree or
walk? What did its back office reveal about its real limits? Be concrete; quote its words where
they explain a reaction."""
)

CASE_SCHEMA = ag._obj(
    {
        "what_worked": ag._arr(ag._obj({"text": ag.STR, "runs": ag._arr(ag.STR)})),
        "what_failed": ag._arr(ag._obj({"text": ag.STR, "runs": ag._arr(ag.STR)})),
        "supplier_behaviour": ag._arr(ag.STR),
        "real_limits": ag.STR,
        "turning_points": ag._arr(ag.STR),
    }
)

SYNTH_SYSTEM = (
    ag.WORLD
    + """

YOUR ROLE
You are the head of the negotiation team. Debrief reports of every practice case follow. The final
negotiations will be with NEW suppliers and situations, so turn the reports into GENERAL lessons
about how these suppliers behave and what works with them, keyed by category goal, case type and
supplier traits - never by a supplier, part or case name. For each lesson say what to do, what not to
do, when it applies, and how strong the evidence is (in how many cases it held; one case = low
confidence). Also list typical supplier reply patterns (what they write) with what each means and the
best response, and the open questions the evidence cannot answer yet."""
)

SYNTH_SCHEMA = ag._obj(
    {
        "lessons": ag._arr(
            ag._obj(
                {
                    "rule": ag.STR,
                    "do": ag.STR,
                    "dont": ag.STR,
                    "goals": ag._arr(
                        ag._enum(["stabilise", "secure_supply", "leverage", "routine", "quality_first", "any"])
                    ),
                    "case_types": ag._arr(
                        ag._enum(
                            [
                                "price_increase",
                                "renewal",
                                "rfq",
                                "bundling",
                                "raw_material",
                                "capacity",
                                "quality",
                                "any",
                            ]
                        )
                    ),
                    "traits": ag._arr(ag.STR),
                    "cases_seen": {"type": "integer"},
                    "confidence": ag._enum(LEVEL),
                }
            )
        ),
        "reply_patterns": ag._arr(ag._obj({"pattern": ag.STR, "meaning": ag.STR, "best_response": ag.STR})),
        "concession_dynamics": ag.STR,
        "open_questions": ag._arr(ag.STR),
    }
)


def case_reports(corpus, per_case=6, effort=None):
    """{case_id: debrief} - one analyst per case, in parallel."""
    by_case = defaultdict(list)
    for record in pb.select(pb.dedupe(corpus), per_case=per_case):
        by_case[record["case_id"]].append(record)
    out = {}
    with ThreadPoolExecutor(max_workers=6) as pool:
        jobs = {}
        for case_id, records in by_case.items():
            text = "\n\n".join(f"=== RUN {i} ===\n{pb.render(r)}" for i, r in enumerate(records, 1))
            jobs[case_id] = pool.submit(
                llm.ask, CASE_SYSTEM, text, CASE_SCHEMA, tag=f"debrief:{case_id}", effort=effort
            )
        for case_id, job in jobs.items():
            try:
                out[case_id] = job.result()
            except Exception:  # one case must not stop the playbook
                log.exception("debrief of %s failed", case_id)
    return out


def build_playbook(corpus, effort=None):
    """The playbook dict: case debriefs and the general lessons drawn from them."""
    reports = case_reports(corpus, effort=effort)
    meta = {}
    for r in corpus:
        m = meta.setdefault(r["case_id"], {"type": r.get("type"), "goal": r.get("category_goal"), "runs": 0})
        m["runs"] += 1
    text = "\n\n".join(
        f"=== CASE ({meta.get(cid, {}).get('type')}, goal {meta.get(cid, {}).get('goal')}, "
        f"{meta.get(cid, {}).get('runs')} runs) ===\n{json.dumps(rep, ensure_ascii=False)}"
        for cid, rep in reports.items()
    )
    general = llm.ask(SYNTH_SYSTEM, text, SYNTH_SCHEMA, tag="playbook", effort=effort)
    return {"general": general, "cases": reports, "meta": {"model": llm.MODEL, "cases": meta}}
