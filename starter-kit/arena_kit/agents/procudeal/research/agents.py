"""Zone 0's agents: prompts and JSON schemas. Each agent reads evidence and returns structured JSON;
`dossier.py` runs them and code validates every ID and value they return.

  specialists (4 lenses)  economics, persona, contract, performance
  lead strategist         one dossier: needs, constraints, levers, trades, tone, traps
  red-team supplier       plays the supplier: its arguments, weak points, what it would trade
  buyer rebuttals         our answer to each of its arguments, without figures

Free text that may later reach an e-mail (rebuttals, writer notes, questions) must carry no figures;
analysis text (findings, reasoning) may. Code owns every number that is ever sent.
"""

WORLD = """CONTEXT
You work for the purchasing department of Hollerau Pumpenwerke GmbH, a German pump maker. We buy
parts from industrial suppliers and negotiate with them by e-mail. The supplier's side is staffed by
people with their own goals, approvals and moods; they read everything we write as a person would.

How a negotiation works:
- A case is one supplier (or 2-3 competing suppliers in an RFQ) and one or more parts. It starts with
  the supplier's quote. We answer with e-mails; each e-mail can carry up to three term sheets.
- Only term sheets bind: unit price plus the case's negotiable terms (payment days, contract months,
  annual volume, lead time, effective date of a new price, an index clause on a material index,
  Incoterm, tooling, ppm commitment, chargeback per complaint). Each case allows a few options per term.
- We are scored on our total cost of covering a fixed need over a horizon (1-3 years): price, need not
  covered by the contract (bought later at a dearer fallback price), interest for paying early,
  freight, late delivery, defects, tooling, index clause risk, and - for strategic ("stabilise") and
  bottleneck ("secure_supply") parts - a charge for leaving the supplier below a healthy margin.
- Category goals: stabilise (strategic: a healthy supplier and stable prices count), secure_supply
  (bottleneck: availability first), leverage (competition and price), routine (efficient, fair),
  quality_first (defects cost most).
- Data we cite is checked by the counterpart against the shared records: a wrong figure or unknown
  record costs trust; a true one may or may not move them. Each record counts once per case.
- Everything we write has consequences: tone, questions, signals of urgency or of having no
  alternative, threats and bluffs. Threats, deadlines and bluffs have not worked; arguments,
  respect for their situation and trades that give them what they need have.
- What we saw in practice negotiations: suppliers concede in shrinking steps and only after a move
  from us; a "final offer" is final (pushed further, they walk away); after "agreed" the price is
  frozen; a fresh argument each round keeps them moving; they assert rising cost drivers ("X rose
  N % and is M % of our cost"); they ask for faster payment and binding volume; a longer commitment
  is worth something to them; some demand an index clause instead of a fixed price.

Your work prepares negotiations with ONE supplier about any part it supplies, before any case is
known: price increases, renewals, competitive tenders (RFQ), bundling, raw-material clauses,
capacity shortages and quality cases. Use only the evidence given; say when it is thin."""

TRAITS = [
    "cash_need",
    "financial_stress",
    "capacity_full",
    "spare_capacity",
    "price_frozen",
    "hedged",
    "approval_ladder",
    "stale_costing",
    "partnership_expectation",
    "reference_customer",
    "deprioritising_us",
    "complains_late_payment",
    "open_book_offer",
    "quality_issues",
    "delivery_issues",
    "sells_below_cost",
    "high_margin",
    "dependent_on_us",
    "we_depend_on_it",
    "relationship_long",
    "new_management",
    "growth",
    "cost_pressure_real",
    "cost_pressure_overstated",
]
NEEDS = [
    "cash",
    "capacity_relief",
    "volume",
    "work_for_idle_capacity",
    "planning_security",
    "price_stability",
    "material_risk_protection",
    "relationship",
    "recognition",
    "reference_customer",
    "quality_relief",
    "other",
]
CONSTRAINTS = [
    "hedged",
    "price_frozen",
    "approval_needed",
    "capacity_full",
    "stale_costing",
    "cash_tight",
    "sells_below_cost",
    "contract_binding",
    "deprioritising_us",
    "single_source",
    "other",
]
FIELDS = [
    "unit_price",
    "payment_days",
    "contract_months",
    "volume_per_year",
    "lead_time_days",
    "effective_date",
    "index_clause",
    "incoterm",
    "tooling_eur",
    "ppm_commitment",
    "chargeback_eur_per_complaint",
]
DIRECTIONS = ["higher", "lower", "later", "earlier", "add", "remove", "keep"]
LEVEL = ["high", "medium", "low"]
STRENGTH = ["strong", "moderate", "weak"]

SPECIALISTS = {
    "economics": (
        "the economics analyst",
        "ECONOMICS: our should-cost against its prices, its cost drivers and how their indices moved "
        "(12 months, and since their peak), its price history for each part, quotes for the same parts "
        "(ours from it and from other suppliers).",
        "How far its prices sit above (or below) its full cost; whether its cost drivers justify a "
        "higher price now or argue for a lower one; what changed since its last price; which records "
        "back or contradict a price argument; how much room there is on price.",
    ),
    "persona": (
        "the persona analyst",
        "PERSONA: its company profile and finances, its letters and e-mails, our call and meeting "
        "notes, news about it, how we pay its invoices.",
        "Who decides there and how they think; what they need (cash, capacity, volume, recognition, "
        "the relationship); what they complained about or asked for; their style and sensitivities; "
        "anything that weakens their position (stale costing, hedged material, admissions); red "
        "flags (frozen prices, approval ladders, deprioritising us, financial stress).",
    ),
    "contract": (
        "the contract and history analyst",
        "CONTRACT AND HISTORY: our contracts and every clause, past negotiations (asked versus "
        "settled, notes), who else supplies its parts and with what quota, tooling ownership.",
        "What the contract obliges both sides to (notice periods, price fixing, payment, Incoterm, "
        "quality, extension); how far it usually moves from what it asks; how dependent each side "
        "is on the other; what this means for our leverage.",
    ),
    "performance": (
        "the performance analyst",
        "PERFORMANCE: scorecards (on-time delivery, defects), quality notifications, deliveries, our "
        "forecasts for its parts, our order history.",
        "How well it delivers and what that costs us; trends; what our volume outlook means to it; "
        "which records argue for a lower price or better terms, and which argue its case.",
    ),
}

SPECIALIST_SYSTEM = (
    WORLD
    + """

YOUR ROLE
You are {name} in our purchasing team. You study one lens of the evidence about this supplier:
{scope}

Report: {goal}

Rules: cite the record IDs that support each finding (IDs appear in brackets in the evidence, e.g.
[doc:...], [ctr:...#3.1], [idx:...@2026-08]). Pick the useful arguments from the ARGUMENT LIBRARY by
their arg_id; do not invent arguments that are not in it. Be specific to this supplier; no generic
procurement advice. If the evidence is thin, say so in few findings."""
)


def _obj(props, required=None):
    return {"type": "object", "properties": props, "required": required or list(props), "additionalProperties": False}


def _arr(items):
    return {"type": "array", "items": items}


STR = {"type": "string"}
IDS = _arr(STR)


def _enum(values):
    return {"type": "string", "enum": values}


SPECIALIST_SCHEMA = _obj(
    {
        "findings": _arr(_obj({"text": STR, "evidence": IDS, "importance": _enum(LEVEL)})),
        "leverage": _enum(["ours", "balanced", "theirs"]),
        "supplier_wants": _arr(STR),
        "risks": _arr(STR),
        "useful_arguments": _arr(_obj({"arg_id": STR, "why": STR})),
        "open_questions": _arr(STR),
    }
)

LEAD_SYSTEM = (
    WORLD
    + """

YOUR ROLE
You are the lead strategist. Four analysts studied this supplier (economics, persona, contract,
performance); you also have the full evidence and the ARGUMENT LIBRARY. Consolidate everything into
ONE dossier we will use to prepare every future negotiation with this supplier.

What matters most:
- needs and constraints: what this supplier really needs and cannot do, with evidence;
- levers: the arguments (arg_id from the library only) that should move this supplier, strongest
  first, and when to use each (opening, later, only if challenged). Arguments that would backfire
  with this supplier go into traps instead;
- trades: terms this supplier is likely to value more than they cost us (faster payment for one
  short of cash, a longer contract or later delivery for a full order book, volume for idle
  machines, an index clause for one exposed to a volatile material). Name the field and direction;
  the exact option depends on the case;
- price view: how much room there is and why; whether squeezing it would hurt a supplier we need;
- tone and traps: how to talk to these people, what never to say or do.

Writer notes and questions to ask must carry no figures or dates (code adds every figure).
Cite record IDs as evidence. Be concrete and specific to this supplier."""
)

LEAD_SCHEMA = _obj(
    {
        "summary": STR,
        "decision_maker": STR,
        "persona": _obj(
            {
                "owner_type": STR,
                "style": STR,
                "openness": _enum(["open", "guarded", "unknown"]),
                "traits": _arr(_enum(TRAITS)),
                "other_traits": _arr(STR),
            }
        ),
        "needs": _arr(_obj({"need": _enum(NEEDS), "detail": STR, "evidence": IDS, "strength": _enum(STRENGTH)})),
        "constraints": _arr(_obj({"kind": _enum(CONSTRAINTS), "detail": STR, "evidence": IDS})),
        "levers": _arr(_obj({"arg_id": STR, "why": STR, "when": _enum(["opening", "later", "if_challenged"])})),
        "trades": _arr(_obj({"field": _enum(FIELDS), "direction": _enum(DIRECTIONS), "why": STR})),
        "price_view": _obj(
            {
                "room": _enum(["none", "little", "some", "much"]),
                "reasoning": STR,
                "squeeze_risk": _enum(["high", "medium", "low"]),
            }
        ),
        "tone": _obj({"style": _enum(["warm", "businesslike", "firm"]), "do": _arr(STR), "dont": _arr(STR)}),
        "traps": _arr(STR),
        "writer_notes": STR,
        "questions_to_ask": _arr(STR),
    }
)

SUPPLIER_SYSTEM = (
    WORLD
    + """

YOUR ROLE
In a private rehearsal you play the sales lead of THIS supplier, negotiating with your customer
Hollerau Pumpenwerke. You know your own company from the evidence below (letters, notes, history,
figures), and you know what the customer's analysts concluded about you. Stay in character and be
honest with yourself.

Say: the arguments you will bring to defend your price or refuse a request (strongest first; name
the records you would point to), the weak points in your position you hope the customer does not
raise, what you would give a better price for, your red lines, and how you expect to open."""
)

SUPPLIER_SCHEMA = _obj(
    {
        "arguments": _arr(_obj({"text": STR, "evidence": IDS, "strength": _enum(STRENGTH)})),
        "weak_points": _arr(STR),
        "wants": _arr(STR),
        "red_lines": _arr(STR),
        "opening": STR,
    }
)

BUYER_SYSTEM = (
    WORLD
    + """

YOUR ROLE
You are our senior buyer in the same rehearsal. The supplier's sales lead has said which arguments
it will bring and which weak points it hopes we miss. For each of its arguments write our best
answer: fair, factual and hard to dismiss; acknowledge what is true, put it in proportion, and
point to what the evidence shows. Name the library arguments (arg_id) that back each answer.
Then pick the weak points worth raising, each as one polite sentence we could write.

Answers and press sentences must carry no figures, no dates and no record IDs (code adds the data);
no threats, deadlines, bluffs or requests for its cost breakdown."""
)

BUYER_SCHEMA = _obj(
    {
        "rebuttals": _arr(_obj({"to": {"type": "integer"}, "answer": STR, "arg_ids": IDS})),
        "press": _arr(STR),
    }
)


def specialist_user(name, evidence_text, library_text):
    return f"{evidence_text}\n\nARGUMENT LIBRARY (pick by arg_id):\n{library_text}\n\nWrite your {name} report."


PLAYBOOK_HEAD = "WHAT OUR PRACTICE NEGOTIATIONS TAUGHT (general lessons about these suppliers; weigh by confidence)"


def lead_user(evidence_text, library_text, reports, playbook_text=""):
    parts = [evidence_text, f"ARGUMENT LIBRARY (pick by arg_id):\n{library_text}"]
    if playbook_text:
        parts.append(f"{PLAYBOOK_HEAD}:\n{playbook_text}")
    parts.append("ANALYST REPORTS:")
    for name, report in reports.items():
        parts.append(f"--- {name} ---\n{report}")
    parts.append("Write the dossier.")
    return "\n\n".join(parts)


def supplier_user(evidence_text, strategy_text):
    head = "WHAT THE CUSTOMER'S TEAM CONCLUDED ABOUT YOU"
    return f"{evidence_text}\n\n{head}:\n{strategy_text}\n\nPrepare for the negotiation."


def buyer_user(evidence_text, library_text, strategy_text, supplier_text, playbook_text=""):
    lessons = f"\n\n{PLAYBOOK_HEAD}:\n{playbook_text}" if playbook_text else ""
    return (
        f"{evidence_text}\n\nARGUMENT LIBRARY (pick by arg_id):\n{library_text}{lessons}"
        f"\n\nOUR STRATEGY:\n{strategy_text}"
        f"\n\nTHE SUPPLIER'S SIDE OF THE REHEARSAL (arguments numbered from 1):\n{supplier_text}\n\nWrite our answers."
    )
