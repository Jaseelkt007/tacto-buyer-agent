import raw from "@/data/parts.json";
import { data as inbox } from "./inbox";
import { runsData, versionOf } from "./runs";

export type ShouldCost = {
  id: string;
  part_id: string;
  estimate_date: string;
  cost_base: string;
  supplier_id: string | null;
  unit_cost: number;
  price_unit: number;
  material_eur: number;
  conversion_eur: number;
  overhead_eur: number;
  confidence_pct: number;
  method: string;
};

export type PartSupplier = {
  supplier_id: string;
  name: string;
  country: string | null;
  status: string | null;
  quota_pct: number | null;
  tooling_owner: string | null;
  current_price: number | null;
  current_since: string | null;
  current_basis: string | null;
  /** The full cost our agent assumes for this supplier (dossier.py). */
  full_cost: { unit_cost: number; source: string; how: string } | null;
  margin_pct: number | null;
  /** Whether the agent would argue should-cost (it does below 98 % of the price). */
  should_cost_claim: boolean;
};

export type Condition = {
  part_id: string;
  supplier_id: string;
  valid_from: string;
  valid_to: string | null;
  price: number;
  basis: "contract" | "renewal" | "index_adjustment" | string;
  event_id: string | null;
  price_unit: number;
  currency: string;
  event: { event_id: string; date: string; type: string; asked_pct: number | null; settled_pct: number | null; note: string | null } | null;
};

type IndexPoint = { id: string; month: string; value: number };
type Window = { from: string; to: string; pct: number };

export type Driver = {
  series_id: string;
  name: string;
  weight: number;
  source: string;
  last: IndexPoint | null;
  change_12m: Window | null;
  /** The largest fall over ≤ 12 months to the latest month, when ≥ 0.5 %: the agent's index claim. */
  best_fall: Window | null;
  contribution_pp: number | null;
};

export type Part = {
  id: string;
  description: string;
  category: string;
  material_group: string | null;
  grade: string | null;
  net_weight_kg: number | null;
  uom: string;
  price_unit: number;
  planned_lead_time_days: number | null;
  pump_series: string | null;
  standard_price: number | null;
  status: string;
  abc_class: string | null;
  suppliers: PartSupplier[];
  should_cost: ShouldCost[];
  conditions: Condition[];
  drivers: Driver[];
  index_share: number;
  implied_change_12m_pct: number | null;
  po: Record<string, { qty: number; spend_eur: number; lines: number; stale_lines: number }>;
  letters: {
    id: string;
    date: string;
    kind: string;
    supplier_id: string;
    subject: string;
    author: string | null;
    asked_pct: number | null;
    asked_price: number | null;
    effective_date: string | null;
    notice_days: number | null;
  }[];
};

export type Series = { id: string; name: string; unit: string | null; source: string | null; values: [string, number][] };

export const partData = raw as unknown as {
  synced_at: string;
  data_version: string | null;
  data_month: string;
  parts: Part[];
  series: Record<string, Series>;
};

export const findPart = (id: string) => partData.parts.find((p) => p.id === id);

export const PO_YEARS = [...new Set(partData.parts.flatMap((p) => Object.keys(p.po)))].sort();
export const LATEST_PO_FY = PO_YEARS.at(-1) ?? "FY2026";

/** "per piece", "per 100 pc", "per kg". */
export function perUnit(p: Pick<Part, "uom" | "price_unit">) {
  return p.price_unit === 1 ? `per ${p.uom}` : `per ${p.price_unit.toLocaleString("en-GB")} ${p.uom}`;
}

/** The price increase the latest letter asks for, if any. */
export const latestAsk = (p: Part) => p.letters.find((l) => l.asked_pct !== null) ?? null;

/** Cases about this part, and the runs we played on them. */
export function partAppearances(id: string) {
  return inbox.cases
    .filter((c) => c.parts.some((x) => x.id === id))
    .map((c) => {
      const runs = runsData.runs.filter((r) => r.case_id === c.case_id);
      const last = runs.at(-1);
      return {
        case_id: c.case_id,
        title: c.title,
        latest: last ? { session_id: last.session_id, version: versionOf(last), score: last.result.score ?? 0 } : null,
      };
    });
}

export const BASIS_LABEL: Record<string, string> = {
  contract: "New contract",
  renewal: "Annual renewal",
  index_adjustment: "Index clause adjustment",
};
