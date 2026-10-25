"""The e-mail around a move: short, polite, factual. Figures appear only inside claim sentences
(computed by code); the term sheets carry the binding numbers. Never mentions urgency, a budget
or a missing alternative."""

from ...play import latest

SIGN_OFF = "Kind regards\nPurchasing\nHollerau Pumpenwerke GmbH"


def subject(events, case):
    last = latest(events).get("subject") or case.get("title") or "Our proposal"
    return last if last.lower().startswith("re:") else f"Re: {last}"[:300]


def offer_email(case, events, move, side):
    first = not side.ours[:-1]  # side.ours already holds this move's price
    lines = ["Dear Sir or Madam,", ""]
    if move.get("hold"):  # it is clarifying internally: our proposal stands, nothing new (v1.7)
        return _email(case, events, lines + move["answers"] + ["", SIGN_OFF], move["sheets"], [])
    if first:
        lines.append("Thank you for your offer and for explaining your position.")
    else:
        lines.append("Thank you for your reply and for the step you have taken.")
    if move.get("paragraph"):  # case_plan / tactician_text: model words for this sheet, no figures
        lines.append(move["paragraph"])
    if move.get("answers"):
        lines += move["answers"]
    if move["claims"]:
        lines.append("")
        lines.append("Our data shows a different picture on some points:" if first else "One more point from our side:")
        lines += [c.sentence for c in move["claims"]]
    lines.append("")
    n = len(move["sheets"])
    if n > 1 and move.get("trade"):  # one main sheet and one need trade (v1.7)
        lines.append(f"Please find our proposal below. The second package reflects {move['trade']}.")
    elif n > 1:
        lines.append(
            f"Please find {n} packages below. Each of them works for us; let us know which one suits you best."
        )
    else:
        lines.append("Please find our proposal below.")
    if side.dossier.cash_need and "payment_days" in case["negotiable"] and move.get("cash_line", True):
        lines.append("If faster payment helps you, we are open to it, as shown in the packages.")
    lines += ["", "We look forward to your reply.", "", SIGN_OFF]
    refs = sorted({r for c in move["claims"] for r in c.refs})
    return _email(case, events, lines, move["sheets"], refs)


def note_email(case, events, move):
    """A message without a term sheet (e.g. a keepalive): its standing offer stays as it is."""
    lines = ["Dear Sir or Madam,", "", *move["answers"], "", SIGN_OFF]
    return _email(case, events, lines, [], [])


def _email(case, events, lines, sheets, refs):
    return {
        "subject": subject(events, case),
        "body": "\n".join(lines),
        "term_sheets": [{"terms": s} for s in sheets],
        "refs": refs,
    }
