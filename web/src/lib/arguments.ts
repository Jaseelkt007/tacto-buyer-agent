import type { Claim } from "./inbox";
import { buildSteps, isSupplierMove, runsData, supplierName, versionOf, type BuyerMove } from "./runs";

/** One argument our agent sent, what the arena said about it, and how the supplier's price moved
 * in the reply that checked it. */
export type ArgumentRow = {
  session_id: string;
  case_id: string;
  version: string;
  when: string;
  supplier: string;
  round: number;
  type: string;
  refs: string[];
  asserted: string;
  verdict: string;
  /** Supplier's price before our message and in its reply; null when either is missing. */
  before: number | null;
  after: number | null;
  move_pct: number | null;
  /** Arguments sent in the same message: the price move belongs to all of them together. */
  in_message: number;
};

const fmtAsserted = (c: Claim) =>
  Object.entries(c.asserted)
    .map(([k, v]) => `${k.replace(/_/g, " ")} ${typeof v === "number" ? v.toLocaleString("en-GB") : v}`)
    .join(", ");

const priceOf = (terms: Record<string, unknown>) => (typeof terms.unit_price === "number" ? (terms.unit_price as number) : null);

export function argumentRows(): ArgumentRow[] {
  const rows: ArgumentRow[] = [];
  for (const run of runsData.runs) {
    const base = { session_id: run.session_id, case_id: run.case_id, version: versionOf(run), when: run.when };
    const steps = buildSteps(run);
    const answered = new Set<Claim>();
    for (const [i, step] of steps.entries()) {
      if (!step.verdicts.length) continue;
      const prev = steps.slice(0, i).findLast((s) => s.supplierId === step.supplierId);
      const before = prev ? priceOf(prev.offer.terms) : null;
      const after = priceOf(step.offer.terms);
      for (const v of step.verdicts) {
        answered.add(v.claim);
        rows.push({
          ...base,
          supplier: supplierName(run.case_id, step.supplierId),
          round: step.round,
          type: v.claim.type,
          refs: v.claim.refs,
          asserted: fmtAsserted(v.claim),
          verdict: v.result,
          before,
          after,
          move_pct: before && after ? (after / before - 1) * 100 : null,
          in_message: step.verdicts.length,
        });
      }
    }
    // Arguments in a message the supplier never answered (it walked away, or the case ended).
    for (const t of run.trace) {
      if (isSupplierMove(t)) continue;
      const m = t.move as BuyerMove;
      const claims = (m.interpreted?.claims ?? []).filter((c) => !answered.has(c));
      for (const c of claims) {
        rows.push({
          ...base,
          supplier: supplierName(run.case_id, m.supplier_id),
          round: t.round,
          type: c.type,
          refs: c.refs,
          asserted: fmtAsserted(c),
          verdict: "no reply",
          before: null,
          after: null,
          move_pct: null,
          in_message: claims.length,
        });
      }
    }
  }
  return rows;
}
