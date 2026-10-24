// Snapshot contracts and how each supplier relationship performs, for the Contracts section.
//
//   cd web && npm run sync:contracts
//
// Reads ../data and writes src/data/contracts.json: the 46 framework contracts with their clauses and
// deadlines, and per contract supplier its delivery record (PO line dates vs goods receipts), quality
// record (quality notifications, 8D reports) and our payment record (invoices: do we pay on time?).
// Also src/data/qn-links.json (which contract a qn: ID belongs to). No arena calls.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA, WEB, rows } from "./lib/package.mjs";

const AS_OF = "2026-09-30"; // the package's data date
const YEAR_START = "2025-10-01"; // last 12 months = FY2026
const EARLY = 5; // SCORECARD.md: on time = posted between 5 days before and 2 days after the date
const LATE = 2;
const EIGHT_D_DAYS = 60; // quality agreement: 8D report within 60 days

const [contracts, clauses, suppliers, parts, poLines, receipts, qns, invoices, scorecards] = await Promise.all(
  ["contracts", "contract_clauses", "suppliers", "parts", "po_lines", "goods_receipts", "quality_notifications", "invoices", "scorecards"].map(rows),
);
const version = JSON.parse(await readFile(path.join(DATA, "datapackage.json"), "utf8")).version ?? null;

const day = (s) => Date.parse(`${s}T00:00:00Z`) / 86400000;
const days = (a, b) => Math.round(day(b) - day(a));
const addDays = (s, n) => new Date((day(s) + n) * 86400000).toISOString().slice(0, 10);
const fiscalYear = (s) => {
  const [y, m] = s.split("-").map(Number);
  return `FY${m >= 10 ? y + 1 : y}`;
};
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const round = (v, d = 1) => (v === null ? null : Math.round(v * 10 ** d) / 10 ** d);
const by = (list, key) => {
  const m = new Map();
  for (const r of list) m.set(r[key], [...(m.get(r[key]) ?? []), r]);
  return m;
};

const supplierBy = new Map(suppliers.map((s) => [s.id, s]));
const partBy = new Map(parts.map((p) => [p.id, p]));
const poBy = new Map(poLines.map((p) => [p.id, p]));
const clausesBy = by(clauses, "contract_id");
const poBySup = by(poLines, "supplier_id");
const grBySup = by(receipts, "supplier_id");
const qnBySup = by(qns, "supplier_id");
const invBySup = by(invoices, "supplier_id");
const scBySup = by(scorecards, "supplier_id");

/** Receipt timing against the PO line's requested and first confirmed dates. */
function deliveries(supId) {
  const lines = (grBySup.get(supId) ?? []).map((g) => {
    const po = poBy.get(g.po_line_id);
    return {
      month: g.posting_date.slice(0, 7),
      posted: g.posting_date,
      vsRequested: po ? days(po.requested_date, g.posting_date) : null,
      vsConfirmed: po?.first_confirmed_date ? days(po.first_confirmed_date, g.posting_date) : null,
    };
  });
  const onTime = (d) => d !== null && d >= -EARLY && d <= LATE;
  const year = lines.filter((l) => l.posted >= YEAR_START);
  const bucket = (d) => (d < -EARLY ? "early" : d <= LATE ? "on_time" : d <= 7 ? "late_3_7" : d <= 14 ? "late_8_14" : d <= 30 ? "late_15_30" : "late_31_plus");
  const buckets = { early: 0, on_time: 0, late_3_7: 0, late_8_14: 0, late_15_30: 0, late_31_plus: 0 };
  for (const l of year) if (l.vsRequested !== null) buckets[bucket(l.vsRequested)]++;
  const months = {};
  for (const l of lines) {
    const m = (months[l.month] ??= { lines: 0, on_time: 0 });
    m.lines++;
    if (onTime(l.vsRequested)) m.on_time++;
  }
  const lateDays = year.map((l) => l.vsRequested).filter((d) => d !== null && d > LATE);
  const pos = poBySup.get(supId) ?? [];
  return {
    receipts_12m: year.length,
    otd_requested_12m: year.length ? round((year.filter((l) => onTime(l.vsRequested)).length / year.length) * 100) : null,
    otd_confirmed_12m: year.length ? round((year.filter((l) => onTime(l.vsConfirmed)).length / year.length) * 100) : null,
    median_days_late_when_late: median(lateDays),
    buckets_12m: buckets,
    monthly: Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, m]) => ({ month, lines: m.lines, otd_pct: round((m.on_time / m.lines) * 100) })),
    po_lines: pos.length,
    rush_orders: pos.filter((p) => p.change_type === "rush").length,
    changed_orders: pos.filter((p) => p.change_type === "change").length,
    open_orders: pos.filter((p) => p.requested_date > AS_OF).length,
    stale_price_lines: pos.filter((p) => p.price_note === "stale_condition").length,
  };
}

function quality(supId) {
  const list = (qnBySup.get(supId) ?? []).sort((a, b) => b.qn_date.localeCompare(a.qn_date));
  const caused = list.filter((q) => q.supplier_caused === "true");
  const defects = {};
  for (const q of caused) defects[q.defect] = (defects[q.defect] ?? 0) + Number(q.complaint_qty);
  const eightD = caused.filter((q) => q.d8_date).map((q) => days(q.qn_date, q.d8_date));
  const open = caused.filter((q) => !q.d8_date);
  const perYear = {};
  for (const q of list) {
    const y = (perYear[fiscalYear(q.qn_date)] ??= { qns: 0, supplier_caused: 0, complaint_qty: 0, recharged_eur: 0 });
    y.qns++;
    if (q.supplier_caused === "true") {
      y.supplier_caused++;
      y.complaint_qty += Number(q.complaint_qty);
      y.recharged_eur += Number(q.cost_recharged_eur || 0);
    }
  }
  return {
    qns: list.length,
    supplier_caused: caused.length,
    complaint_qty: caused.reduce((s, q) => s + Number(q.complaint_qty), 0),
    returned_qty: list.reduce((s, q) => s + Number(q.returned_qty || 0), 0),
    recharged_eur: caused.reduce((s, q) => s + Number(q.cost_recharged_eur || 0), 0),
    per_year: perYear,
    defects: Object.entries(defects)
      .map(([defect, qty]) => ({ defect, qty }))
      .sort((a, b) => b.qty - a.qty),
    median_8d_days: median(eightD),
    late_8d: eightD.filter((d) => d > EIGHT_D_DAYS).length,
    open_8d: open.length,
    overdue_8d: open.filter((q) => days(q.qn_date, AS_OF) > EIGHT_D_DAYS).length,
    recent: list.slice(0, 12).map((q) => ({
      id: q.id,
      date: q.qn_date,
      part_id: q.part_id,
      part: partBy.get(q.part_id)?.description ?? null,
      defect: q.defect,
      complaint_qty: Number(q.complaint_qty),
      supplier_caused: q.supplier_caused === "true",
      recharged_eur: Number(q.cost_recharged_eur || 0),
      d8_days: q.d8_date ? days(q.qn_date, q.d8_date) : null,
    })),
  };
}

/** Our side: do we pay this supplier on time, and do we take cash discounts we are not owed? */
function payments(supId) {
  const s = supplierBy.get(supId);
  const list = invBySup.get(supId) ?? [];
  const paid = list.filter((i) => i.paid_date);
  const late = (i) => days(i.due_date, i.paid_date);
  const year = paid.filter((i) => i.paid_date >= YEAR_START);
  const bucket = (d) => (d <= 0 ? "on_time" : d <= 7 ? "late_1_7" : d <= 14 ? "late_8_14" : d <= 30 ? "late_15_30" : "late_31_plus");
  const buckets = { on_time: 0, late_1_7: 0, late_8_14: 0, late_15_30: 0, late_31_plus: 0 };
  for (const i of year) buckets[bucket(late(i))]++;
  const unpaid = list.filter((i) => !i.paid_date);
  const skontoDays = s?.skonto_days ? Number(s.skonto_days) : null;
  const discounts = paid.filter((i) => i.discount_taken === "true");
  const lateDiscounts = skontoDays === null ? discounts : discounts.filter((i) => days(i.invoice_date, i.paid_date) > skontoDays);
  const perYear = {};
  for (const i of paid) {
    const y = (perYear[fiscalYear(i.paid_date)] ??= { invoices: 0, amount_eur: 0, days_late_sum: 0, late: 0 });
    y.invoices++;
    y.amount_eur += Number(i.amount_eur);
    y.days_late_sum += late(i);
    if (late(i) > 0) y.late++;
  }
  return {
    invoices: list.length,
    terms_days: median(list.map((i) => days(i.invoice_date, i.due_date))),
    paid_12m: year.length,
    late_share_12m: year.length ? round((year.filter((i) => late(i) > 0).length / year.length) * 100) : null,
    avg_days_late_12m: year.length ? round(year.reduce((s, i) => s + late(i), 0) / year.length) : null,
    max_days_late_12m: year.length ? Math.max(...year.map(late)) : null,
    buckets_12m: buckets,
    per_year: Object.fromEntries(
      Object.entries(perYear).map(([y, v]) => [
        y,
        { invoices: v.invoices, amount_eur: round(v.amount_eur, 2), avg_days_late: round(v.days_late_sum / v.invoices), late_share: round((v.late / v.invoices) * 100) },
      ]),
    ),
    unpaid: unpaid.length,
    overdue_now: unpaid.filter((i) => i.due_date < AS_OF).length,
    skonto: s?.skonto_pct ? { pct: Number(s.skonto_pct), days: skontoDays } : null,
    discounts_taken: discounts.length,
    discounts_taken_late: lateDiscounts.length,
    late_discount_eur: round(lateDiscounts.reduce((s, i) => s + Number(i.amount_eur) - Number(i.paid_amount_eur), 0), 2),
  };
}

const qnLinks = {};
const out = [];
for (const c of contracts) {
  const sup = supplierBy.get(c.supplier_id);
  const cl = (clausesBy.get(c.id) ?? []).sort((a, b) => Number(a.clause) - Number(b.clause));
  const priceNotice = Number(cl.find((x) => x.type === "price")?.days || c.notice_days || 0) || null;
  const term = cl.find((x) => x.type === "term");
  const termNotice = Number(term?.text.match(/(\d+) days' notice/)?.[1] ?? c.notice_days) || null;
  const md = await readFile(path.join(DATA, c.file), "utf8").catch(() => "");
  const partIds = md.match(/^Parts: (.*)$/m)?.[1].split(/[,\s]+/).filter((x) => x.startsWith("part:")) ?? [];
  for (const q of qnBySup.get(c.supplier_id) ?? []) qnLinks[q.id] = c.id.replace("ctr:", "");
  const sc = (scBySup.get(c.supplier_id) ?? []).sort((a, b) => a.quarter.localeCompare(b.quarter)).at(-1);

  out.push({
    id: c.id,
    supplier_id: c.supplier_id,
    supplier: sup?.name ?? c.supplier_id,
    country: sup?.country ?? null,
    category: sup?.category ?? null,
    type: c.type,
    valid_from: c.valid_from,
    valid_to: c.valid_to,
    payment_days: Number(c.payment_days) || null,
    incoterm: c.incoterm || null,
    price_basis: c.price_basis || null,
    price_notice_days: priceNotice,
    term_notice_days: termNotice,
    // Price changes for next year need notice before year end; leaving needs notice before valid_to.
    price_change_deadline: priceNotice ? addDays("2026-12-31", -priceNotice) : null,
    termination_deadline: termNotice ? addDays(c.valid_to, -termNotice) : null,
    clauses: cl.map((x) => ({
      id: x.id,
      clause: x.clause,
      type: x.type,
      text: x.text,
      series: x.series || null,
      material_share: x.material_share ? Number(x.material_share) : null,
      deadband_pct: x.deadband_pct ? Number(x.deadband_pct) : null,
      days: x.days ? Number(x.days) : null,
    })),
    parts: partIds.map((id) => ({ id, description: partBy.get(id)?.description ?? null })),
    scorecard: sc ? { id: sc.id, quarter: sc.quarter, otd_pct: Number(sc.otd_pct), ppm: Number(sc.ppm), score: Number(sc.score), class: sc.class, colour: sc.colour } : null,
    delivery: deliveries(c.supplier_id),
    quality: quality(c.supplier_id),
    payment: payments(c.supplier_id),
  });
}
out.sort((a, b) => a.supplier.localeCompare(b.supplier));

await writeFile(
  path.join(WEB, "src", "data", "contracts.json"),
  JSON.stringify({ synced_at: new Date().toISOString(), data_version: version, as_of: AS_OF, year_start: YEAR_START, contracts: out }) + "\n",
);
await writeFile(path.join(WEB, "src", "data", "qn-links.json"), JSON.stringify(qnLinks) + "\n");
console.log(`${out.length} contracts, ${Object.keys(qnLinks).length} qn links`);
