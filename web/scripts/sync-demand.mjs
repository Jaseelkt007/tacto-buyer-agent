// Snapshot demand, sourcing and spend for the Demand & Sourcing section.
//
//   cd web && npm run sync:demand
//
// Reads ../data and writes src/data/demand.json: per part every forecast snapshot (with the change the
// arena checks for an fc: claim, from facts.json), the latest monthly forecast, what we called off per
// month, its source list, and every RFQ with its quotes; plus the spend cube by fiscal year, category
// and country. Also src/data/demand-links.json (which part an fc: / rfq: / quote: ID belongs to).
// No arena calls.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA, WEB, rows } from "./lib/package.mjs";

const AS_OF_MONTH = "2026-09";

const [parts, forecasts, forecastLines, poLines, rfqs, quotes, sourcing, suppliers, spend] = await Promise.all(
  ["parts", "forecasts", "forecast_lines", "po_lines", "rfqs", "quotes", "sourcing", "suppliers", "spend_cube"].map(rows),
);
const facts = JSON.parse(await readFile(path.join(DATA, "facts.json"), "utf8"));
const version = JSON.parse(await readFile(path.join(DATA, "datapackage.json"), "utf8")).version ?? null;

const by = (list, key) => {
  const m = new Map();
  for (const r of list) m.set(r[key], [...(m.get(r[key]) ?? []), r]);
  return m;
};
const monthsBack = (month, k) => {
  let [y, m] = month.split("-").map(Number);
  m -= k;
  while (m <= 0) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
};
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

const supplierBy = new Map(suppliers.map((s) => [s.id, s]));
const fcBy = by(forecasts, "part_id");
const linesBy = by(forecastLines, "fc_id");
const poBy = by(poLines, "part_id");
const rfqBy = by(rfqs, "part_id");
const quotesBy = by(quotes, "rfq_id");
const sourcingBy = by(sourcing, "part_id");
const links = {};

const out = parts.map((p) => {
  const pos = poBy.get(p.id) ?? [];
  // Called off = order quantity by requested month (what the arena compares a forecast with).
  const calloff = {};
  for (const l of pos) calloff[l.requested_date.slice(0, 7)] = (calloff[l.requested_date.slice(0, 7)] ?? 0) + Number(l.qty);
  const calledOff12m = (month) => {
    let s = 0;
    for (let k = 0; k < 12; k++) s += calloff[monthsBack(month, k)] ?? 0;
    return s;
  };

  const snaps = (fcBy.get(p.id) ?? [])
    .sort((a, b) => a.snapshot_month.localeCompare(b.snapshot_month))
    .map((f) => {
      links[f.id] = p.id;
      const fact = facts[f.id];
      const base = calledOff12m(f.snapshot_month);
      return {
        id: f.id,
        month: f.snapshot_month,
        qty_next_12m: Number(f.qty_next_12m),
        called_off_12m: base,
        // Only the arena's figure: before 2024-09 the order history does not cover the prior 12 months.
        change_pct: fact?.change_pct ?? null,
        citable: !!fact,
        shared: f.shared_with_suppliers === "true",
      };
    });
  const latest = snaps.at(-1) ?? null;

  const history = [];
  for (let k = 23; k >= 0; k--) {
    const m = monthsBack(AS_OF_MONTH, k);
    history.push({ month: m, qty: calloff[m] ?? 0 });
  }

  const rfq = (rfqBy.get(p.id) ?? [])
    .sort((a, b) => b.rfq_date.localeCompare(a.rfq_date))
    .map((r) => {
      links[r.id] = p.id;
      return {
        id: r.id,
        date: r.rfq_date,
        qty_per_year: Number(r.qty_per_year),
        purpose: r.purpose,
        status: r.status,
        awarded_supplier_id: r.awarded_supplier_id || null,
        quotes: (quotesBy.get(r.id) ?? [])
          .map((q) => {
            links[q.id] = p.id;
            return {
              id: q.id,
              supplier_id: q.supplier_id,
              supplier: supplierBy.get(q.supplier_id)?.name ?? q.supplier_id,
              country: supplierBy.get(q.supplier_id)?.country ?? null,
              date: q.quote_date,
              unit_price: Number(q.unit_price),
              lead_time_days: q.lead_time_days ? Number(q.lead_time_days) : null,
              incoterm: q.incoterm || null,
              payment_days: q.payment_days ? Number(q.payment_days) : null,
              validity_days: q.validity_days ? Number(q.validity_days) : null,
              tooling_eur: q.tooling_eur ? Number(q.tooling_eur) : 0,
              awarded: q.awarded === "true",
              missing_fields: q.missing_fields ? q.missing_fields.split(";") : [],
              remarks: q.remarks || null,
            };
          })
          .sort((a, b) => a.unit_price - b.unit_price),
      };
    });

  return {
    id: p.id,
    description: p.description,
    category: p.category,
    uom: p.uom,
    price_unit: Number(p.price_unit),
    abc_class: p.abc_class || null,
    status: p.status,
    snapshots: snaps,
    latest,
    forecast_lines: latest
      ? (linesBy.get(latest.id) ?? []).sort((a, b) => a.target_month.localeCompare(b.target_month)).map((l) => ({ month: l.target_month, qty: Number(l.qty) }))
      : [],
    calloff_history: history,
    open_orders_qty: pos.filter((l) => l.requested_date.slice(0, 7) > AS_OF_MONTH).reduce((s, l) => s + Number(l.qty), 0),
    sources: (sourcingBy.get(p.id) ?? []).map((s) => ({
      supplier_id: s.supplier_id,
      supplier: supplierBy.get(s.supplier_id)?.name ?? s.supplier_id,
      country: supplierBy.get(s.supplier_id)?.country ?? null,
      status: s.status,
      quota_pct: Number(s.quota_pct),
      approved_since: s.approved_since || null,
      tooling_owner: s.tooling_owner || null,
    })),
    rfqs: rfq,
  };
});

// Spend cube: per fiscal year by category and by supplier country, and supplier concentration.
const years = [...new Set(spend.map((s) => s.fiscal_year))].sort();
const supplierSpend = {};
const category = {};
const country = {};
for (const s of spend) {
  const eur = Number(s.spend_eur);
  const sup = supplierBy.get(s.supplier_id);
  const add = (table, key, sub) => {
    table[key] ??= {};
    table[key][sub] = (table[key][sub] ?? 0) + eur;
  };
  add(category, s.category, s.fiscal_year);
  add(country, sup?.country ?? "?", s.fiscal_year);
  add(supplierSpend, s.fiscal_year, s.supplier_id);
}
const latestFy = years.at(-1);
const ranked = Object.entries(supplierSpend[latestFy] ?? {}).sort((a, b) => b[1] - a[1]);
const total = ranked.reduce((s, [, v]) => s + v, 0);
const roundAll = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([y, e]) => [y, round(e, 0)]))]));

const spendOut = {
  years,
  total_by_year: Object.fromEntries(years.map((y) => [y, round(Object.values(supplierSpend[y] ?? {}).reduce((s, v) => s + v, 0), 0)])),
  by_category: roundAll(category),
  by_country: roundAll(country),
  suppliers_with_spend: ranked.length,
  top10_share: round((ranked.slice(0, 10).reduce((s, [, v]) => s + v, 0) / total) * 100),
  detailed_share: round((ranked.filter(([id]) => supplierBy.get(id)?.detail === "full").reduce((s, [, v]) => s + v, 0) / total) * 100),
  top: ranked.slice(0, 15).map(([id, v]) => ({
    supplier_id: id,
    name: supplierBy.get(id)?.name ?? id,
    country: supplierBy.get(id)?.country ?? null,
    category: supplierBy.get(id)?.category ?? null,
    detailed: supplierBy.get(id)?.detail === "full",
    spend_eur: round(v, 0),
    share: round((v / total) * 100),
  })),
};

await writeFile(
  path.join(WEB, "src", "data", "demand.json"),
  JSON.stringify({ synced_at: new Date().toISOString(), data_version: version, as_of_month: AS_OF_MONTH, parts: out, spend: spendOut }) + "\n",
);
await writeFile(path.join(WEB, "src", "data", "demand-links.json"), JSON.stringify(links) + "\n");
const mismatch = out.flatMap((p) => p.snapshots).filter((s) => s.citable && s.called_off_12m && Math.abs((s.qty_next_12m / s.called_off_12m - 1) * 100 - s.change_pct) > 0.2);
console.log(`${out.length} parts, ${Object.keys(links).length} linked IDs, ${mismatch.length} fc changes that differ from our own calculation`);
