// The two pipelines the "Inside a run" page plays: the offline research (zone 0) and the live
// negotiation. Positions are on the player's canvas; every box says when it runs, what it reads,
// what it returns and how that is checked.

export type Kind = "data" | "code" | "model" | "arena" | "supplier" | "result" | "live";

export const KINDS: Record<Kind, { label: string; color: string }> = {
  data: { label: "Data package", color: "var(--s-ours)" },
  code: { label: "Our code", color: "var(--s-3)" },
  model: { label: "Language model", color: "var(--s-model)" },
  arena: { label: "Arena", color: "var(--ink-2)" },
  supplier: { label: "Supplier bot", color: "var(--s-supplier)" },
  result: { label: "Result", color: "var(--accent)" },
  live: { label: "Live engine", color: "var(--ink-2)" },
};

export type GraphNode = {
  x: number;
  y: number;
  h?: number;
  kind: Kind;
  title: string;
  sub: string;
  when: string;
  reads: string;
  returns: string;
  check: string;
};

export type Graph = {
  width: number;
  height: number;
  nodes: Record<string, GraphNode>;
  edges: [string, string][];
  rows: { label: string; nodes: string[] }[];
  columns: { x: number; text: string }[];
};

export const NEGOTIATION: Graph = {
  width: 1010,
  height: 440,
  nodes: {
    case: { x: 20, y: 20, kind: "data", title: "Case file", sub: "need · goal · options", when: "When the session opens", reads: "The arena's case: need, horizon, goal, rates, negotiable fields and their options, must-haves, alternative", returns: "The rules and prices every cost is computed with", check: "Fixed by the arena; never changed by the agent" },
    quote: { x: 20, y: 100, kind: "data", title: "Quote PDFs", sub: "standard terms", when: "With each supplier's opening quote", reads: "Each supplier's quote PDF", returns: "Its standard terms: what closes for any field a term sheet leaves out", check: "Parsed line by line; a line that cannot be read is skipped" },
    tables: { x: 20, y: 180, kind: "data", title: "Data tables", sub: "suppliers · should-cost · POs", when: "Before the first move", reads: "SQLite: suppliers, supplier_intel, should_cost, scorecards, contracts, forecasts", returns: "Owner type, full-cost estimate, delivery and quality record", check: "Read only; all IDs exist in the data package" },
    letters: { x: 20, y: 260, kind: "data", title: "Letters & news", sub: "correspondence", when: "Before the first move", reads: "The supplier's letters, e-mails, our call and meeting notes, press", returns: "Text the dossier scans for what the supplier wants", check: "Read only" },
    facts: { x: 20, y: 340, kind: "data", title: "Facts & indices", sub: "10,356 citable IDs", when: "Before the first move", reads: "facts.json and the index series", returns: "IDs and values the claim bank may cite", check: "Only IDs in facts.json are cited; an unknown ID is contradicted" },
    reader: { x: 230, y: 100, kind: "code", title: "Quote reader", sub: "quote.py", when: "Once per quote", reads: "Quote PDF text", returns: "Standard terms per supplier", check: "Tolerant: unreadable lines are logged and skipped" },
    dossier: { x: 230, y: 220, kind: "code", title: "Dossier", sub: "dossier.py", when: "Once per supplier, at setup", reads: "Data tables, letters and news", returns: "Full cost, what money is worth to it, cash / work / capacity signals", check: "Every later offer caps the full-cost estimate (it never sells below its floor)" },
    claims: { x: 230, y: 340, kind: "code", title: "Claim bank", sub: "claims.py", when: "At setup; one or more per message", reads: "Facts, indices, contracts, scorecards, forecasts, rival offers", returns: "One-sentence arguments, figure next to the IDs, strongest first", check: "Figures computed the way the arena checks them; each ID once per case" },
    economics: { x: 430, y: 40, kind: "code", title: "Economics", sub: "economics.py · cost.py", when: "At setup, and for every sheet", reads: "Case file, standard terms, dossier", returns: "Total cost C of any sheet, walk-away limit, ceiling, anchor, best term mix", check: "The kit's published cost function; the deal anatomy matches the arena on every deal" },
    policy: { x: 430, y: 180, kind: "code", title: "Policy", sub: "policy.py · decide()", when: "Every time a supplier answers", reads: "Its offer, the arena's verdicts, our plan", returns: "Accept, walk away, or a counter: price, sheets, arguments", check: "Accept only if C beats the limit, must-haves hold, and it is the standing offer" },
    llm: { x: 430, y: 320, kind: "model", title: "LLM fallback", sub: "kit LLM agent", when: "Only if the engine raises an error", reads: "The conversation so far", returns: "A move written by a language model", check: "Used rarely; the replay marks every such move" },
    writer: { x: 630, y: 250, kind: "code", title: "Writer", sub: "writer.py", when: "With every counter", reads: "The decision and its arguments", returns: "The e-mail: thanks, one argument per sentence, the term sheets", check: "No figures outside claims; no urgency, budget or missing alternative" },
    arena: { x: 630, y: 110, kind: "arena", title: "Arena", sub: "routing · claim checks", when: "Every message", reads: "Our e-mail and term sheets", returns: "Verdict per argument (≤ 3): verified, duplicate, irrelevant, contradicted", check: "Tolerance ±0.5 percentage points for %, else ±0.5 %" },
    clock: { x: 630, y: 20, h: 50, kind: "arena", title: "60 s clock", sub: "per message", when: "From each supplier reply", reads: "Time to our next move", returns: "Timeout if we are late", check: "Three timeouts in a row end the thread" },
    sales: { x: 830, y: 110, kind: "supplier", title: "Supplier: sales", sub: "writes the replies", when: "After each of our messages", reads: "Our e-mail, its back office", returns: "A counter, final offer, agreement, or walking away", check: "Its prices come from its own cost and capacity data" },
    office: { x: 830, y: 250, kind: "supplier", title: "Supplier: back office", sub: "owner · finance · logistics", when: "Before sales answers", reads: "Questions from sales", returns: "Sign-offs and answers", check: "Each department sees only its own data" },
    score: { x: 630, y: 370, h: 52, kind: "result", title: "Score", sub: "total cost → 0–100", when: "When the case ends", reads: "The accepted sheet, or no deal", returns: "C of the deal and the score", check: "score = (C_open − C_deal) ÷ (C_open − C_best), clipped to 0–1" },
  },
  edges: [
    ["case", "economics"],
    ["quote", "reader"],
    ["reader", "economics"],
    ["tables", "dossier"],
    ["letters", "dossier"],
    ["dossier", "economics"],
    ["facts", "claims"],
    ["claims", "policy"],
    ["economics", "policy"],
    ["arena", "policy"],
    ["policy", "writer"],
    ["llm", "writer"],
    ["writer", "arena"],
    ["arena", "sales"],
    ["office", "sales"],
    ["sales", "arena"],
    ["policy", "arena"],
    ["arena", "score"],
    ["sales", "quote"],
  ],
  rows: [
    { label: "Data", nodes: ["case", "quote", "tables", "letters", "facts"] },
    { label: "Quote reader", nodes: ["reader"] },
    { label: "Dossier", nodes: ["dossier"] },
    { label: "Claim bank", nodes: ["claims"] },
    { label: "Economics", nodes: ["economics"] },
    { label: "Policy", nodes: ["policy"] },
    { label: "LLM fallback", nodes: ["llm"] },
    { label: "Writer", nodes: ["writer"] },
    { label: "Arena", nodes: ["arena", "clock", "score"] },
    { label: "Supplier sales", nodes: ["sales"] },
    { label: "Supplier back office", nodes: ["office"] },
  ],
  columns: [
    { x: 20, text: "DATA" },
    { x: 230, text: "OUR CODE: EVERY NUMBER" },
    { x: 830, text: "SUPPLIER BOT" },
  ],
};

export const RESEARCH: Graph = {
  width: 1010,
  height: 470,
  nodes: {
    r_tables: { x: 20, y: 20, kind: "data", title: "Data tables", sub: "intel · prices · orders", when: "Offline, before the final", reads: "suppliers, supplier_intel, should_cost, price conditions, orders, forecasts", returns: "Rows about this supplier and its parts, with IDs", check: "Read only" },
    r_letters: { x: 20, y: 105, kind: "data", title: "Letters & notes", sub: "e-mails · calls · meetings · news", when: "Offline", reads: "Every letter, e-mail, call and meeting note, news item about the supplier", returns: "Full texts with their doc: / news: IDs", check: "Read only" },
    r_contracts: { x: 20, y: 190, kind: "data", title: "Contracts", sub: "clauses · past negotiations", when: "Offline", reads: "Contracts and clauses, negotiation history, sourcing", returns: "Clauses with ctr: IDs, what was asked and settled before", check: "Read only" },
    r_perf: { x: 20, y: 275, kind: "data", title: "Performance", sub: "scorecards · QNs · deliveries", when: "Offline", reads: "Scorecards, quality notifications, goods receipts, invoices", returns: "Delivery and quality record with sc: / qn: IDs", check: "Read only" },
    r_facts: { x: 20, y: 360, kind: "data", title: "Facts & practice runs", sub: "facts.json · runs/", when: "Offline", reads: "Citable facts and index series; our saved practice runs", returns: "Values the library may cite; what suppliers did in practice", check: "Only IDs in facts.json become arguments" },
    evidence: { x: 215, y: 105, kind: "code", title: "Evidence pack", sub: "research/evidence.py", when: "Once per supplier", reads: "All five data groups", returns: "One text pack per data group, every row with its ID", check: "Code only; nothing is summarised by a model here" },
    library: { x: 215, y: 275, kind: "code", title: "Argument library", sub: "research/library.py", when: "Once per supplier", reads: "Evidence pack, facts", returns: "Every verifiable argument: sentence, IDs, exact figure; for us or for them", check: "Figures computed by code the way the arena checks them; the model only picks argument IDs" },
    economics: { x: 410, y: 20, kind: "model", title: "Economics specialist", sub: "should-cost · drivers · prices", when: "In parallel with the other three", reads: "Its slice of the evidence and the library", returns: "Findings with evidence IDs, leverage, useful arguments, open questions", check: "Structured JSON; unknown IDs are dropped by the validator" },
    persona: { x: 410, y: 105, kind: "model", title: "Persona specialist", sub: "intel · letters · notes", when: "In parallel", reads: "Intel, letters, call and meeting notes, news, how we pay", returns: "Who decides, style, needs, what moves them", check: "Every finding must cite evidence IDs" },
    contract: { x: 410, y: 190, kind: "model", title: "Contract specialist", sub: "clauses · history · sourcing", when: "In parallel", reads: "Contracts, clauses, past negotiations, sourcing", returns: "Notice periods, price rules, dependency, past settlements", check: "Every finding must cite evidence IDs" },
    performance: { x: 410, y: 275, kind: "model", title: "Performance specialist", sub: "scorecards · quality · orders", when: "In parallel", reads: "Scorecards, quality notifications, deliveries, forecasts", returns: "Delivery and quality findings, arguments they support", check: "Every finding must cite evidence IDs" },
    lead: { x: 610, y: 20, kind: "model", title: "Lead strategist", sub: "merges the four", when: "After the specialists", reads: "The four reports and the library", returns: "The strategy: decision maker, needs, constraints, levers in order, trades, price room, tone, traps", check: "Levers are library argument IDs; anything else is dropped" },
    redteam: { x: 610, y: 120, kind: "model", title: "Red team", sub: "plays the supplier", when: "After the lead", reads: "The supplier's evidence and our strategy", returns: "The arguments it would bring, its weak points, wants and red lines", check: "Its evidence IDs are validated like ours" },
    rebuttals: { x: 610, y: 220, kind: "model", title: "Rebuttals", sub: "our answers", when: "After the red team", reads: "Each red-team argument and the library", returns: "An answer per argument, without figures, pointing to library arguments", check: "A figure in the text is dropped: figures only come from the library" },
    validator: { x: 820, y: 120, kind: "code", title: "Validator", sub: "research/dossier.py", when: "Before saving", reads: "Everything the models returned", returns: "The same, minus unknown IDs, unknown fields and figures in text", check: "Logged per item in the dossier's validation section" },
    dossier: { x: 820, y: 220, kind: "result", title: "Dossier", sub: "knowledge/suppliers/*.json", when: "Saved once per supplier", reads: "The validated output", returns: "One file per supplier, keyed by supplier and part, never by case", check: "Versioned in the repo; rebuilt after the Sunday release" },
    playbook: { x: 610, y: 340, kind: "result", title: "Playbook", sub: "knowledge/playbook.json", when: "Once, from all practice runs", reads: "Our saved practice runs: offers, reasons, back office, scores", returns: "General arena lessons, plus notes per practice case", check: "Practice-case notes cannot transfer to the final's unseen cases" },
    engine: { x: 820, y: 340, kind: "live", title: "Live engine v1.7c", sub: "does not read zone 0 yet", when: "During the negotiation (tab 2)", reads: "Not these files: it reads the data package directly", returns: "—", check: "Zone 1 (a case strategist at wave start) is the planned bridge" },
  },
  edges: [
    ["r_tables", "evidence"],
    ["r_letters", "evidence"],
    ["r_contracts", "evidence"],
    ["r_perf", "evidence"],
    ["r_facts", "library"],
    ["evidence", "library"],
    ["evidence", "economics"],
    ["evidence", "persona"],
    ["evidence", "contract"],
    ["evidence", "performance"],
    ["library", "lead"],
    ["economics", "lead"],
    ["persona", "lead"],
    ["contract", "lead"],
    ["performance", "lead"],
    ["lead", "redteam"],
    ["redteam", "rebuttals"],
    ["lead", "validator"],
    ["rebuttals", "validator"],
    ["validator", "dossier"],
    ["r_facts", "playbook"],
    ["dossier", "engine"],
  ],
  rows: [
    { label: "Data", nodes: ["r_tables", "r_letters", "r_contracts", "r_perf", "r_facts"] },
    { label: "Evidence pack", nodes: ["evidence"] },
    { label: "Argument library", nodes: ["library"] },
    { label: "Economics", nodes: ["economics"] },
    { label: "Persona", nodes: ["persona"] },
    { label: "Contract", nodes: ["contract"] },
    { label: "Performance", nodes: ["performance"] },
    { label: "Lead strategist", nodes: ["lead"] },
    { label: "Red team", nodes: ["redteam"] },
    { label: "Rebuttals", nodes: ["rebuttals"] },
    { label: "Validator", nodes: ["validator"] },
    { label: "Dossier / playbook", nodes: ["dossier", "playbook", "engine"] },
  ],
  columns: [
    { x: 20, text: "DATA" },
    { x: 215, text: "CODE" },
    { x: 410, text: "OPUS 5.5 SPECIALISTS" },
    { x: 820, text: "CODE · OUTPUT" },
  ],
};
