"""Read a supplier's e-mail: what it asks for and what state it is in.

The arena's suppliers phrase these the same way across cases (their replies are templated), so the
patterns carry over to suppliers we have never seen. Each pattern was taken from real replies.
"""

import re
from dataclasses import dataclass, field

ASKS = {
    # "Which volume can you commit to?" / "A binding higher volume would help us and can improve the price."
    "volume": r"which volume can you commit|binding higher volume|commit to a higher (?:annual )?volume",
    # "Faster payment is welcome; we can reflect it in the price." / "we really need faster payment terms"
    "payment": r"faster payment|improve the payment terms|shorter payment terms|talk about payment",
    # "We can offer a Preisgleitklausel on AS-14404." / "with a Preisgleitklausel on …"
    # (a quote's "no Preisgleitklausel" is not an ask, v1.7)
    "clause": r"(?<!no )(?<!without )(?:preisgleitklausel|price adjustment clause|index clause|surcharge clause)",
    # "Which figures is that based on? Please send us the data." / "please provide proof"
    "data": r"which figures is that based on|send us the data|provide proof",
}
TRAITS = {
    # "Due to the strict freeze on price reductions mandated by our management …"
    "price_frozen": r"freeze on price reductions|frozen all price reductions|talk about the terms instead",
    # "As to the index change data you cited, that is not our reality: our AS-14404 is covered at fixed prices"
    "hedged": r"not our reality|covered at fixed prices",
    # "Without movement from your side we cannot move either." / "we are stuck here"
    "stuck": r"without movement from your side|we are (?:still )?stuck|cannot concede further",
    # "We need to clarify this internally - we will come back to you on price" (v1.7; not "we have clarified")
    "clarify": r"need to clarify (?:this |that )?internally|will come back to you on (?:the )?price"
    r"|check (?:this |that )?internally",
}
# The cost driver an opening quote asserts: "CU-NOTATION rose 47.7 % in twelve months and is 20 % of our cost."
DRIVER = re.compile(r"(\S+) rose ([\d.]+) ?% in twelve months and is (\d+) ?% of our cost")
_ASKS = {k: re.compile(v, re.I) for k, v in ASKS.items()}
_TRAITS = {k: re.compile(v, re.I) for k, v in TRAITS.items()}


@dataclass
class Driver:
    series: str
    rise_pct: float  # its stated rise over twelve months
    share_pct: float  # its stated share of its cost


@dataclass
class Reading:
    asks: set = field(default_factory=set)
    traits: set = field(default_factory=set)
    delay_days: int | None = None


def read(message):
    """Asks, traits and reply delay of one supplier e-mail."""
    text = f"{message.get('subject') or ''}\n{message.get('body') or ''}"
    return Reading(
        {k for k, p in _ASKS.items() if p.search(text)},
        {k for k, p in _TRAITS.items() if p.search(text)},
        (message.get("signals") or {}).get("reply_delay_days"),
    )


def drivers(message):
    """The cost drivers a supplier e-mail asserts, in its order (the template is arena-wide)."""
    out = []
    for series, rise, share in DRIVER.findall(message.get("body") or ""):
        try:
            out.append(Driver(series.strip(".,;:()"), float(rise.rstrip(".")), float(share)))
        except ValueError:
            continue
    return out
