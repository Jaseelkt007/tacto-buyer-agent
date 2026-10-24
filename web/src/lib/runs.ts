import raw from "@/data/runs.json";
import { data as inbox, type CaseFile, type Claim, type Terms } from "./inbox";

export type SupplierMove = {
  offer_id: string | null;
  round: number;
  status: "open" | "final_offer" | "agreed" | "walked_away" | string;
  terms: Terms;
  alternatives: { offer_id: string; terms: Terms }[];
  missing_fields: string[];
  claims: Claim[];
  claim_results: { index: number; result: string }[];
  signals: Record<string, number | string>;
  text: string;
};

export type BuyerMove = {
  type: "message" | "accept" | "walk_away" | "timeout" | string;
  supplier_id: string;
  subject?: string;
  body?: string;
  refs?: string[];
  term_sheets?: { term_sheet_id: string | null; terms: Terms }[];
  interpreted?: { claims: Claim[] };
  offer_id?: string;
};

export type TraceItem =
  | { round: number; actor: "buyer"; move: BuyerMove; reasons: string[] }
  | { round: number; actor: string; move: SupplierMove; reasons: string[] };

/** One entry of our engine's decision log (agents/procudeal/__init__.py). */
export type Decision = {
  round: number;
  supplier_id: string;
  their_status: string;
  their_offer: string;
  their_terms: Terms;
  action: "send" | "accept" | "walk_away" | string;
  our_sheets: Terms[];
  seconds: number;
  source: "engine" | "kit-llm" | string;
  price?: number;
  anchor?: number;
  ceiling?: number | null;
  their_price_on_our_terms?: number;
  c_main?: number;
  limit?: number;
  sheets?: number;
  claims?: string[];
  why?: string;
  error?: string;
  final_push?: boolean;
  their_price?: number;
};

export type BackofficeLine = { round: number; supplier_id: string; supplier: string; from: string; to: string; text: string };

export type Result = {
  ended?: boolean;
  deal?: boolean;
  supplier_id?: string | null;
  offer_id?: string | null;
  terms?: Terms | null;
  c_open?: number | null;
  c_deal?: number | null;
  c_alt?: number | null;
  c_best?: number | null;
  score?: number | null;
  must_haves_ok?: boolean | null;
  cost_breakdown?: Record<string, number> | null;
};

export type Run = {
  file: string;
  case_id: string;
  agent: string;
  note: string;
  commit: string | null;
  when: string;
  seconds: number | null;
  session_id: string;
  replay_url: string | null;
  end_reason: string | null;
  rounds: number | null;
  result: Result;
  trace: TraceItem[];
  decisions: Decision[];
  backoffice: BackofficeLine[];
};

export const runsData = raw as unknown as { synced_at: string; source: string; runs: Run[] };

export function caseFile(caseId: string): CaseFile | undefined {
  return inbox.cases.find((c) => c.case_id === caseId);
}

export function supplierName(caseId: string, supplierId: string) {
  return caseFile(caseId)?.suppliers.find((s) => s.id === supplierId)?.name ?? supplierId;
}

/** Column label for an agent version: our engine runs carry their note ("engine v1.3"). */
export function versionOf(run: Pick<Run, "agent" | "note">) {
  return run.agent === "procudeal" ? run.note || "procudeal" : `kit ${run.agent}`;
}

export const isSupplierMove = (t: TraceItem): t is Extract<TraceItem, { move: SupplierMove }> => t.actor !== "buyer";

/** One turn of a thread: the supplier's move, what happened inside the supplier to produce it,
 * what our agent decided on reading it, and the move we sent back. */
export type Step = {
  supplierId: string;
  round: number;
  offer: SupplierMove;
  reasons: string[];
  inside: BackofficeLine[];
  decision: Decision | null;
  reply: BuyerMove | null;
  /** Our claims this reply checked, paired with the verdict. */
  verdicts: { claim: Claim; result: string }[];
};

export function buildSteps(run: Run): Step[] {
  const steps: Step[] = [];
  const last = new Map<string, Step>();
  const sent = new Map<string, Claim[]>(); // claims in our latest message per supplier
  for (const t of run.trace) {
    if (isSupplierMove(t)) {
      const m = t.move;
      const ours = sent.get(t.actor) ?? [];
      const step: Step = {
        supplierId: t.actor,
        round: t.round,
        offer: m,
        reasons: t.reasons,
        inside: run.backoffice.filter((b) => b.round === t.round && b.supplier_id === t.actor),
        decision:
          run.decisions.find((d) => d.supplier_id === t.actor && m.offer_id && d.their_offer === m.offer_id) ?? null,
        reply: null,
        verdicts: m.claim_results.map((r) => ({ claim: ours[r.index], result: r.result })).filter((v) => v.claim),
      };
      steps.push(step);
      last.set(t.actor, step);
    } else {
      const m = t.move as BuyerMove;
      const step = last.get(m.supplier_id);
      if (step && !step.reply) step.reply = m;
      if (m.type === "message") sent.set(m.supplier_id, m.interpreted?.claims ?? []);
    }
  }
  return steps;
}

export const STATUS_LABEL: Record<string, string> = {
  open: "Counter-offer",
  final_offer: "Final offer",
  agreed: "Agreed",
  walked_away: "Walked away",
};

export const CLAIM_LABEL: Record<string, string> = {
  rival_offer: "Rival offer",
  rival_quote: "Rival quote",
  notice_period: "Notice period",
  should_cost: "Should-cost",
  quality_record: "Quality record",
  index_change: "Index change",
  delivery_record: "Delivery record",
  volume_change: "Volume change",
};

export const COST_LABEL: Record<string, string> = {
  price: "Price",
  uncovered_need: "Uncovered need",
  fallback_risk: "Fallback risk",
  payment_terms: "Payment terms",
  freight: "Freight",
  late_delivery: "Late delivery",
  quality: "Quality",
  tooling: "Tooling",
  index_clause: "Index clause",
  index_risk: "Index risk",
  relationship: "Supplier health",
};
