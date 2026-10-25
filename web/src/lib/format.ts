const eur = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", minimumFractionDigits: 2 });
const num = new Intl.NumberFormat("en-GB");

export const TERM_LABELS: Record<string, string> = {
  unit_price: "Unit price",
  payment_days: "Payment terms",
  lead_time_days: "Lead time",
  volume_per_year: "Volume / year",
  contract_months: "Contract length",
  effective_date: "Effective from",
  index_clause: "Index clause",
  incoterm: "Incoterm",
  tooling_eur: "Tooling",
  ppm_commitment: "Defect commitment",
  chargeback_eur_per_complaint: "Chargeback / complaint",
};

export function termLabel(field: string) {
  return TERM_LABELS[field] ?? field.replace(/_/g, " ");
}

type IndexClause = { series: string; material_share: number; deadband_pct: number; base_month: string };

export function termValue(field: string, v: unknown): string {
  if (field === "index_clause") {
    if (!v) return "none";
    const c = v as IndexClause;
    return `${c.series} · ${Math.round(c.material_share * 100)} % material · ±${c.deadband_pct} % deadband · base ${c.base_month}`;
  }
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v !== "number") return String(v);
  if (field === "unit_price") return eur.format(v);
  if (field === "tooling_eur" || field.endsWith("_eur") || field.includes("_eur_")) return eur.format(v);
  if (field.endsWith("_days")) return `${v} days`;
  if (field === "contract_months") return `${v} months`;
  if (field === "ppm_commitment") return `${num.format(v)} ppm`;
  if (field === "volume_per_year") return `${num.format(v)} pc`;
  return num.format(v);
}

export const money = (v: number | null | undefined) => (v === null || v === undefined ? "—" : eur.format(v));
export const count = (v: number | null | undefined) => (v === null || v === undefined ? "—" : num.format(v));

export function listDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

export function fullDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

export function monthGroup(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function initials(name: string) {
  const words = name
    .replace(/[,.&]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !/^(GmbH|AG|KG|Co|s\.r\.o|Sp|z|o|und|der|die|des|&)$/i.test(w));
  return ((words[0]?.[0] ?? "?") + (words[1]?.[0] ?? "")).toUpperCase();
}

export function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const GOALS: Record<string, string> = {
  leverage: "Leverage",
  stabilise: "Stabilise",
  secure_supply: "Secure supply",
  quality_first: "Quality first",
  routine: "Routine",
};

export const KIND_LABEL: Record<string, string> = {
  quote: "Opening quote",
  letter: "Letter",
  email: "E-mail",
  memo: "Internal memo",
  rfq: "Request for quotation",
  case: "Case file",
};
