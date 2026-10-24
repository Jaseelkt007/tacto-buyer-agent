import raw from "@/data/suppliers.json";
import { data as inbox } from "./inbox";
import { runsData, versionOf } from "./runs";

export type Supplier = {
  id: string;
  name: string;
  country: string;
  currency: string;
  payment_days: number | null;
  skonto_days: number | null;
  skonto_pct: number | null;
  incoterm: string | null;
  created: string | null;
  category: string;
  detail: "full" | "spend only";
  blocked: boolean;
  contract_id: string | null;
  standard_lead_time_days: number | null;
  abc_class: string | null;
  spend: Record<string, { spend_eur: number; invoice_count: number }>;
};

export type Intel = {
  supplier_id: string;
  legal_form: string | null;
  founded: number | null;
  owner_type: string | null;
  group_parent: string | null;
  staff: number | null;
  filed_fy: number | null;
  turnover_eur: number | null;
  turnover_band: string | null;
  equity_ratio_pct: number | null;
  credit_index: number | null;
  credit_index_12m_ago: number | null;
  vda63_grade: string | null;
  certifications: string | null;
};

export type Contract = {
  id: string;
  type: string;
  valid_from: string;
  valid_to: string;
  payment_days: number | null;
  incoterm: string | null;
  notice_days: number | null;
  price_basis: string | null;
  file: string | null;
};

export type Scorecard = {
  id: string;
  quarter: string;
  period_start: string;
  period_end: string;
  gr_lines: number;
  otd_pct: number;
  otd_confirmed_pct: number;
  received_qty: number;
  complaint_qty: number;
  ppm: number;
  qn_count: number;
  open_8d_overdue: number;
  score: number;
  class: string;
  colour: "green" | "amber" | "red" | string;
};

export type News = { id: string; date: string; topic: string; headline: string; body: string | null; source: string | null };

export type Doc = {
  id: string;
  date: string;
  kind: string;
  subject: string;
  author: string | null;
  part_ids: string[];
  asked_pct: number | null;
  asked_price: number | null;
  effective_date: string | null;
  notice_days: number | null;
  body: string;
};

export type Evidence = { id: string; matches: string[] };

export type Detail = {
  intel: Intel | null;
  contract: Contract | null;
  sourcing: {
    part_id: string;
    status: string;
    quota_pct: number | null;
    approved_since: string | null;
    tooling_owner: string | null;
    description: string | null;
    category: string | null;
    abc_class: string | null;
  }[];
  scorecards: Scorecard[];
  news: News[];
  documents: Doc[];
  signals: {
    owner_rate: number;
    cash_premium: number;
    interest_rate: number;
    evidence: { cash: Evidence[]; work: Evidence[]; full: Evidence[] };
  };
};

export const supplierData = raw as unknown as {
  synced_at: string;
  data_version: string | null;
  suppliers: Supplier[];
  details: Record<string, Detail>;
};

export const FISCAL_YEARS = [...new Set(supplierData.suppliers.flatMap((s) => Object.keys(s.spend)))].sort();
export const LATEST_FY = FISCAL_YEARS.at(-1) ?? "FY2026";

export const findSupplier = (id: string) => supplierData.suppliers.find((s) => s.id === id);

/** Practice / sandbox cases this supplier takes part in, and the runs we played on them. */
export function appearances(id: string) {
  const cases = inbox.cases.filter((c) => c.suppliers.some((s) => s.id === id));
  return cases.map((c) => ({
    case_id: c.case_id,
    title: c.title,
    runs: runsData.runs
      .filter((r) => r.case_id === c.case_id)
      .map((r) => ({ session_id: r.session_id, version: versionOf(r), score: r.result.score ?? 0, deal: !!r.result.deal })),
  }));
}

export const OWNER_LABEL: Record<string, string> = {
  family: "Family-owned",
  founder: "Founder-led",
  group: "Part of a group",
  private: "Privately held",
};

export const DOC_KIND: Record<string, string> = {
  email: "E-mail",
  meeting_note: "Meeting note",
  call_note: "Call note",
  letter: "Letter",
  memo: "Internal memo",
  rfq: "RFQ",
};

export const SIGNAL_LABEL: Record<"cash" | "work" | "full", { title: string; meaning: string }> = {
  cash: {
    title: "Needs cash",
    meaning: "Asks for faster payment or mentions liquidity. The agent values money at +5 points for it and can offer shorter payment terms in exchange for price.",
  },
  work: {
    title: "Looks for work",
    meaning: "Mentions free capacity, weak order intake or new customers. Volume and contract length are worth more to it.",
  },
  full: {
    title: "Capacity full",
    meaning: "Mentions full order books or capacity limits. It has less reason to cut price for volume.",
  },
};
