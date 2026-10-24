import raw from "@/data/market.json";
import { data as inbox, type Claim } from "./inbox";
import { checkWindow } from "./indexRules";
import { buildSteps, isSupplierMove, runsData, supplierName, versionOf, type BuyerMove } from "./runs";

export type IndexSeries = {
  id: string;
  name: string;
  unit: string | null;
  source: string | null;
  frequency: string | null;
  licence: string | null;
  url: string | null;
  formula: string | null;
  first_month: string;
  last_month: string;
  family: string;
  values: [string, number][];
  drivers: { part_id: string; description: string | null; category: string | null; weight: number }[];
  clauses: {
    id: string;
    contract_id: string;
    supplier_id: string | null;
    supplier: string | null;
    material_share: number;
    deadband_pct: number;
    text: string;
  }[];
};

export const marketData = raw as unknown as {
  synced_at: string;
  data_version: string | null;
  data_month: string;
  series: IndexSeries[];
};

export const FAMILIES = [...new Set(marketData.series.map((s) => s.family))];

export const findSeries = (id: string) => marketData.series.find((s) => s.id === id);

/** "Producer prices DE: casting of iron" → "casting of iron" for compact labels. */
export const shortName = (s: Pick<IndexSeries, "name">) => s.name.replace(/^Producer prices DE: /, "").replace(/ \(.*$/, "");

export type MadeClaim = {
  who: "supplier" | "us";
  by: string;
  from: string;
  to: string;
  asserted: number | null;
  actual: number | null;
  /** The arena's verdict on our claims; for the supplier's, whether its figure holds (we check it). */
  result: string;
  runs: { session_id: string; case_id: string; version: string }[];
};

const seriesOf = (ref: string) => ref.slice(4).split("@")[0];
const monthOf = (ref: string) => ref.split("@")[1];

/** Every index claim made with this series in our runs, deduplicated across runs. */
export function claimsFor(seriesId: string): MadeClaim[] {
  const s = findSeries(seriesId);
  const out = new Map<string, MadeClaim>();
  const add = (c: Omit<MadeClaim, "runs">, run: MadeClaim["runs"][number]) => {
    const key = `${c.who}|${c.by}|${c.from}|${c.to}|${c.asserted}|${c.result}`;
    const hit = out.get(key);
    if (hit) hit.runs.push(run);
    else out.set(key, { ...c, runs: [run] });
  };
  const measured = (from: string, to: string) => (s ? checkWindow(s.values, from, to).change : null);
  const mine = (cl: Claim) => cl.type === "index_change" && cl.refs.length === 2 && cl.refs.every((r) => r.startsWith(`idx:${seriesId}@`));

  for (const run of runsData.runs) {
    const ref = { session_id: run.session_id, case_id: run.case_id, version: versionOf(run) };
    for (const t of run.trace) {
      if (!isSupplierMove(t)) continue;
      for (const cl of t.move.claims.filter(mine)) {
        const [from, to] = cl.refs.map(monthOf).sort();
        const asserted = typeof cl.asserted.change_pct === "number" ? cl.asserted.change_pct : null;
        const actual = measured(from, to);
        add(
          {
            who: "supplier",
            by: supplierName(run.case_id, t.actor),
            from,
            to,
            asserted,
            actual,
            result: asserted === null || actual === null ? "unchecked" : Math.abs(asserted - actual) <= 0.5 ? "holds" : "off",
          },
          ref,
        );
      }
    }
    for (const step of buildSteps(run)) {
      for (const v of step.verdicts.filter((x) => mine(x.claim))) {
        const [from, to] = v.claim.refs.map(monthOf).sort();
        add(
          {
            who: "us",
            by: `to ${supplierName(run.case_id, step.supplierId)}`,
            from,
            to,
            asserted: typeof v.claim.asserted.change_pct === "number" ? v.claim.asserted.change_pct : null,
            actual: measured(from, to),
            result: v.result,
          },
          ref,
        );
      }
    }
    // Claims in a message the supplier never answered have no verdict; keep them visible.
    const answered = new Set(buildSteps(run).flatMap((st) => st.verdicts.map((v) => v.claim)));
    for (const t of run.trace) {
      if (isSupplierMove(t)) continue;
      const m = t.move as BuyerMove;
      for (const cl of (m.interpreted?.claims ?? []).filter(mine)) {
        if (answered.has(cl)) continue;
        const [from, to] = cl.refs.map(monthOf).sort();
        add(
          {
            who: "us",
            by: `to ${supplierName(run.case_id, m.supplier_id)}`,
            from,
            to,
            asserted: typeof cl.asserted.change_pct === "number" ? cl.asserted.change_pct : null,
            actual: measured(from, to),
            result: "no reply",
          },
          ref,
        );
      }
    }
  }
  return [...out.values()].sort((a, b) => (a.who === b.who ? b.to.localeCompare(a.to) : a.who === "us" ? -1 : 1));
}

/** Number of claim rows per series, for the overview. */
export function claimCounts() {
  const counts: Record<string, number> = {};
  for (const run of runsData.runs) {
    for (const t of run.trace) {
      const claims = isSupplierMove(t) ? t.move.claims : ((t.move as BuyerMove).interpreted?.claims ?? []);
      for (const cl of claims) {
        if (cl.type !== "index_change" || !cl.refs[0]?.startsWith("idx:")) continue;
        const id = seriesOf(cl.refs[0]);
        counts[id] = (counts[id] ?? 0) + 1;
      }
    }
  }
  return counts;
}

/** Practice cases that offer an index clause on this series, with the expected move. */
export function clauseCases(seriesId: string) {
  return inbox.cases.flatMap((c) => {
    const path = (c.buyer as { index_paths?: Record<string, number> }).index_paths?.[seriesId];
    const options = ((c.term_options.index_clause ?? []) as ({ series: string; material_share: number; deadband_pct: number } | null)[]).filter(
      (o): o is { series: string; material_share: number; deadband_pct: number } => !!o && o.series === seriesId,
    );
    if (path === undefined && !options.length) return [];
    return [
      {
        case_id: c.case_id,
        title: c.title,
        path: path ?? null,
        risk_pct: (c.buyer as { index_risk_pct?: number }).index_risk_pct ?? null,
        options,
      },
    ];
  });
}

/** Cost of an index clause as a share of the indexed spend, by the brief's formula:
 * share · max(0, |path| − deadband) · sign(path) + share · risk. */
export function clauseCostPct(o: { material_share: number; deadband_pct: number }, path: number, riskPct: number) {
  const move = Math.max(0, Math.abs(path) - o.deadband_pct / 100) * Math.sign(path);
  return (o.material_share * move + (o.material_share * riskPct) / 100) * 100;
}
