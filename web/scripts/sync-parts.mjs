// Snapshot the data package's part and cost data for the Parts & Cost section.
//
//   cd web && npm run sync:parts
//
// Reads ../data and writes src/data/parts.json: per part its master data, source list, current price
// per supplier, should-cost (and the full-cost estimate our agent uses per supplier), price history
// with the negotiation behind each change, cost drivers with their index moves, what we bought per
// fiscal year, and the letters that name it. No arena calls.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA, WEB, rows, typed } from "./lib/package.mjs";

// Mirrors starter-kit/arena_kit/agents/procudeal/{dossier,claims}.py on origin/main (c3f38a1).
const COUNTRY_COST = { DE: 1.0, AT: 1.05, CH: 1.1, CZ: 0.82, PL: 0.82, HU: 0.82, TR: 0.75, CN: 0.7 };
const SHOULD_COST_CLAIM = 0.98; // the agent argues should-cost only below 98 % of the price
const MIN_INDEX_FALL = -0.5; // % - smaller falls are not worth a claim
const DATA_MONTH = "2026-09"; // the package is as of 2026-09-30
const HISTORY_MONTHS = 36;

const [parts, sourcing, suppliers, shouldCost, drivers, conditions, history, series, values, poLines, documents] =
  await Promise.all(
    [
      "parts",
      "sourcing",
      "suppliers",
      "should_cost",
      "cost_drivers",
      "price_conditions",
      "negotiation_history",
      "index_series",
      "index_values",
      "po_lines",
      "documents",
    ].map(rows),
  );
const version = JSON.parse(await readFile(path.join(DATA, "datapackage.json"), "utf8")).version ?? null;

const by = (list, key) => {
  const m = new Map();
  for (const r of list) m.set(r[key], [...(m.get(r[key]) ?? []), r]);
  return m;
};
const monthsBetween = (a, b) => {
  const [ay, am] = a.split("-").map(Number);
  const [by_, bm] = b.split("-").map(Number);
  return (by_ - ay) * 12 + (bm - am);
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
// Fiscal year October to September: 2025-10 .. 2026-09 is FY2026.
const fiscalYear = (date) => {
  const [y, m] = date.split("-").map(Number);
  return `FY${m >= 10 ? y + 1 : y}`;
};
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

const supplierBy = new Map(suppliers.map((s) => [s.id, s]));
const seriesBy = new Map(series.map((s) => [s.id, s]));
const valuesBy = by(values, "series_id");
for (const list of valuesBy.values()) list.sort((a, b) => a.month.localeCompare(b.month));
const historyBy = new Map(history.map((h) => [h.event_id, h]));
const sourcingBy = by(sourcing, "part_id");
const costBy = by(shouldCost, "part_id");
const driversBy = by(drivers, "part_id");
const conditionsBy = by(conditions, "part_id");
const poBy = by(poLines, "part_id");

/** A driver's index move: 12 months to its latest month, and the largest fall the agent would cite. */
function driverMove(seriesId) {
  const list = valuesBy.get(seriesId) ?? [];
  const last = list.at(-1);
  if (!last) return { last: null, change_12m: null, best_fall: null };
  const at = (month) => list.find((v) => v.month === month);
  const yearAgo = at(monthsBack(last.month, 12));
  const change_12m = yearAgo
    ? { from: yearAgo.id, to: last.id, pct: round((Number(last.value) / Number(yearAgo.value) - 1) * 100, 2) }
    : null;
  let best = null;
  if (monthsBetween(last.month, DATA_MONTH) <= 11) {
    for (let k = 1; k <= 12; k++) {
      const prev = at(monthsBack(last.month, k));
      if (!prev || !Number(prev.value)) continue;
      const pct = (Number(last.value) / Number(prev.value) - 1) * 100;
      if (!best || pct < best.pct) best = { from: prev.id, to: last.id, pct };
    }
  }
  return {
    last: { id: last.id, month: last.month, value: Number(last.value) },
    change_12m,
    best_fall: best && round(best.pct, 1) <= MIN_INDEX_FALL ? { ...best, pct: round(best.pct, 1) } : null,
  };
}

const seriesOut = {};
const out = [];
for (const p of parts) {
  const part = typed(p, ["net_weight_kg", "price_unit", "planned_lead_time_days", "standard_price"]);

  // Price history: each condition with the negotiation event that set it.
  const conds = (conditionsBy.get(p.id) ?? [])
    .map((c) => {
      const h = historyBy.get(c.event_id);
      return {
        ...typed(c, ["price", "price_unit"]),
        event: h ? typed(h, ["asked_pct", "settled_pct"]) : null,
      };
    })
    .sort((a, b) => a.supplier_id.localeCompare(b.supplier_id) || a.valid_from.localeCompare(b.valid_from));

  const costs = (costBy.get(p.id) ?? []).map((c) =>
    typed(c, ["unit_cost", "price_unit", "material_eur", "conversion_eur", "overhead_eur", "confidence_pct"]),
  );
  const generic = costs.find((c) => !c.supplier_id);

  // One row per supplier on the source list (plus any supplier with a price condition).
  const supIds = [...new Set([...(sourcingBy.get(p.id) ?? []).map((s) => s.supplier_id), ...conds.map((c) => c.supplier_id)])];
  const sups = supIds.map((sid) => {
    const s = supplierBy.get(sid);
    const src = (sourcingBy.get(p.id) ?? []).find((x) => x.supplier_id === sid);
    const mine = conds.filter((c) => c.supplier_id === sid);
    const current = mine.find((c) => !c.valid_to) ?? mine.at(-1) ?? null;
    const own = costs.find((c) => c.supplier_id === sid);
    const factor = COUNTRY_COST[s?.country] ?? 1.0;
    const full = own
      ? { unit_cost: own.unit_cost, source: own.id, how: "should-cost of its own plant" }
      : generic
        ? { unit_cost: round(generic.unit_cost * factor), source: generic.id, how: `German should-cost × ${factor} (${s?.country ?? "?"})` }
        : null;
    const price = current?.price ?? null;
    return {
      supplier_id: sid,
      name: s?.name ?? sid,
      country: s?.country ?? null,
      status: src?.status ?? null,
      quota_pct: src ? Number(src.quota_pct) : null,
      tooling_owner: src?.tooling_owner || null,
      current_price: price,
      current_since: current?.valid_from ?? null,
      current_basis: current?.basis ?? null,
      full_cost: full,
      margin_pct: price && full ? round((price / full.unit_cost - 1) * 100, 1) : null,
      should_cost_claim: !!(price && full && full.unit_cost < SHOULD_COST_CLAIM * price),
    };
  });
  sups.sort((a, b) => (b.quota_pct ?? -1) - (a.quota_pct ?? -1));

  const drv = (driversBy.get(p.id) ?? [])
    .map((d) => {
      const move = driverMove(d.series_id);
      const meta = seriesBy.get(d.series_id);
      if (!seriesOut[d.series_id]) {
        seriesOut[d.series_id] = {
          id: d.series_id,
          name: meta?.name ?? d.series_id,
          unit: meta?.unit ?? null,
          source: meta?.source ?? null,
          values: (valuesBy.get(d.series_id) ?? []).slice(-HISTORY_MONTHS).map((v) => [v.month, Number(v.value)]),
        };
      }
      const weight = Number(d.weight);
      return {
        series_id: d.series_id,
        name: meta?.name ?? d.series_id,
        weight,
        source: d.source,
        ...move,
        contribution_pp: move.change_12m ? round(weight * move.change_12m.pct, 2) : null,
      };
    })
    .sort((a, b) => b.weight - a.weight);
  const indexShare = round(drv.reduce((s, d) => s + d.weight, 0), 2);
  const implied = drv.every((d) => d.contribution_pp === null) ? null : round(drv.reduce((s, d) => s + (d.contribution_pp ?? 0), 0), 2);

  const po = {};
  for (const l of poBy.get(p.id) ?? []) {
    const fy = fiscalYear(l.order_date);
    const y = (po[fy] ??= { qty: 0, spend_eur: 0, lines: 0, stale_lines: 0 });
    y.qty += Number(l.qty);
    y.spend_eur += (Number(l.qty) * Number(l.price)) / Number(l.price_unit || 1);
    y.lines += 1;
    if (l.price_note === "stale_condition") y.stale_lines += 1;
  }
  for (const y of Object.values(po)) y.spend_eur = round(y.spend_eur);

  const letters = documents
    .filter((d) => d.part_ids.split(/[;\s]+/).includes(p.id))
    .map((d) => {
      const t = typed(d, ["asked_pct", "asked_price", "notice_days"]);
      return {
        id: t.id,
        date: t.date,
        kind: t.kind,
        supplier_id: t.supplier_id,
        subject: t.subject,
        author: t.author,
        asked_pct: t.asked_pct,
        asked_price: t.asked_price,
        effective_date: t.effective_date,
        notice_days: t.notice_days,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  out.push({
    ...part,
    suppliers: sups,
    should_cost: costs,
    conditions: conds,
    drivers: drv,
    index_share: indexShare,
    implied_change_12m_pct: implied,
    po,
    letters,
  });
}

await writeFile(
  path.join(WEB, "src", "data", "parts.json"),
  JSON.stringify({ synced_at: new Date().toISOString(), data_version: version, data_month: DATA_MONTH, parts: out, series: seriesOut }) + "\n",
);
console.log(`${out.length} parts, ${Object.keys(seriesOut).length} driver series`);
