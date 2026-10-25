"""Benchmark runner: play cases with an agent, save every session in full, log a row per run.

    uv run python scripts/bench.py --agent procudeal case:D01 case:D02
    uv run python scripts/bench.py --agent llm --set practice          # every hosted practice case
    uv run python scripts/bench.py --agent naive case:P01 --note "baseline"

Per run it writes runs/<case>/<UTC time>_<agent>_<session>.json (result, trace, back office, our
decision trace) and appends a row to notes/runs.md. Hosted practice cases use the team's quota;
the sandbox (case:D01, case:D02) does not.
"""

import argparse
import hashlib
import json
import logging
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from pathlib import Path

from negotiation_timing import TimedBuyer

from arena_kit.cli import AGENTS, agent_factory, load_env
from arena_kit.client import ArenaClient, ArenaError
from arena_kit.play import RemoteTable, hosted, play

REPO = Path(__file__).resolve().parents[2]
RUNS, LOG = REPO / "runs", REPO / "notes" / "runs.md"
HEADER = (
    "| when (UTC) | case | agent | commit | deal | score | c_open | c_deal | c_best | rounds | secs | replay | note |\n"
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|\n"
)


def commit():
    """Short hash of HEAD, with -dirty when tracked files have uncommitted changes."""
    sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, cwd=REPO)
    dirty = subprocess.run(["git", "diff", "--quiet", "HEAD"], cwd=REPO).returncode != 0
    return sha.stdout.strip() + ("-dirty" if dirty else "")


def run_case(client, factory, agent_name, case_id, note, rev, case=None, experiment=None):
    table, agent, t0 = RemoteTable(client), TimedBuyer(factory()), time.monotonic()
    if case is not None and hasattr(agent, "prepare"):  # zone 1: plan before the session opens
        agent.prepare(case)
    try:
        result = play(table, case_id, agent)
    except ArenaError as e:
        return {"case_id": case_id, "error": f"{e.status} {e.detail}"}
    secs = round(time.monotonic() - t0, 1)
    sid = table.session_id
    state = client.session(sid)
    try:
        backoffice = client.backoffice(sid)
    except ArenaError as e:
        backoffice = {"error": f"{e.status} {e.detail}"}
    when = datetime.now(UTC)
    record = {
        "case_id": case_id,
        "agent": agent_name,
        "commit": rev,
        "note": note,
        "experiment": experiment,
        "when": when.isoformat(timespec="seconds"),
        "seconds": secs,
        "session_id": sid,
        "result": result,
        "session": state,
        "backoffice": backoffice,
        "decisions": getattr(agent, "trace", None),
        "plan": getattr(agent, "plan", None),
        "prepare_seconds": getattr(agent, "prepare_seconds", None),
        "observation_packets": getattr(agent, "observation_packets", []),
        "observation_errors": getattr(agent, "observation_errors", []),
        "reply_interpretations": getattr(getattr(agent, "reply_interpreter", None), "records", []),
        "decision_reviews": getattr(getattr(agent, "decision_reviewer", None), "records", []),
        "decision_timings": agent.decision_timings,
    }
    out = RUNS / case_id.split(":")[-1] / f"{when:%Y%m%dT%H%M%S}_{agent_name}_{sid}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(record, indent=1, ensure_ascii=False, default=str))
    replay = state.get("replay_url") or ""
    if replay.startswith("/"):
        replay = os.environ["ARENA_URL"].rstrip("/") + replay
    return {
        "case_id": case_id,
        "when": f"{when:%m-%d %H:%M}",
        "deal": result.get("deal"),
        "score": result.get("score"),
        "c_open": result.get("c_open"),
        "c_deal": result.get("c_deal"),
        "c_best": result.get("c_best"),
        "rounds": state.get("rounds"),
        "secs": secs,
        "replay": replay,
        "file": str(out.relative_to(REPO)),
    }


def fmt(v):
    if isinstance(v, float):
        return f"{v:.3f}" if abs(v) < 10 else f"{v:,.0f}"
    return "" if v is None else str(v)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cases", nargs="*", help="case ids, e.g. case:D01 case:P01")
    ap.add_argument("--set", help="play every hosted case of this set instead (practice or sandbox)")
    ap.add_argument("--agent", default="procudeal", choices=AGENTS)
    ap.add_argument("--data", default=None, help="data package folder (default: ARENA_DATA)")
    ap.add_argument("--parallel", type=int, default=4)
    ap.add_argument("--note", default="")
    ap.add_argument("--on", default="", help="additional procudeal feature flags, comma-separated")
    ap.add_argument("--no-model-cache", action="store_true", help="fresh tactician calls for repeatability tests")
    ap.add_argument("--observe", action="store_true", help="capture decision contexts for an offline reviewer")
    ap.add_argument("--reconsider", choices=["off", "deterministic", "decision"], default="off")
    ap.add_argument("--interpret-replies", action=argparse.BooleanOptionalAction, default=None,
                    help="override default advisory interpretation; adds latency, has no semantic control")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()
    if (args.observe or args.reconsider != "off" or args.interpret_replies is not None) and args.agent != "procudeal":
        ap.error("--observe, --reconsider and --interpret-replies require --agent procudeal")
    load_env()
    if args.on:
        from arena_kit.agents.procudeal import policy

        policy.FLAGS = policy.parse_off(os.environ.get("PROCUDEAL_OFF", ""), args.on)
    if args.no_model_cache:
        from functools import partial

        from arena_kit.agents.procudeal import tactician

        tactician.ask = partial(tactician.ask, cache=False)
    files_to_hash = sorted((REPO / "starter-kit/arena_kit/agents/procudeal").rglob("*.py"))
    code_hash = hashlib.sha256(b"".join(str(p.relative_to(REPO)).encode() + p.read_bytes()
                                     for p in files_to_hash)).hexdigest()
    experiment = {"code_hash": code_hash, "extra_flags": args.on, "model_cache": not args.no_model_cache}
    experiment["observation_capture"] = args.observe
    experiment["reconsideration"] = args.reconsider
    from arena_kit.agents.procudeal.reply_interpretation import enabled_by_default

    experiment["reply_interpretation"] = (
        (enabled_by_default() if args.interpret_replies is None else args.interpret_replies)
        if args.agent == "procudeal" else False
    )
    from arena_kit.agents.procudeal.observation import live_review_enabled

    experiment["decision_review"] = args.agent == "procudeal" and live_review_enabled()
    logging.basicConfig(level=logging.INFO if args.verbose else logging.WARNING, format="%(asctime)s %(message)s")
    client = ArenaClient()
    ids = args.cases
    if args.set and not ids:
        ids = [c["case_id"] for c in hosted(client.cases(args.set))]
    if not ids:
        sys.exit("give case ids or --set")
    factory = agent_factory(args.agent, args.data or os.environ.get("ARENA_DATA"))
    if args.reconsider != "off":
        from arena_kit.agents.procudeal.reconsideration import Reconsideration

        raw_factory = factory

        def factory():
            agent = raw_factory()
            agent.reconsideration = Reconsideration(args.reconsider)
            return agent

    if args.interpret_replies is not None:
        from arena_kit.agents.procudeal.reply_interpretation import ReplyInterpreter

        without_interpreter_factory = factory

        def factory():
            agent = without_interpreter_factory()
            agent.reply_interpreter = ReplyInterpreter() if args.interpret_replies else None
            return agent

    if args.observe:
        from arena_kit.agents.procudeal.observation import CaptureAgent

        base_factory = factory
        factory = lambda: CaptureAgent(base_factory())  # noqa: E731
    rev = commit()
    files = {}  # case files, so an agent can prepare before its session opens
    for kind in ("practice", "sandbox"):
        try:
            files |= {c["case_id"]: c for c in client.cases(kind)}
        except ArenaError:
            pass
    with ThreadPoolExecutor(max_workers=min(args.parallel, 10)) as pool:
        rows = list(pool.map(lambda c: run_case(client, factory, args.agent, c, args.note, rev,
                                             files.get(c), experiment), ids))
    LOG.parent.mkdir(parents=True, exist_ok=True)
    if not LOG.exists():
        LOG.write_text(
            "# Run log\n\nOne row per benchmark run (`scripts/bench.py`). Newest at the bottom.\n\n" + HEADER
        )
    with LOG.open("a") as f:
        for r in rows:
            if "error" in r:
                print(f"{r['case_id']}: {r['error']}")
                continue
            cells = [
                r["when"],
                r["case_id"],
                args.agent,
                rev,
                r["deal"],
                r["score"],
                r["c_open"],
                r["c_deal"],
                r["c_best"],
                r["rounds"],
                f"{r['secs']:.0f}",
                f"[replay]({r['replay']})" if r["replay"] else "",
                args.note,
            ]
            f.write("| " + " | ".join(fmt(c) for c in cells) + " |\n")
            print(
                f"{r['case_id']}: deal={r['deal']} score={fmt(r['score'])} rounds={r['rounds']} "
                f"secs={r['secs']}  {r['replay']}"
            )
            if args.observe:
                print(f"observation input: {r['file']}")
    scored = [r["score"] for r in rows if r.get("score") is not None]
    if scored:
        print(f"mean score: {100 * sum(scored) / len(scored):.1f} over {len(scored)} cases")
    if client.practice_remaining is not None:
        print(f"practice sessions left today: {client.practice_remaining}")
    if any("error" in r for r in rows):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
