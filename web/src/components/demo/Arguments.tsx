"use client";

import { code, stats, type SignalRow } from "@/lib/demo";
import { Ticks } from "./DecideFlow";
import { s } from "./styles";
import { CodeRef, Panel, Tag } from "./ui";

// The engine logs the rival claim as rival_offer; the arena checks it as rival_quote.
const ARENA_NAME: Record<string, string> = { rival_offer: "rival_quote" };
const RESULT_ORDER = ["verified", "duplicate", "irrelevant", "contradicted"];
const RESULT_STYLE: Record<string, string> = {
  verified: "bg-[var(--d-good)]",
  duplicate: "bg-[var(--d-muted)]",
  irrelevant: "bg-[var(--d-warn)]",
  contradicted: "bg-[var(--d-bad)]",
};

export function Arguments() {
  const by = stats.claims.by_type;
  const maxTotal = Math.max(...Object.values(by).map((v) => v.total ?? 0));
  const kinds = [...code.claims].sort((a, b) => (by[ARENA_NAME[b.type] ?? b.type]?.total ?? 0) - (by[ARENA_NAME[a.type] ?? a.type]?.total ?? 0));
  const res = stats.claims.results;
  const sent = Object.values(res).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-4">
        {RESULT_ORDER.map((k) => (
          <div key={k} className="rounded-xl border border-[var(--d-line)] bg-[var(--d-panel)] px-5 py-4 shadow-[var(--d-shadow)]">
            <div className="flex items-center gap-2 text-[12.5px] font-medium">
              <span className={`h-2.5 w-2.5 rounded-sm ${RESULT_STYLE[k]}`} />
              {k}
            </div>
            <div className={`${s.plate} mt-1.5 text-[26px] tabular-nums`}>{res[k] ?? 0}</div>
            <div className="text-[11.5px] text-[var(--d-muted)]">of {sent} claims the arena checked</div>
          </div>
        ))}
      </div>

      <Panel title="The claims our code can write, and how the arena judged them" aside={<CodeRef file={code.claims_selection.file} line={code.claims_selection.line} />}>
        <p className="border-b border-[var(--d-line-soft)] px-4 py-3 text-[13px] leading-relaxed text-[var(--d-ink-2)]">
          <Ticks text={code.claims_selection.rule} />. The arena checks at most 3 claims per message; a figure must match its data ID within tolerance.
        </p>
        <ol className="divide-y divide-[var(--d-line-soft)]">
          {kinds.map((c) => {
            const v = by[ARENA_NAME[c.type] ?? c.type] ?? {};
            const total = v.total ?? 0;
            return (
              <li key={c.type} className="grid gap-4 px-4 py-3 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
                <div>
                  <div className="font-semibold">{c.type.replaceAll("_", " ")}</div>
                  {c.strength !== undefined && <div className="text-[11.5px] text-[var(--d-muted)]">strength {c.strength} in the bank</div>}
                  <div className="mt-1">
                    <CodeRef file={c.file} line={c.line} />
                  </div>
                </div>
                <div className="min-w-0 space-y-1.5 text-[12.5px]">
                  <p className="text-[var(--d-ink-2)]">{c.when_used}</p>
                  <code className={`${s.code} block whitespace-pre-wrap rounded bg-[var(--d-sunk)] px-2 py-1.5 !text-[11.5px]`}>{c.sentence_template}</code>
                  <p className="text-[11.5px] text-[var(--d-muted)]">Cites: {c.refs}</p>
                </div>
                <div className="text-[12px]">
                  <div className="mb-1 flex justify-between">
                    <span className="text-[var(--d-muted)]">sent in recorded runs</span>
                    <span className="font-semibold tabular-nums">{total}</span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-r-[3px]" style={{ width: `${Math.max(4, (total / maxTotal) * 100)}%` }}>
                    {RESULT_ORDER.filter((k) => v[k]).map((k) => (
                      <span key={k} className={`${RESULT_STYLE[k]} border-r-2 border-[var(--d-panel)] last:border-r-0`} style={{ flex: v[k] }} title={`${k}: ${v[k]}`} />
                    ))}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-[var(--d-ink-2)]">
                    {RESULT_ORDER.filter((k) => v[k]).map((k) => (
                      <span key={k}>
                        {v[k]} {k}
                      </span>
                    ))}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>

      <Panel title="How the engine reads a supplier's e-mail" aside={<CodeRef file={code.signals.source.file} line={code.signals.source.line} />}>
        <p className="border-b border-[var(--d-line-soft)] px-4 py-3 text-[13px] leading-relaxed text-[var(--d-ink-2)]">
          No model reads the reply. {code.signals.source.note}. The arena&apos;s suppliers phrase these the same way across cases, so fixed patterns carry over.
        </p>
        <SignalTable title="What it asks for" rows={code.signals.asks} counts={stats.supplier_reading.asks} />
        <SignalTable title="What state it is in" rows={code.signals.traits} counts={stats.supplier_reading.traits} />
        {code.signals.dossier && <SignalTable title="Before the case: its letters, notes and news" rows={code.signals.dossier} />}
      </Panel>
    </div>
  );
}

function SignalTable({ title, rows, counts }: { title: string; rows: SignalRow[]; counts?: Record<string, number> }) {
  return (
    <div className="border-b border-[var(--d-line-soft)] last:border-b-0">
      <div className="px-4 pb-1 pt-3 text-[12.5px] font-semibold">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead className="text-left text-[11.5px] text-[var(--d-muted)]">
            <tr>
              <th className="px-4 py-1.5 font-normal">Signal</th>
              <th className="py-1.5 pr-3 font-normal">Pattern</th>
              <th className="py-1.5 pr-3 font-normal">What the engine does</th>
              {counts && <th className="py-1.5 pr-4 text-right font-normal">Seen in runs</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-[var(--d-line-soft)] align-top">
                <td className="px-4 py-2">
                  <Tag tone="supplier">{r.key.replaceAll("_", " ")}</Tag>
                  {r.example && <div className="mt-1 max-w-[240px] text-[11.5px] italic text-[var(--d-muted)]">“{r.example}”</div>}
                </td>
                <td className={`${s.code} max-w-[320px] py-2 pr-3 !text-[11px] break-words text-[var(--d-ink-2)]`}>{r.regex}</td>
                <td className="py-2 pr-3 text-[var(--d-ink-2)]">
                  <Ticks text={r.effect_in_policy ?? r.effect ?? ""} />
                </td>
                {counts && <td className={`${s.plate} py-2 pr-4 text-right text-[18px] tabular-nums`}>{counts[r.key] ?? 0}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
