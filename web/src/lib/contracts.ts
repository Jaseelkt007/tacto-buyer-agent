import raw from "@/data/contracts.json";

type Buckets<K extends string> = Record<K, number>;

export type Clause = {
  id: string;
  clause: string;
  type: string;
  text: string;
  series: string | null;
  material_share: number | null;
  deadband_pct: number | null;
  days: number | null;
};

export type Delivery = {
  receipts_12m: number;
  otd_requested_12m: number | null;
  otd_confirmed_12m: number | null;
  median_days_late_when_late: number | null;
  buckets_12m: Buckets<"early" | "on_time" | "late_3_7" | "late_8_14" | "late_15_30" | "late_31_plus">;
  monthly: { month: string; lines: number; otd_pct: number }[];
  po_lines: number;
  rush_orders: number;
  changed_orders: number;
  open_orders: number;
  stale_price_lines: number;
};

export type Quality = {
  qns: number;
  supplier_caused: number;
  complaint_qty: number;
  returned_qty: number;
  recharged_eur: number;
  per_year: Record<string, { qns: number; supplier_caused: number; complaint_qty: number; recharged_eur: number }>;
  defects: { defect: string; qty: number }[];
  median_8d_days: number | null;
  late_8d: number;
  open_8d: number;
  overdue_8d: number;
  recent: {
    id: string;
    date: string;
    part_id: string;
    part: string | null;
    defect: string;
    complaint_qty: number;
    supplier_caused: boolean;
    recharged_eur: number;
    d8_days: number | null;
  }[];
};

export type Payment = {
  invoices: number;
  terms_days: number | null;
  paid_12m: number;
  late_share_12m: number | null;
  avg_days_late_12m: number | null;
  max_days_late_12m: number | null;
  buckets_12m: Buckets<"on_time" | "late_1_7" | "late_8_14" | "late_15_30" | "late_31_plus">;
  per_year: Record<string, { invoices: number; amount_eur: number; avg_days_late: number; late_share: number }>;
  unpaid: number;
  overdue_now: number;
  skonto: { pct: number; days: number | null } | null;
  discounts_taken: number;
  discounts_taken_late: number;
  late_discount_eur: number;
};

export type Contract = {
  id: string;
  supplier_id: string;
  supplier: string;
  country: string | null;
  category: string | null;
  type: string;
  valid_from: string;
  valid_to: string;
  payment_days: number | null;
  incoterm: string | null;
  price_basis: string | null;
  price_notice_days: number | null;
  term_notice_days: number | null;
  price_change_deadline: string | null;
  termination_deadline: string | null;
  clauses: Clause[];
  parts: { id: string; description: string | null }[];
  scorecard: { id: string; quarter: string; otd_pct: number; ppm: number; score: number; class: string; colour: string } | null;
  delivery: Delivery;
  quality: Quality;
  payment: Payment;
};

export const contractData = raw as unknown as {
  synced_at: string;
  data_version: string | null;
  as_of: string;
  year_start: string;
  contracts: Contract[];
};

export const findContract = (num: string) => contractData.contracts.find((c) => c.id === `ctr:${num}`);

/** Days from the data date (2026-09-30) to a date; negative = already passed. */
export function daysFromAsOf(date: string) {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${contractData.as_of}T00:00:00Z`)) / 86400000);
}

export const OTD_TARGET = 95; // company quality agreement

/** The fiscal year (October to September) that ends on the data date: the "last 12 months". */
export const LAST_FY = (() => {
  const [y, m] = contractData.as_of.split("-").map(Number);
  return `FY${m >= 10 ? y + 1 : y}`;
})();

export const CLAUSE_LABEL: Record<string, string> = {
  scope: "Scope",
  price: "Price",
  index: "Index clause",
  payment: "Payment",
  delivery: "Delivery",
  quality: "Quality",
  term: "Term and notice",
};

export const DELIVERY_BUCKETS: [keyof Delivery["buckets_12m"], string][] = [
  ["early", "> 5 days early"],
  ["on_time", "on time (−5 to +2 days)"],
  ["late_3_7", "3–7 days late"],
  ["late_8_14", "8–14 days late"],
  ["late_15_30", "15–30 days late"],
  ["late_31_plus", "> 30 days late"],
];

export const PAYMENT_BUCKETS: [keyof Payment["buckets_12m"], string][] = [
  ["on_time", "on or before due date"],
  ["late_1_7", "1–7 days late"],
  ["late_8_14", "8–14 days late"],
  ["late_15_30", "15–30 days late"],
  ["late_31_plus", "> 30 days late"],
];
