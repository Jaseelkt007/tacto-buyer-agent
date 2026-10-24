"use client";

import { useEffect, useMemo, useState } from "react";
import { DataId } from "../MailBody";
import { SearchIcon } from "../icons";

type Facts = Record<string, Record<string, unknown>>;

// What the arena checks per ID type (brief/api.md, "Data you cite is checked").
const TYPES: Record<string, { label: string; checks: string }> = {
  idx: { label: "Index value", checks: "2 IDs of one series ≤ 12 months apart, ending in the last 12 months: the % change" },
  po: { label: "Order line", checks: "2–8 lines of the same part: the order prices" },
  qn: { label: "Quality notification", checks: "with sc: rows: the mean ppm when you speak of quality" },
  fc: { label: "Forecast", checks: "the forecast change % (vs called off in the prior 12 months)" },
  sc: { label: "Scorecard", checks: "the mean on-time % (or mean ppm for quality)" },
  ctr: { label: "Contract / clause", checks: "with a letter doc: the days of notice agreed" },
  doc: { label: "Letter, e-mail, note", checks: "price letters: the notice given; notes are context only" },
  quote: { label: "Quote", checks: "its price, same part (only a quote the case cites)" },
  rfq: { label: "RFQ", checks: "context" },
  news: { label: "News", checks: "that it is about this supplier" },
  cost: { label: "Should-cost", checks: "the unit cost estimate" },
};

const show = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "number" ? v.toLocaleString("en-GB") : String(v));
const isId = (v: unknown) => typeof v === "string" && /^(sup|part):/.test(v);

/** Search every citable ID and see the values the arena checks a claim against. */
export function FactSearch() {
  const [facts, setFacts] = useState<Facts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");

  useEffect(() => {
    fetch("/facts.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((f: Facts) => {
        setFacts(f);
        // /facts#<id> opens with that ID searched.
        const h = decodeURIComponent(location.hash.slice(1));
        if (h) setQ(h);
      })
      .catch((e) => setError(String(e)));
  }, []);

  const ids = useMemo(() => (facts ? Object.keys(facts) : []), [facts]);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const id of ids) c[id.split(":")[0]] = (c[id.split(":")[0]] ?? 0) + 1;
    return c;
  }, [ids]);
  const needle = q.trim().toLowerCase();
  const hits = useMemo(() => {
    if (!facts) return [];
    const out: string[] = [];
    for (const id of ids) {
      if (type && !id.startsWith(`${type}:`)) continue;
      if (needle && !id.toLowerCase().includes(needle) && !JSON.stringify(facts[id]).toLowerCase().includes(needle)) continue;
      out.push(id);
      if (out.length >= 100) break;
    }
    return out;
  }, [facts, ids, type, needle]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-60 flex-1 items-center gap-2 rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[13px] sm:max-w-md">
          <SearchIcon className="text-[var(--muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="An ID or any value: idx:PPI-D351@2026-08, sup:70110, 310010, Brandlhuber"
            className="w-full bg-transparent outline-none placeholder:text-[var(--muted)]"
          />
        </label>
        <span className="text-[12px] text-[var(--muted)]">
          {facts ? `${ids.length.toLocaleString("en-GB")} facts${needle || type ? ` · showing ${hits.length}${hits.length === 100 ? " (first 100)" : ""}` : ""}` : error ? `could not load facts.json (${error})` : "loading…"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[12px]">
        <button
          onClick={() => setType("")}
          className={`rounded border px-2 py-0.5 ${!type ? "border-[var(--accent)] bg-[var(--select)] text-[var(--accent-ink)]" : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--hover)]"}`}
        >
          all
        </button>
        {Object.entries(TYPES).map(([k, t]) => (
          <button
            key={k}
            onClick={() => setType(type === k ? "" : k)}
            title={t.checks}
            className={`rounded border px-2 py-0.5 ${type === k ? "border-[var(--accent)] bg-[var(--select)] text-[var(--accent-ink)]" : "border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--hover)]"}`}
          >
            <span className="font-mono">{k}:</span> {t.label} <span className="text-[var(--muted)]">{counts[k]?.toLocaleString("en-GB") ?? ""}</span>
          </button>
        ))}
      </div>
      {type && TYPES[type] && (
        <p className="text-[12.5px] text-[var(--ink-2)]">
          The arena checks <span className="font-mono">{type}:</span> as: {TYPES[type].checks}.
        </p>
      )}

      {facts && (needle || type) && (
        <ul className="space-y-1.5">
          {hits.map((id) => (
            <li key={id} className="rounded border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                <DataId id={id} />
                <span className="text-[var(--muted)]">{TYPES[id.split(":")[0]]?.label}</span>
              </div>
              <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12.5px]">
                {Object.entries(facts[id]).map(([k, v]) => (
                  <div key={k} className="flex gap-1.5">
                    <dt className="text-[var(--ink-2)]">{k.replace(/_/g, " ")}</dt>
                    <dd className="tabular-nums">{isId(v) ? <DataId id={v as string} /> : show(v)}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
      {facts && !needle && !type && <p className="text-[13px] text-[var(--muted)]">Type an ID or a value, or pick a type.</p>}
    </div>
  );
}
