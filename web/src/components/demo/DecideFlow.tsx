"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { code } from "@/lib/demo";
import { s } from "./styles";
import { CodeRef, Panel, Seg } from "./ui";

/** Inline `code` spans in the analysis text become monospace. */
export function Ticks({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("`") && p.endsWith("`") ? (
          <code key={i} className={`${s.code} rounded bg-[var(--d-sunk)] px-1 !text-[11.5px]`}>
            {p.slice(1, -1)}
          </code>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

function actionTone(a: string) {
  const t = a.toLowerCase();
  if (t.includes("llm")) return { c: "var(--d-llm)", w: "var(--d-llm-wash)", label: "LLM" };
  if (t.startsWith("accept") || t.includes("accept best")) return { c: "var(--d-good)", w: "var(--d-good-wash)", label: "accept" };
  if (t.includes("walk")) return { c: "var(--d-bad)", w: "var(--d-bad-wash)", label: "walk away" };
  if (t.startsWith("send") || t.includes("last call")) return { c: "var(--d-buyer)", w: "var(--d-buyer-wash)", label: "send" };
  return { c: "var(--d-muted)", w: "var(--d-sunk)", label: "continue" };
}

type Scope = "all" | "single" | "rfq";

export function DecideFlow() {
  const [scope, setScope] = useState<Scope>("all");
  const [open, setOpen] = useState<string | null>("accept_ready");
  const [q, setQ] = useState("");
  const flow = code.decide_flow.filter((f) => (scope === "all" ? true : scope === "rfq" ? f.id.startsWith("rfq") || f.id.startsWith("talk") : !f.id.startsWith("rfq")));
  const constants = useMemo(
    () => code.constants.filter((c) => !q || `${c.name} ${c.meaning} ${c.file}`.toLowerCase().includes(q.toLowerCase())),
    [q],
  );

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Panel
          title="Negotiator.decide(), branch by branch"
          aside={<CodeRef file="starter-kit/arena_kit/agents/procudeal/policy.py" line={155} />}
        >
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--d-line-soft)] px-4 py-2.5 text-[12px]">
            <Seg
              label="Which branches"
              value={scope}
              onChange={setScope}
              options={[
                { value: "all", label: "All" },
                { value: "single", label: "One supplier" },
                { value: "rfq", label: "RFQ" },
              ]}
            />
            <span className="text-[var(--d-muted)]">Checked top to bottom on every move; the first branch that returns a move wins.</span>
          </div>
          <ol className="relative px-4 py-3">
            <span className="absolute bottom-6 left-[34px] top-6 w-px bg-[var(--d-line)]" aria-hidden />
            {flow.map((f) => {
              const t = actionTone(f.action);
              const isOpen = open === f.id;
              return (
                <li key={f.id} className="relative">
                  <button type="button" onClick={() => setOpen(isOpen ? null : f.id)} aria-expanded={isOpen} className="flex w-full items-start gap-3 rounded-md py-1.5 pr-2 text-left hover:bg-[var(--d-panel-2)]">
                    <span
                      className={`${s.plate} relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[13px] tabular-nums`}
                      style={{ borderColor: t.c, background: "var(--d-panel)" }}
                    >
                      {f.order}
                    </span>
                    <span className="min-w-0 flex-1 pt-0.5">
                      <span className="block text-[13px] leading-snug">
                        <Ticks text={f.condition} />
                      </span>
                      <span className="mt-1 inline-flex items-center gap-1.5 rounded px-1.5 py-px text-[11.5px] font-medium" style={{ background: t.w }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.c }} aria-hidden />
                        {f.action}
                      </span>
                    </span>
                  </button>
                  {isOpen && (
                    <div className={`${s.enter} mb-2 ml-10 space-y-1.5 rounded-md border border-[var(--d-line)] bg-[var(--d-panel-2)] p-3 text-[12.5px]`}>
                      {f.reason_key && (
                        <p>
                          <span className="text-[var(--d-muted)]">Logged as </span>
                          <Ticks text={f.reason_key} />
                        </p>
                      )}
                      <CodeRef file={f.file} line={f.line} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </Panel>

        <div className="space-y-5">
          <Panel title="When is a supplier ready to close?" aside={<CodeRef file="starter-kit/arena_kit/agents/procudeal/policy.py" line={352} />}>
            <ol className="space-y-2 p-4 text-[12.5px]">
              {code.ready_flow.map((r) => (
                <li key={r.order} className="grid grid-cols-[22px_1fr] gap-2">
                  <span className={`${s.plate} text-[16px] text-[var(--d-muted)]`}>{r.order}</span>
                  <span>
                    <span className="block">
                      <Ticks text={r.condition} />
                    </span>
                    <span className="block text-[var(--d-ink-2)]">
                      Ready as: <Ticks text={r.returns} />
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="How the counter price is set">
            <p className="border-b border-[var(--d-line-soft)] px-4 py-3 text-[13px] leading-relaxed text-[var(--d-ink-2)]">{code.pricing.summary}</p>
            <ol className="divide-y divide-[var(--d-line-soft)]">
              {code.pricing.steps.map((p, i) => (
                <li key={p.name} className="grid gap-1.5 px-4 py-3 text-[12.5px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      <span className="mr-2 text-[var(--d-muted)]">{i + 1}</span>
                      {p.name}
                    </span>
                    <CodeRef file={p.file} line={p.line} />
                  </div>
                  <code className={`${s.code} block whitespace-pre-wrap rounded bg-[var(--d-sunk)] px-2 py-1.5 !text-[11.5px]`}>{p.formula}</code>
                  <p className="text-[var(--d-ink-2)]">{p.explain}</p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>

      <Panel
        title={`Every constant that shapes a move (${code.constants.length})`}
        aside={
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter constants"
            className="w-[200px] rounded-md border border-[var(--d-line)] bg-[var(--d-panel-2)] px-2 py-1 text-[12px] text-[var(--d-ink)] placeholder:text-[var(--d-muted)]"
          />
        }
      >
        <div className={`${s.scrollPane} max-h-[420px] overflow-auto`}>
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-[var(--d-panel)] text-left text-[11.5px] text-[var(--d-muted)]">
              <tr>
                <th className="px-4 py-2 font-normal">Name</th>
                <th className="py-2 pr-3 font-normal">Value</th>
                <th className="py-2 pr-3 font-normal">What it does</th>
                <th className="py-2 pr-4 font-normal">Where</th>
              </tr>
            </thead>
            <tbody>
              {constants.map((c) => (
                <tr key={`${c.file}${c.name}`} className="border-t border-[var(--d-line-soft)] align-top">
                  <td className={`${s.code} px-4 py-1.5 !text-[11.5px] font-semibold`}>{c.name}</td>
                  <td className={`${s.code} max-w-[280px] py-1.5 pr-3 !text-[11.5px] break-words`}>{fmtValue(c.value)}</td>
                  <td className="py-1.5 pr-3 text-[var(--d-ink-2)]">{c.meaning}</td>
                  <td className="py-1.5 pr-4">
                    <CodeRef file={c.file} line={c.line} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function fmtValue(v: unknown): ReactNode {
  if (v === null || v === undefined) return "None";
  if (typeof v === "object") return JSON.stringify(v).replaceAll(",", ", ").replaceAll(":", ": ");
  return String(v);
}
