"use client";

import { useState } from "react";
import { code, showcase, stats, type RunRow } from "@/lib/demo";
import { Ticks } from "./DecideFlow";
import { s } from "./styles";
import { CodeRef, KindBadge, Panel, Pre, Seg, Tag } from "./ui";

export function Prompts() {
  const fb = code.llm.fallback;
  const sample = showcase.sessions.find((x) => x.meta.case_id === "case:P01")?.timeline.find((e) => e.kind === "buyer_email") ?? showcase.sessions[0].timeline.find((e) => e.kind === "buyer_email");
  const [side, setSide] = useState<"template" | "llm">("template");

  return (
    <div className="space-y-5">
      <Panel title="Model calls per phase of a case">
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead className="text-left text-[11.5px] text-[var(--d-muted)]">
              <tr>
                <th className="px-4 py-2 font-normal">Step</th>
                <th className="py-2 pr-3 font-normal">Runs</th>
                <th className="py-2 pr-3 font-normal">Done by</th>
                <th className="py-2 pr-3 text-right font-normal">Model calls</th>
                <th className="py-2 pr-4 font-normal">Code</th>
              </tr>
            </thead>
            <tbody>
              {code.stages.map((st) => (
                <tr key={st.id} className={`border-t border-[var(--d-line-soft)] ${st.kind === "llm" ? "bg-[var(--d-llm-wash)]" : ""}`}>
                  <td className="px-4 py-1.5 font-medium">{st.name}</td>
                  <td className="py-1.5 pr-3 text-[var(--d-ink-2)]">{st.when}</td>
                  <td className="py-1.5 pr-3">
                    <KindBadge kind={st.kind} />
                  </td>
                  <td className="py-1.5 pr-3 text-right text-[14px] font-semibold tabular-nums">{st.kind === "llm" ? "1" : "0"}</td>
                  <td className="py-1.5 pr-4">
                    <CodeRef file={st.file} line={st.line} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[var(--d-line-soft)] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--d-ink-2)]">
          <Ticks text={`${code.llm.engine_note} The one call: ${fb.calls_per_move}`} />
        </p>
      </Panel>

      <MovesStrip runs={stats.runs} />

      <div className="flex flex-wrap items-center gap-3">
        <Seg
          label="Which text generator"
          value={side}
          onChange={setSide}
          options={[
            { value: "template", label: "The engine's e-mail template (every move)" },
            { value: "llm", label: "The fallback LLM prompt (on exception)" },
          ]}
        />
      </div>

      {side === "template" ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <Panel title="writer.offer_email, line by line" aside={<CodeRef file={code.email_template.file} line={code.email_template.line} />}>
            <ol className="divide-y divide-[var(--d-line-soft)]">
              {code.email_template.verbatim_lines.map((l, i) => (
                <li key={i} className="grid gap-2 px-4 py-2 text-[12.5px] sm:grid-cols-[200px_1fr]">
                  <span className="text-[var(--d-muted)]">
                    <Ticks text={l.condition} />
                  </span>
                  <span className={l.text.startsWith("f\"") || l.text.includes("{") ? `${s.code} !text-[11.5px]` : ""}>{l.text}</span>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="What it produced in a real run" aside={sample?.decision ? `${sample.supplier_id}, round ${sample.round}` : undefined}>
            <div className="space-y-3 p-4">
              <p className="text-[12.5px] text-[var(--d-ink-2)]">
                Every figure in this e-mail sits inside a claim sentence built by <code className={`${s.code} !text-[11.5px]`}>claims.py</code> from the data package. The binding numbers travel in the term sheets, not the text.
              </p>
              <Pre max="max-h-[520px]">{sample?.text}</Pre>
            </div>
          </Panel>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <Panel
            title={
              <span className="flex items-center gap-2">
                System prompt <KindBadge kind="llm" />
              </span>
            }
            aside={<CodeRef file="starter-kit/arena_kit/agents/llm.py" line={fb.system_prompt_line} />}
          >
            <div className="p-4">
              <Pre max="max-h-[560px]">{fb.system_prompt}</Pre>
            </div>
          </Panel>
          <div className="space-y-5">
            <Panel title="User message, rebuilt every fallback move" aside={<CodeRef file="starter-kit/arena_kit/agents/llm.py" line={fb.user_prompt_line} />}>
              <ol className="divide-y divide-[var(--d-line-soft)]">
                {fb.user_prompt_structure.map((u) => (
                  <li key={u.section} className="px-4 py-2 text-[12.5px]">
                    <div className="font-semibold">{u.section}</div>
                    <div className={`${s.code} mt-0.5 !text-[11.5px] text-[var(--d-ink-2)]`}>{u.content}</div>
                  </li>
                ))}
              </ol>
            </Panel>
            <Panel title="What happens around the call">
              <dl className="space-y-3 p-4 text-[12.5px] leading-relaxed">
                <Row k="Trigger">{fb.trigger}</Row>
                <Row k="Timeout">
                  {fb.timeout_s} s per request. <span className="text-[var(--d-bad)]">{fb.timeout_note}</span>
                </Row>
                <Row k="Reply it expects">{fb.expected_reply_schema}</Row>
                <Row k="Guard">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {fb.guard_steps.map((g) => (
                      <li key={g}>{g}</li>
                    ))}
                  </ul>
                </Row>
                <Row k="If the LLM fails">{fb.on_llm_failure}</Row>
                <Row k="Set-up">{fb.complete_constructed_always}</Row>
                <Row k="Settings">
                  <span className="flex flex-wrap gap-1">
                    {fb.provider_env.map((e) => (
                      <Tag key={e}>{e}</Tag>
                    ))}
                  </span>
                </Row>
              </dl>
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[120px_1fr]">
      <dt className="text-[var(--d-muted)]">{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Every recorded run as one column: engine moves stacked under LLM moves. */
function MovesStrip({ runs }: { runs: RunRow[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const sorted = [...runs].sort((a, b) => a.when.localeCompare(b.when));
  const max = Math.max(...sorted.map((r) => r.n_moves));
  const H = 120;
  const unit = H / max;
  const r = hover !== null ? sorted[hover] : null;
  return (
    <Panel
      title={`Who made each move, run by run (${stats.moves.engine} engine, ${stats.moves.kit_llm} LLM)`}
      aside={
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[var(--d-code)]" />
            engine
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[var(--d-llm)]" />
            LLM fallback
          </span>
        </span>
      }
    >
      <div className="px-4 pt-3">
        <div className="h-5 text-[12px] text-[var(--d-ink-2)]">
          {r ? (
            <>
              <b className="text-[var(--d-ink)]">{r.case_id.replace("case:", "")}</b> {r.note}, {r.when.slice(11, 16)} UTC: {r.engine_moves} engine, {r.kit_llm_moves} LLM, score {r.score.toFixed(2)}
              {r.errors.length ? `, error ${r.errors[0]}` : ""}
            </>
          ) : (
            <span className="text-[var(--d-muted)]">Oldest run on the left. Point at a column.</span>
          )}
        </div>
        <div className="flex items-end gap-[2px] overflow-x-auto pb-1" style={{ height: H + 8 }} onMouseLeave={() => setHover(null)}>
          {sorted.map((run, i) => (
            <div
              key={run.file}
              onMouseEnter={() => setHover(i)}
              className={`flex min-w-[6px] flex-1 flex-col justify-end ${hover === i ? "opacity-100" : hover !== null ? "opacity-60" : ""}`}
              style={{ height: H + 8 }}
            >
              {run.kit_llm_moves > 0 && <div className="rounded-t-[3px] bg-[var(--d-llm)]" style={{ height: run.kit_llm_moves * unit - 1, marginBottom: run.engine_moves ? 2 : 0 }} />}
              {run.engine_moves > 0 && <div className={`${run.kit_llm_moves ? "" : "rounded-t-[3px]"} bg-[var(--d-code)]`} style={{ height: run.engine_moves * unit }} />}
            </div>
          ))}
        </div>
        <div className="flex justify-between border-t border-[var(--d-line)] pt-1 text-[11px] text-[var(--d-muted)]">
          <span>{sorted[0]?.when.slice(11, 16)} UTC</span>
          <span>column height: our moves in that session (max {max})</span>
          <span>{sorted[sorted.length - 1]?.when.slice(11, 16)} UTC</span>
        </div>
      </div>
      <div className="mt-2 overflow-x-auto border-t border-[var(--d-line-soft)]">
        <table className="w-full text-[12.5px]">
          <thead className="text-left text-[11.5px] text-[var(--d-muted)]">
            <tr>
              <th className="px-4 py-2 font-normal">Runs where the LLM moved</th>
              <th className="py-2 pr-3 text-right font-normal">LLM moves</th>
              <th className="py-2 pr-4 font-normal">Why</th>
            </tr>
          </thead>
          <tbody>
            {stats.moves.kit_llm_runs.map((k) => (
              <tr key={k.file} className="border-t border-[var(--d-line-soft)]">
                <td className="px-4 py-1.5">
                  {k.case_id.replace("case:", "")} <span className="text-[var(--d-muted)]">{k.note}</span>
                </td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{k.kit_llm_moves}</td>
                <td className="py-1.5 pr-4 text-[var(--d-ink-2)]">{k.cause}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
