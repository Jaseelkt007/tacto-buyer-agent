// The cost of a deal, term by term, as the kit computes it (starter-kit/arena_kit/cost.py,
// cost_breakdown; formula in brief/api.md "Cost and score"). Each term carries its inputs, so the page
// can show the arithmetic. The supplier-health term needs the supplier's own cost and cash rates,
// which the arena keeps; we take its figure from the run and only invert it.

import type { CaseFile, Terms } from "./inbox";

type Buyer = {
  need_per_year: number;
  horizon_years: number;
  current_unit_price?: number | null;
  fallback_unit_price: number;
  fallback_risk_pct?: number;
  interest_rate: number;
  reference_payment_days: number;
  need_lead_time_days: number;
  late_cost_per_day?: number;
  cost_per_defect?: number;
  freight_eur_per_unit: Record<string, number>;
  index_paths?: Record<string, number>;
  index_risk_pct?: number;
  category_goal?: string;
  sustainable_margin_pct?: number;
  relationship_eur_per_point?: number;
};

type Clause = { series: string; material_share: number; deadband_pct: number };

export type TermKey =
  | "price"
  | "uncovered_need"
  | "fallback_risk"
  | "payment_terms"
  | "freight"
  | "late_delivery"
  | "quality"
  | "tooling"
  | "index_clause"
  | "index_risk"
  | "relationship";

export type Origin = "negotiated" | "fixed" | "standard";

export type Anatomy = {
  years: number;
  committed: number;
  covered: number;
  pre: number;
  spend: number;
  atNewPrice: number;
  terms: Record<TermKey, number>;
  /** Where each closing term came from: our sheet, the case, or the supplier's standard terms. */
  origin: Record<string, Origin>;
  closing: Terms;
};

const DAY = 86400000;

function horizonStart(c: CaseFile): string | null {
  const fixed = c.fixed_terms.effective_date as string | undefined;
  const opts = ((c.term_options.effective_date ?? []) as (string | null)[]).filter((x): x is string => !!x);
  return fixed ?? (opts.length ? [...opts].sort()[0] : null);
}

export function anatomy(c: CaseFile, closing: Terms, relationship: number): Anatomy {
  const b = c.buyer as unknown as Buyer;
  const t = closing as Record<string, unknown>;
  const num = (k: string) => (typeof t[k] === "number" ? (t[k] as number) : 0);
  const months = num("contract_months");
  const years = Math.min(months ? months / 12 : 1, b.horizon_years);
  const volume = num("volume_per_year");
  const committed = volume * years;
  const covered = Math.min(volume, b.need_per_year) * years;
  const start = horizonStart(c);
  const eff = t.effective_date as string | undefined;
  const lag = start && eff ? (Date.parse(eff) - Date.parse(start)) / DAY / 365 : 0;
  const pre = start && eff ? volume * Math.min(Math.max(lag, 0), years) : 0;
  const price = num("unit_price");
  const atNewPrice = (committed - pre) * price;
  const spend = pre * (b.current_unit_price ?? price) + atNewPrice;
  const perDefect = b.cost_per_defect ?? 0;
  const defectCost = perDefect - Math.min(num("chargeback_eur_per_complaint"), perDefect);
  let index = 0;
  let indexRisk = 0;
  const clause = t.index_clause as Clause | null | undefined;
  if (clause) {
    const path = b.index_paths?.[clause.series] ?? 0;
    const moved = Math.max(0, Math.abs(path) - clause.deadband_pct / 100);
    index = atNewPrice * clause.material_share * moved * Math.sign(path);
    indexRisk = (atNewPrice * clause.material_share * (b.index_risk_pct ?? 0)) / 100;
  }
  const uncovered = (b.need_per_year * b.horizon_years - covered) * b.fallback_unit_price;
  const origin: Record<string, Origin> = {};
  for (const k of Object.keys(closing)) {
    origin[k] = k in c.fixed_terms ? "fixed" : c.negotiable.includes(k) ? "negotiated" : "standard";
  }
  return {
    years,
    committed,
    covered,
    pre,
    spend,
    atNewPrice,
    origin,
    closing,
    terms: {
      price: spend,
      uncovered_need: uncovered,
      fallback_risk: (uncovered * (b.fallback_risk_pct ?? 0)) / 100,
      payment_terms: (spend * b.interest_rate * (b.reference_payment_days - num("payment_days"))) / 360,
      freight: committed * (b.freight_eur_per_unit[String(t.incoterm)] ?? 0),
      late_delivery: (b.late_cost_per_day ?? 0) * Math.max(0, num("lead_time_days") - b.need_lead_time_days),
      quality: ((committed * num("ppm_commitment")) / 1e6) * defectCost,
      tooling: num("tooling_eur"),
      index_clause: index,
      index_risk: indexRisk,
      relationship,
    },
  };
}

/** Total cost with one closing term changed, supplier-health charge held: what each lever is worth. */
export function withTerm(c: CaseFile, closing: Terms, field: string, value: unknown, relationship: number) {
  const a = anatomy(c, { ...closing, [field]: value as Terms[string] }, relationship);
  return Object.values(a.terms).reduce((s, v) => s + v, 0);
}

/** Margin points below the sustainable margin that a supplier-health charge implies: the inverse of
 * soft(g) = g²/10 (g ≤ 5), g − 2.5 (g > 5), per year covered. */
export function impliedMarginGap(charge: number, perPoint: number, years: number) {
  if (!charge || !perPoint || !years) return 0;
  const s = charge / (perPoint * years);
  return s <= 2.5 ? Math.sqrt(10 * s) : s + 2.5;
}

export const TERM_INFO: Record<TermKey, { label: string; formula: string; lever: string | null }> = {
  price: {
    label: "Price",
    formula: "units before the new price × current price + (committed − those units) × unit price",
    lever: "unit_price",
  },
  uncovered_need: {
    label: "Uncovered need",
    formula: "(need × horizon − covered) × fallback price; covered = min(volume, need) × years",
    lever: "volume_per_year",
  },
  fallback_risk: { label: "Fallback risk", formula: "uncovered need × fallback risk %", lever: "contract_months" },
  payment_terms: {
    label: "Payment terms",
    formula: "spend × our interest rate × (reference payment days − payment days) ÷ 360",
    lever: "payment_days",
  },
  freight: { label: "Freight", formula: "committed units × freight per unit for the Incoterm", lever: "incoterm" },
  late_delivery: { label: "Late delivery", formula: "late cost per day × max(0, lead time − lead time we need)", lever: "lead_time_days" },
  quality: {
    label: "Quality",
    formula: "committed × ppm ÷ 1,000,000 × (cost per defect − chargeback)",
    lever: "ppm_commitment",
  },
  tooling: { label: "Tooling", formula: "tooling paid once", lever: "tooling_eur" },
  index_clause: {
    label: "Index clause",
    formula: "spend at the new price × material share × max(0, |expected move| − deadband) × sign",
    lever: "index_clause",
  },
  index_risk: { label: "Index risk", formula: "spend at the new price × material share × index risk %", lever: "index_clause" },
  relationship: {
    label: "Supplier health",
    formula: "€ per margin point × soft(sustainable margin − supplier margin) × years (stabilise and secure-supply only)",
    lever: null,
  },
};
