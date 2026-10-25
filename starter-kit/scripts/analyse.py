"""Case analysis report: every unique run of a case, best first, round by round - our move, its reply,
its reasons in its own words, its back office, our engine's reasons - plus a summary table.

    uv run python scripts/analyse.py P02                 # report to notes/analysis/P02.md
    uv run python scripts/analyse.py P02 P08 --print     # also print to the terminal
    uv run python scripts/analyse.py --all               # every practice and sandbox case

Built on the practice corpus (research/playbook.py); reads runs/ only, no arena or model calls.
"""

import argparse
from pathlib import Path

from arena_kit.agents.procudeal.research import playbook as pb
from arena_kit.data import DataPackage

KIT = Path(__file__).resolve().parents[1]
OUT = KIT.parent / "notes" / "analysis"


def summary(records):
    rows = [
        "| run | note | score | deal at (share of opening) | terms | C_deal / C_open | rounds | end |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for i, r in enumerate(records, 1):
        terms = pb.terms_text(r.get("deal_terms") or {}) if r.get("deal_terms") else ""
        share = f"{r['deal_price']:.3f}" if r.get("deal_price") else "-"  # the corpus stores it as a share
        rows.append(
            f"| {i} | {r.get('note')} | {r.get('score') or 0:.3f} | {share} | {terms} | {r.get('c_deal_share') or '-'} "
            f"| {r.get('rounds')} | {(r.get('close') or {}).get('type') or r.get('end_reason') or '-'} |"
        )
    return "\n".join(rows)


def report(case_id, corpus):
    records = sorted(pb.dedupe([r for r in corpus if r["case_id"] == case_id]), key=lambda r: -(r.get("score") or 0))
    if not records:
        return None
    head = [
        f"# {case_id}: {records[0].get('title')}",
        "",
        f"{len(records)} unique runs, best first.",
        "",
        summary(records),
        "",
    ]
    for i, r in enumerate(records, 1):
        head += [
            f"## Run {i}: {r.get('note')} ({r.get('score') or 0:.3f})",
            "",
            "```",
            pb.render(r, max_chars=12000),
            "```",
            "",
        ]
    return "\n".join(head)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("cases", nargs="*", help="P02, case:P02, ...")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--print", action="store_true")
    args = ap.parse_args()
    corpus = pb.practice_corpus(package=DataPackage(KIT / "data" / "package"))
    ids = (
        sorted({r["case_id"] for r in corpus})
        if args.all
        else [c if c.startswith("case:") else f"case:{c}" for c in args.cases]
    )
    OUT.mkdir(parents=True, exist_ok=True)
    for case_id in ids:
        text = report(case_id, corpus)
        if text is None:
            print(f"{case_id}: no runs")
            continue
        path = OUT / f"{case_id.split(':')[1]}.md"
        path.write_text(text, encoding="utf-8")
        print(f"{case_id}: {path.relative_to(KIT.parent)} ({len(text):,} chars)")
        if args.print:
            print(text)


if __name__ == "__main__":
    main()
