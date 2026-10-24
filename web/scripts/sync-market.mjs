// Snapshot the market indices for the Market section.
//
//   cd web && npm run sync:market
//
// Reads ../data and writes src/data/market.json: all index series with every monthly value, the parts
// whose cost each one drives (cost_drivers), and the contract clauses that index a price to it. Claims
// made with an index in our runs and the cases' expected index moves are joined in the app from the
// runs and inbox snapshots. No arena calls.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA, WEB, rows } from "./lib/package.mjs";

const DATA_MONTH = "2026-09"; // the package is as of 2026-09-30

const FAMILY = [
  [/^PPI-/, "Producer prices DE (Eurostat)"],
  [/^LCI-/, "Labour cost (Eurostat)"],
  [/^WB-/, "Commodities (World Bank)"],
  [/^ECB-/, "Exchange rates (ECB)"],
  [/^SMARD-/, "Power price (SMARD)"],
  [/./, "Derived notations"],
];

const [series, values, drivers, parts, clauses, contracts, suppliers] = await Promise.all(
  ["index_series", "index_values", "cost_drivers", "parts", "contract_clauses", "contracts", "suppliers"].map(rows),
);
const version = JSON.parse(await readFile(path.join(DATA, "datapackage.json"), "utf8")).version ?? null;

const partBy = new Map(parts.map((p) => [p.id, p]));
const contractBy = new Map(contracts.map((c) => [c.id, c]));
const supplierBy = new Map(suppliers.map((s) => [s.id, s]));

const out = series.map((s) => {
  const vals = values
    .filter((v) => v.series_id === s.id)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((v) => [v.month, Number(v.value)]);
  return {
    id: s.id,
    name: s.name,
    unit: s.unit || null,
    source: s.source || null,
    frequency: s.frequency || null,
    licence: s.licence || null,
    url: s.url || null,
    formula: s.formula || null,
    first_month: s.first_month,
    last_month: s.last_month,
    family: FAMILY.find(([re]) => re.test(s.id))[1],
    values: vals,
    drivers: drivers
      .filter((d) => d.series_id === s.id)
      .map((d) => ({
        part_id: d.part_id,
        description: partBy.get(d.part_id)?.description ?? null,
        category: partBy.get(d.part_id)?.category ?? null,
        weight: Number(d.weight),
      }))
      .sort((a, b) => b.weight - a.weight),
    clauses: clauses
      .filter((c) => c.type === "index" && c.series === s.id)
      .map((c) => {
        const sup = contractBy.get(c.contract_id)?.supplier_id ?? null;
        return {
          id: c.id,
          contract_id: c.contract_id,
          supplier_id: sup,
          supplier: sup ? (supplierBy.get(sup)?.name ?? sup) : null,
          material_share: Number(c.material_share),
          deadband_pct: Number(c.deadband_pct),
          text: c.text,
        };
      }),
  };
});

await writeFile(
  path.join(WEB, "src", "data", "market.json"),
  JSON.stringify({ synced_at: new Date().toISOString(), data_version: version, data_month: DATA_MONTH, series: out }) + "\n",
);
console.log(`${out.length} series, ${out.reduce((n, s) => n + s.values.length, 0)} values`);
