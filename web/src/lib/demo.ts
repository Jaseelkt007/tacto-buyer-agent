// Types and helpers for the /demo deck. Data comes from `npm run sync:demo` (runs/, data package)
// and from src/data/demo/code.json, a reading of the engine code at the commit named inside it.

import codeJson from "@/data/demo/code.json";
import showcaseJson from "@/data/demo/showcase.json";
import statsJson from "@/data/demo/stats.json";
import suppliersJson from "@/data/demo/suppliers.json";

export type Terms = Record<string, number | string | null | Record<string, unknown>>;
export type Sheet = { term_sheet_id?: string; terms?: Terms } & Terms;
export type Claim = { type: string; refs: string[]; asserted?: Record<string, unknown>; result?: string };
export type Decision = Record<string, unknown> & {
  round: number;
  supplier_id?: string;
  action: string;
  source: string;
  seconds: number;
  price?: number;
  anchor?: number;
  ceiling?: number;
  their_price_on_our_terms?: number;
  why?: string;
};

export type EventKind = "backoffice" | "supplier_email" | "buyer_email" | "buyer_accept" | "buyer_walk" | "buyer_timeout" | "claim_check" | "end";

export type TimelineEvent = {
  t_index: number;
  round: number;
  supplier_id?: string;
  kind: EventKind;
  from?: string;
  to?: string;
  subject?: string;
  status?: string;
  offer_id?: string;
  text?: string;
  refs?: string[];
  term_sheets: Sheet[];
  missing_fields?: string[];
  signals?: Record<string, unknown>;
  claims: Claim[];
  claim_results?: unknown[];
  supplier_reasons: string[];
  decision: Decision | null;
  seconds: number | null;
  term_sheet_id?: string;
  end_reason?: string;
  deal?: boolean;
  score?: number;
};

export type ShowSupplier = {
  id: string;
  name: string;
  country: string;
  opening: { offer_id: string; status: string; terms: Terms; missing_fields: string[]; signals: Record<string, unknown>; text: string };
  thread: { offer_id: string; status: string; offers: number };
};

export type Session = {
  pick: string;
  meta: {
    case_id: string;
    title: string;
    type: string;
    note: string;
    commit: string;
    when: string;
    seconds: number;
    session_id: string;
    score: number;
    c_open: number;
    c_deal: number | null;
    c_best: number;
    c_alt: number | null;
    deal: boolean;
    supplier_id?: string;
    end_reason: string;
    rounds: number;
    round_limit?: number;
    replay_url?: string;
    must_haves_ok?: boolean;
    cost_breakdown?: Record<string, number>;
    briefing?: string;
    negotiable?: string[];
    must_haves?: { field: string; op: string; value: unknown }[];
    category_goal?: string;
    terms?: Terms;
  };
  suppliers: ShowSupplier[];
  timeline: TimelineEvent[];
  stop: { who: string; why: string; category: string };
};

export const showcase = showcaseJson as unknown as { synced_at: string; sessions: Session[] };
export const stats = statsJson as unknown as Stats;
export const suppliers = suppliersJson as unknown as Suppliers;

export type RunRow = {
  case_id: string;
  file: string;
  note: string;
  commit: string;
  when: string;
  seconds: number;
  score: number;
  deal: boolean;
  c_open: number;
  c_deal: number | null;
  c_best: number;
  end_reason: string;
  rounds: number;
  n_suppliers: number;
  n_moves: number;
  engine_moves: number;
  kit_llm_moves: number;
  timeouts: number;
  avg_move_seconds: number;
  max_move_seconds: number;
  final_action: string;
  stop: string;
  stop_why: string;
  errors: string[];
};

export type Stats = {
  synced_at: string;
  totals: { runs: number; procudeal_runs: number; baseline_runs: number; cases: number; deals: number; mean_score_all: number; mean_score_latest_per_case: number; latest_version: string };
  by_version: { note: string; n: number; mean_score: number; deals: number; cases: string[]; mean_rounds: number; kit_llm_moves: number; first_when: string }[];
  by_case: {
    case_id: string;
    title: string;
    type: string;
    n_runs: number;
    best_score: number;
    best_note: string;
    latest_score: number;
    latest_note: string;
    latest_rounds: number;
    latest_stop: string;
    rounds: number[];
    scores: { note: string; score: number }[];
    naive?: number | null;
    kit_llm?: number | null;
  }[];
  end_reasons: Record<string, number>;
  stop_categories: Record<string, number>;
  rounds_histogram: Record<string, number>;
  moves: {
    total: number;
    engine: number;
    kit_llm: number;
    actions: Record<string, number>;
    timeouts: number;
    errors: Record<string, number>;
    kit_llm_runs: { file: string; case_id: string; note: string; kit_llm_moves: number; engine_moves: number; cause: string }[];
    avg_seconds: number;
    max_seconds: number;
    seconds_by_source: { engine_median: number; engine_max: number; engine_first_move_median: number; kit_llm_median: number; kit_llm_max: number };
  };
  claims: { by_type: Record<string, Record<string, number>>; results: Record<string, number>; engine_labels: Record<string, number> };
  supplier_reading: { asks: Record<string, number>; traits: Record<string, number>; runs_with_asks: number };
  baselines: { case_id: string; agent: string; score: number; deal: boolean; rounds: number }[];
  runs: RunRow[];
};

export type DetailedSupplier = {
  id: string;
  name: string;
  country: string;
  category: string;
  abc_class: string;
  blocked: boolean;
  cases: string[];
  n_documents: number;
  document_kinds: Record<string, number>;
  n_news: number;
  intel: Record<string, string | number | null> | null;
  should_cost_rows: number;
  n_parts: number;
  scorecard_rows: number;
  latest_scorecard: { quarter: string; score: number; otd_pct: number; ppm: number; class: string; colour: string } | null;
  contract: { id: string; type: string; valid_to: string; payment_days: number; notice_days: number; price_basis: string } | null;
  contract_clauses: number;
  index_clauses: number;
  invoices: number;
  late_paid_share: number | null;
  dossier: {
    owner_rate: number | null;
    cash_premium: number;
    interest_rate: number;
    cash_need: boolean;
    wants_work: boolean;
    capacity_full: boolean;
    notes: string[];
    evidence: Record<string, { id: string; matches: string[] }[]>;
  };
};

export type Suppliers = {
  total: number;
  detailed_count: number;
  breakdown: Record<string, Record<string, number>>;
  dossier_rules: { owner_rate: Record<string, number>; default_rate: number; cash_premium: number; signs: Record<string, string>; source: string };
  notes: string[];
  in_cases: Record<string, string[]>;
  detailed: DetailedSupplier[];
  all: { id: string; name: string; country: string; category: string; abc_class: string; blocked: boolean; detailed: boolean }[];
};

/** The unit price a sheet carries, whichever shape it comes in. */
export function sheetPrice(s: Sheet | undefined): number | null {
  if (!s) return null;
  const t = (s.terms ?? s) as Terms;
  return typeof t.unit_price === "number" ? t.unit_price : null;
}

export function sheetTerms(s: Sheet): Terms {
  return (s.terms ?? s) as Terms;
}

export const shortCase = (id: string) => id.replace(/^case:/, "");

/** Supplier display names, short enough for lane labels. */
export function shortName(name: string) {
  return name.replace(/\b(GmbH & Co\. KG|GmbH|AG|KG|s\.r\.o\.|Sp\. z o\.o\.|Kft\.)\b/g, "").replace(/\s+/g, " ").trim();
}

// ---------- code.json: a reading of the engine code (stages, flow, prompts, issues) ----------


export type Ref = { file?: string; line?: number };
export type Stage = Ref & { id: string; name: string; kind: string; when: string; function?: string; summary: string; inputs: string[]; outputs: string[]; details: string[] };
export type FlowStep = Ref & { order: number; id: string; condition: string; action: string; reason_key?: string };
export type ReadyStep = Ref & { order: number; condition: string; returns: string };
export type StopReason = Ref & { id: string; who: string; trigger: string; effect: string };
export type Constant = Ref & { name: string; value: unknown; meaning: string };
export type ClaimKind = Ref & { type: string; strength?: number; when_used: string; sentence_template: string; refs: string };
export type SignalRow = { key: string; regex: string; example?: string; effect_in_policy?: string; effect?: string };
export type Issue = Ref & { title: string; detail: string; severity: "high" | "medium" | "low" };

export type Code = {
  commit: string;
  engine: string;
  generated_from: string;
  stages: Stage[];
  decide_flow: FlowStep[];
  ready_flow: ReadyStep[];
  pricing: { summary: string; steps: (Ref & { name: string; formula: string; explain: string })[] };
  rfq: { summary: string; steps: (Ref & { order: number; name: string; condition: string; action: string })[]; examples: string[] };
  stop_reasons: StopReason[];
  constants: Constant[];
  claims: ClaimKind[];
  claims_selection: Ref & { rule: string };
  signals: { source: Ref & { note: string }; asks: SignalRow[]; traits: SignalRow[]; dossier?: SignalRow[] } & Record<string, unknown>;
  trace_fields: { key: string; meaning: string }[];
  llm: {
    engine_calls_per_move: number;
    engine_note: string;
    fallback: Ref & {
      trigger: string;
      calls_per_move: string;
      timeout_s: number;
      timeout_note: string;
      provider_env: string[];
      on_llm_failure: string;
      complete_constructed_always: string;
      prepare_note: string;
      system_prompt: string;
      system_prompt_line?: number;
      user_prompt_structure: { section: string; content: string }[];
      user_prompt_line?: number;
      expected_reply_schema: string;
      guard_steps: string[];
      guard_line?: number;
    };
    other_call_sites: (Ref & { what?: string; note?: string })[];
    other_call_sites_note?: string;
  };
  email_template: Ref & { verbatim_lines: { condition: string; text: string; line?: number }[] };
  issues: Issue[];
};

export const code = codeJson as unknown as Code;
