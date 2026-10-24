import raw from "@/data/demand.json";
import { data as inbox } from "./inbox";

export type Snapshot = {
  id: string;
  month: string;
  qty_next_12m: number;
  called_off_12m: number;
  /** Forecast vs what we called off in the 12 months to the snapshot: the figure an fc: claim states. */
  change_pct: number | null;
  citable: boolean;
  shared: boolean;
};

export type Quote = {
  id: string;
  supplier_id: string;
  supplier: string;
  country: string | null;
  date: string;
  unit_price: number;
  lead_time_days: number | null;
  incoterm: string | null;
  payment_days: number | null;
  validity_days: number | null;
  tooling_eur: number;
  awarded: boolean;
  missing_fields: string[];
  remarks: string | null;
};

export type Rfq = {
  id: string;
  date: string;
  qty_per_year: number;
  purpose: string;
  status: string;
  awarded_supplier_id: string | null;
  quotes: Quote[];
};

export type DemandPart = {
  id: string;
  description: string;
  category: string;
  uom: string;
  price_unit: number;
  abc_class: string | null;
  status: string;
  snapshots: Snapshot[];
  latest: Snapshot | null;
  forecast_lines: { month: string; qty: number }[];
  calloff_history: { month: string; qty: number }[];
  open_orders_qty: number;
  sources: {
    supplier_id: string;
    supplier: string;
    country: string | null;
    status: string;
    quota_pct: number;
    approved_since: string | null;
    tooling_owner: string | null;
  }[];
  rfqs: Rfq[];
};

type ByYear = Record<string, Record<string, number>>;

export const demandData = raw as unknown as {
  synced_at: string;
  data_version: string | null;
  as_of_month: string;
  parts: DemandPart[];
  spend: {
    years: string[];
    total_by_year: Record<string, number>;
    by_category: ByYear;
    by_country: ByYear;
    suppliers_with_spend: number;
    top10_share: number;
    detailed_share: number;
    top: { supplier_id: string; name: string; country: string | null; category: string | null; detailed: boolean; spend_eur: number; share: number }[];
  };
};

export const findDemand = (id: string) => demandData.parts.find((p) => p.id === id);

export type CoverageCell = { volume: number; months: number; covered: number; uncovered: number; uncoveredCost: number; premium: number };

export type CaseCoverage = {
  case_id: string;
  title: string;
  need: number;
  horizon: number;
  fallback: number;
  riskPct: number;
  current: number | null;
  volumes: number[];
  months: number[];
  fixedVolume: boolean;
  fixedMonths: boolean;
  cells: CoverageCell[];
};

/** Coverage per the brief (brief/api.md, "Cost and score"):
 * years = min(M/12, H) (a single order counts as 1), covered = min(V, N) × years,
 * uncovered need costs (N × H − covered) × fallback × (1 + fallback risk). */
export function coverage(need: number, horizon: number, volume: number, months: number, fallback: number, riskPct: number, current: number | null): CoverageCell {
  const years = months === 0 ? 1 : Math.min(months / 12, horizon);
  const covered = Math.min(volume, need) * years;
  const uncovered = Math.max(0, need * horizon - covered);
  const uncoveredCost = uncovered * fallback * (1 + riskPct / 100);
  return { volume, months, covered, uncovered, uncoveredCost, premium: current !== null ? uncoveredCost - uncovered * current : uncoveredCost };
}

/** The practice cases about this part, with the cost of every volume × contract-length option. */
export function caseCoverage(partId: string): CaseCoverage[] {
  return inbox.cases
    .filter((c) => c.parts.some((p) => p.id === partId))
    .flatMap((c) => {
      const b = c.buyer as {
        need_per_year?: number;
        horizon_years?: number;
        fallback_unit_price?: number | null;
        fallback_risk_pct?: number;
        current_unit_price?: number | null;
      };
      if (!b.need_per_year || !b.horizon_years || !b.fallback_unit_price) return [];
      const vOpts = (c.term_options.volume_per_year as number[] | undefined) ?? null;
      const mOpts = (c.term_options.contract_months as number[] | undefined) ?? null;
      const volumes = vOpts ?? [Number(c.fixed_terms.volume_per_year ?? b.need_per_year)];
      const months = mOpts ?? [Number(c.fixed_terms.contract_months ?? 12)];
      const cells = volumes.flatMap((v) =>
        months.map((m) => coverage(b.need_per_year!, b.horizon_years!, v, m, b.fallback_unit_price!, b.fallback_risk_pct ?? 0, b.current_unit_price ?? null)),
      );
      return [
        {
          case_id: c.case_id,
          title: c.title,
          need: b.need_per_year,
          horizon: b.horizon_years,
          fallback: b.fallback_unit_price,
          riskPct: b.fallback_risk_pct ?? 0,
          current: b.current_unit_price ?? null,
          volumes,
          months,
          fixedVolume: !vOpts,
          fixedMonths: !mOpts,
          cells,
        },
      ];
    });
}

export const PURPOSE_LABEL: Record<string, string> = {
  "periodic benchmark": "Periodic benchmark",
  "second-source benchmark": "Second-source benchmark",
  "new part, series HX": "New part (HX series)",
};
