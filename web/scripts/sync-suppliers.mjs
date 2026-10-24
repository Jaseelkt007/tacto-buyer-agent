// Snapshot the data package's supplier data for the Suppliers section.
//
//   cd web && npm run sync:suppliers
//
// Reads ../data (the package `arena data` unpacked; rerun after the Sunday 08:00 release) and writes
// src/data/suppliers.json (vendor master, spend, and for the 46 detailed suppliers: register facts,
// contract, source list, scorecards, news, letters and notes) plus src/data/links.json (which supplier
// an ID such as ctr: / doc: / news: belongs to, so ID chips can link to its page). No arena calls.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA, WEB, letter, rows, typed } from "./lib/package.mjs";

// The signals our agent's dossier reads from letters and news. Mirrors
// starter-kit/arena_kit/agents/procudeal/dossier.py on origin/main (c3f38a1); keep them in step.
const OWNER_RATE = { group: 0.05, private: 0.07, family: 0.075, founder: 0.1 };
const DEFAULT_RATE = 0.075;
const CASH_PREMIUM = 0.05;
const SIGNS = {
  cash: /overdue invoices|pay (?:our )?invoices|cash discount|liquidity|payment within \d+|pay(?:ing)? faster|faster payment|cash flow|skonto/gi,
  work: /new customers|free capacity|order intake|short[- ]time work|utili[sz]ation (?:is )?low/gi,
  full: /capacity utili[sz]ation|cannot confirm your (?:full )?forecast|fully booked|at capacity/gi,
};

const by = (list, key) => {
  const m = new Map();
  for (const r of list) m.set(r[key], [...(m.get(r[key]) ?? []), r]);
  return m;
};

const [suppliers, intel, spend, sourcing, parts, contracts, scorecards, news, documents] = await Promise.all(
  ["suppliers", "supplier_intel", "spend_cube", "sourcing", "parts", "contracts", "scorecards", "news", "documents"].map(rows),
);
const version = JSON.parse(await readFile(path.join(DATA, "datapackage.json"), "utf8")).version ?? null;

const spendBy = by(spend, "supplier_id");
const intelBy = new Map(intel.map((r) => [r.supplier_id, r]));
const partBy = new Map(parts.map((r) => [r.id, r]));
const contractBy = new Map(contracts.map((r) => [r.id, r]));
const sourcingBy = by(sourcing, "supplier_id");
const scoreBy = by(scorecards, "supplier_id");
const newsBy = by(news, "supplier_id");
const docsBy = by(documents, "supplier_id");

const master = suppliers.map((s) => {
  const sp = {};
  for (const r of spendBy.get(s.id) ?? []) {
    const y = (sp[r.fiscal_year] ??= { spend_eur: 0, invoice_count: 0 });
    y.spend_eur += Number(r.spend_eur);
    y.invoice_count += Number(r.invoice_count);
  }
  return {
    ...typed(s, ["payment_days", "skonto_days", "skonto_pct", "standard_lead_time_days"]),
    blocked: s.blocked === "true",
    spend: sp,
  };
});

const details = {};
const links = {};
for (const s of suppliers.filter((x) => x.detail === "full")) {
  const docs = [];
  for (const d of (docsBy.get(s.id) ?? []).sort((a, b) => a.date.localeCompare(b.date))) {
    const text = await letter(d.id);
    docs.push({
      ...typed(d, ["asked_pct", "asked_price", "notice_days"]),
      part_ids: d.part_ids ? d.part_ids.split(/[;\s]+/).filter(Boolean) : [],
      body: text?.body ?? "",
    });
    links[d.id] = s.id;
  }
  const items = (newsBy.get(s.id) ?? []).sort((a, b) => a.date.localeCompare(b.date));
  for (const n of items) links[n.id] = s.id;

  // Same text the dossier scans: each document's subject + body, each news headline + body.
  const evidence = { cash: [], work: [], full: [] };
  const texts = [
    ...docs.map((d) => ({ id: d.id, text: `${d.subject}\n${d.body}` })),
    ...items.map((n) => ({ id: n.id, text: `${n.headline}\n${n.body ?? ""}` })),
  ];
  for (const t of texts) {
    for (const [k, re] of Object.entries(SIGNS)) {
      const hits = [...new Set([...t.text.matchAll(re)].map((m) => m[0]))];
      if (hits.length) evidence[k].push({ id: t.id, matches: hits });
    }
  }
  const info = intelBy.get(s.id);
  const base = OWNER_RATE[info?.owner_type] ?? DEFAULT_RATE;

  const contract = s.contract_id ? contractBy.get(s.contract_id) : null;
  if (contract) links[contract.id] = s.id;

  details[s.id] = {
    intel: info
      ? typed(info, ["founded", "staff", "filed_fy", "turnover_eur", "equity_ratio_pct", "credit_index", "credit_index_12m_ago"])
      : null,
    contract: contract ? typed(contract, ["payment_days", "notice_days"]) : null,
    sourcing: (sourcingBy.get(s.id) ?? []).map((r) => ({
      ...typed(r, ["quota_pct"]),
      description: partBy.get(r.part_id)?.description ?? null,
      category: partBy.get(r.part_id)?.category ?? null,
      abc_class: partBy.get(r.part_id)?.abc_class ?? null,
    })),
    scorecards: (scoreBy.get(s.id) ?? [])
      .map((r) =>
        typed(r, ["gr_lines", "otd_pct", "otd_confirmed_pct", "received_qty", "complaint_qty", "ppm", "qn_count", "open_8d_overdue", "score"]),
      )
      .sort((a, b) => a.quarter.localeCompare(b.quarter)),
    news: items.map((n) => typed(n, [])),
    documents: docs,
    signals: {
      owner_rate: base,
      cash_premium: evidence.cash.length ? CASH_PREMIUM : 0,
      interest_rate: base + (evidence.cash.length ? CASH_PREMIUM : 0),
      evidence,
    },
  };
}

await writeFile(
  path.join(WEB, "src", "data", "suppliers.json"),
  JSON.stringify({ synced_at: new Date().toISOString(), data_version: version, suppliers: master, details }) + "\n",
);
await writeFile(path.join(WEB, "src", "data", "links.json"), JSON.stringify(links) + "\n");
console.log(`${master.length} suppliers, ${Object.keys(details).length} detailed, ${Object.keys(links).length} linked IDs`);
