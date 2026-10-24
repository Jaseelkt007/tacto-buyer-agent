import type { ReactNode } from "react";
import { money, termLabel, termValue } from "@/lib/format";
import type { Terms } from "@/lib/inbox";
import {
  CLAIM_LABEL,
  COST_LABEL,
  STATUS_LABEL,
  supplierName,
  type Decision,
  type Run,
  type Step,
} from "@/lib/runs";
import { DataId, MailBody } from "../MailBody";
import { BotIcon } from "../icons";

const eur0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const big = (v: number | null | undefined) => (v === null || v === undefined ? "—" : eur0.format(v));

type Tone = "neutral" | "good" | "bad" | "warn" | "accent";

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  const cls: Record<Tone, string> = {
    neutral: "border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink-2)]",
    good: "border-transparent bg-[var(--good-bg)] text-[var(--good)]",
    bad: "border-transparent bg-[var(--bad-bg)] text-[var(--bad)]",
    warn: "border-[var(--warn-border)] bg-[var(--warn-bg)] text-[var(--ink)]",
    accent: "border-[var(--accent-line)] bg-[var(--accent-wash)] text-[var(--accent-ink)]",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-px text-[11.5px] font-medium whitespace-nowrap ${cls[tone]}`}>
      {children}
    </span>
  );
}

const statusTone = (s: string): Tone =>
  s === "agreed" ? "good" : s === "walked_away" ? "bad" : s === "final_offer" ? "warn" : "neutral";

const verdictTone = (r: string): Tone => (r === "verified" ? "good" : r === "contradicted" ? "bad" : "neutral");
const verdictMark = (r: string) => (r === "verified" ? "✓" : r === "contradicted" ? "✗" : "–");

/** Score strip, as on Tacto's slide: opening offer on the left, best possible on the right. */
export function Outcome({ run }: { run: Run }) {
  const r = run.result;
  const open = r.c_open ?? 0;
  const best = r.c_best ?? 0;
  const pos = (c: number | null | undefined) =>
    c === null || c === undefined || open === best ? null : (open - c) / (open - best);
  const deal = pos(r.c_deal);
  const alt = pos(r.c_alt);
  const score = Math.round((r.score ?? 0) * 100);
  return (
    <section className="grid gap-4 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4 md:grid-cols-[auto_1fr]">
      <div className="flex items-end gap-3 md:flex-col md:items-start md:gap-0">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">Score</span>
        <span className="text-[44px] leading-none font-semibold tabular-nums">{score}</span>
        <span className="text-[12px] text-[var(--ink-2)]">
          {r.deal ? "deal" : "no deal"} · {run.end_reason?.replace("_", " ") ?? "—"} · {run.rounds ?? "?"} rounds
        </span>
      </div>
      <div className="space-y-2 self-center">
        <div className="relative h-3 rounded-full bg-[var(--surface-3)]">
          {deal !== null && (
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-[var(--ink)]"
              style={{ width: `${Math.max(0, Math.min(1, deal)) * 100}%` }}
            />
          )}
          {deal !== null && (
            <span
              className="absolute -top-1 h-5 w-0.5 bg-[var(--s-supplier)]"
              style={{ left: `${Math.max(0, Math.min(1, deal)) * 100}%` }}
              title="Our deal"
            />
          )}
          {alt !== null && alt >= 0 && alt <= 1 && (
            <span
              className="absolute -top-1 h-5 w-0 border-l-2 border-dashed border-[var(--ink-2)]"
              style={{ left: `${alt * 100}%` }}
              title="Our alternative (no deal)"
            />
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 text-[12px]">
          <div>
            <div className="text-[var(--muted)] uppercase">Opening offer</div>
            <div className="text-[15px] tabular-nums">{big(r.c_open)}</div>
          </div>
          <div className="text-center">
            <div className="text-[var(--s-supplier)] uppercase">Our deal</div>
            <div className="text-[15px] tabular-nums">{r.deal ? big(r.c_deal) : "none"}</div>
          </div>
          <div className="text-right">
            <div className="text-[var(--muted)] uppercase">Best possible</div>
            <div className="text-[15px] tabular-nums">{big(r.c_best)}</div>
          </div>
        </div>
        <p className="text-[12px] text-[var(--ink-2)]">
          Total cost over the contract.{" "}
          {r.c_alt === null || r.c_alt === undefined ? (
            <>There is no alternative: no deal scores 0.</>
          ) : (
            <>
              Our alternative (walking away) would cost {big(r.c_alt)}
              {alt !== null && alt < 0 ? ", worse than the opening offer" : ""}.
            </>
          )}
          {r.must_haves_ok === false && <strong className="text-[var(--bad)]"> A must-have was broken: score 0.</strong>}
        </p>
      </div>
    </section>
  );
}

/** Where the deal's total cost comes from. One series, so one hue. */
export function CostBreakdown({ parts }: { parts: Record<string, number> }) {
  const rows = Object.entries(parts)
    .filter(([, v]) => Math.abs(v) >= 0.5)
    .sort((a, b) => b[1] - a[1]);
  const price = parts.price ?? 0;
  const extras = rows.filter(([k]) => k !== "price");
  const max = Math.max(1, ...extras.map(([, v]) => Math.abs(v)));
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between text-[13px]">
        <span>Price (units × unit price)</span>
        <span className="font-semibold tabular-nums">{big(price)}</span>
      </div>
      {extras.length > 0 && <div className="text-[12px] text-[var(--muted)]">On top of the price</div>}
      {extras.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[9rem_1fr_6rem] items-center gap-2 text-[13px]">
          <span className="text-[var(--ink-2)]">{COST_LABEL[k] ?? k}</span>
          <span className="h-2 rounded-r bg-[var(--surface-3)]">
            <span className="block h-2 rounded-r bg-[var(--s-ours)]" style={{ width: `${(Math.abs(v) / max) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums">{big(v)}</span>
        </div>
      ))}
    </div>
  );
}

export function BrainSummary({ run, steps }: { run: Run; steps: Step[] }) {
  const ds = run.decisions;
  const engine = ds.filter((d) => d.source === "engine").length;
  const llm = ds.length - engine;
  const think = ds.reduce((s, d) => s + (d.seconds ?? 0), 0);
  const verdicts = steps.flatMap((s) => s.verdicts.map((v) => v.result));
  const by = (r: string) => verdicts.filter((v) => v === r).length;
  const timeouts = run.trace.filter((t) => t.actor === "buyer" && (t.move as { type: string }).type === "timeout").length;
  const rows: [string, ReactNode][] = [
    [
      "Who decided",
      ds.length ? (
        <>
          {engine} by the code engine{llm > 0 && <>, {llm} by the LLM fallback</>}
        </>
      ) : (
        <>This agent ({run.agent}) keeps no decision log; only its e-mails are shown.</>
      ),
    ],
    ["Thinking time", ds.length ? `${think.toFixed(2)} s over ${ds.length} decisions` : "—"],
    [
      "Arguments checked",
      verdicts.length ? (
        <span className="flex flex-wrap gap-1">
          <Pill tone="good">✓ {by("verified")} verified</Pill>
          {by("contradicted") > 0 && <Pill tone="bad">✗ {by("contradicted")} contradicted</Pill>}
          {by("duplicate") > 0 && <Pill>{by("duplicate")} duplicate</Pill>}
          {by("irrelevant") > 0 && <Pill>{by("irrelevant")} irrelevant</Pill>}
        </span>
      ) : (
        "none"
      ),
    ],
    ["Timeouts", timeouts ? <Pill tone="bad">{timeouts} missed the 60 s window</Pill> : "none"],
  ];
  return (
    <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1.5 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[var(--ink-2)]">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Sheets({ sheets }: { sheets: Terms[] }) {
  if (!sheets.length) return null;
  const fields = [...new Set(sheets.flatMap((s) => Object.keys(s)))].sort((a, b) =>
    a === "unit_price" ? -1 : b === "unit_price" ? 1 : 0,
  );
  return (
    <div className="overflow-x-auto rounded border border-[var(--line)]">
      <table className="w-full text-[12.5px]">
        <thead className="bg-[var(--surface-2)] text-left text-[11.5px] text-[var(--ink-2)]">
          <tr>
            <th className="px-2 py-1 font-medium">Term</th>
            {sheets.map((_, i) => (
              <th key={i} className="px-2 py-1 font-medium">
                {i === 0 ? "Main sheet" : `Alt ${i}`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {fields.map((f) => (
            <tr key={f} className="border-t border-[var(--line)]">
              <td className="px-2 py-1 text-[var(--ink-2)]">{termLabel(f)}</td>
              {sheets.map((s, i) => (
                <td key={i} className={`px-2 py-1 ${f === "unit_price" ? "font-semibold" : ""}`}>
                  {f in s ? termValue(f, s[f]) : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Fold({ label, children, open = false }: { label: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group rounded border border-[var(--line)] bg-[var(--surface)]">
      <summary className="cursor-pointer list-none px-2.5 py-1.5 text-[12.5px] text-[var(--ink-2)] select-none hover:bg-[var(--hover)]">
        <span className="mr-1 inline-block transition-transform group-open:rotate-90">▸</span>
        {label}
      </summary>
      <div className="border-t border-[var(--line)] px-3 py-2.5">{children}</div>
    </details>
  );
}

function Metric({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5" title={hint}>
      <div className="text-[11px] text-[var(--muted)]">{label}</div>
      <div className="text-[13.5px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/** What our agent concluded from the supplier's move, in words a person can check. */
function DecisionView({ d, prev }: { d: Decision | null; prev: number | null }) {
  if (!d) {
    return <p className="text-[12.5px] text-[var(--muted)]">No decision log for this move.</p>;
  }
  const llm = d.source !== "engine";
  const headline =
    d.action === "accept"
      ? "Accept this offer"
      : d.action === "walk_away"
        ? "Walk away"
        : d.price !== undefined
          ? `Counter at ${money(d.price)}${d.our_sheets.length > 1 ? ` with ${d.our_sheets.length} sheets` : ""}`
          : "Send a message";
  const step = prev !== null && d.price !== undefined ? d.price - prev : null;
  const room = d.c_main !== undefined && d.limit ? d.c_main / d.limit : null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[14px] font-semibold">{headline}</span>
        {llm ? <Pill tone="warn">LLM fallback</Pill> : <Pill tone="accent">Engine</Pill>}
        <span className="text-[11.5px] text-[var(--muted)] tabular-nums">{(d.seconds * 1000).toFixed(0)} ms</span>
        {d.final_push && <Pill tone="bad">Pushed after a final offer</Pill>}
      </div>
      {d.error && (
        <p className="text-[12.5px] text-[var(--ink-2)]">
          The engine raised <code className="font-mono text-[11.5px]">{d.error}</code>, so the kit&apos;s LLM agent wrote
          this move.
        </p>
      )}
      {d.why && <p className="text-[12.5px] text-[var(--ink-2)]">{d.why}</p>}
      {d.final_push && (
        <p className="text-[12.5px] text-[var(--ink-2)]">
          The supplier had said final offer at {money(d.their_price)}; the agent still asked for less.
        </p>
      )}
      {d.price !== undefined && d.anchor !== undefined && (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          <Metric
            label="Their price, our terms"
            value={money(d.their_price_on_our_terms)}
            hint="Their offer converted to the term mix we propose, so the two are comparable"
          />
          <Metric label="Our offer" value={money(d.price)} hint={step !== null ? `Step from our last offer: ${money(step)}` : "First offer = anchor"} />
          <Metric label="Anchor" value={money(d.anchor)} hint="Our first offer, set from the category goal" />
          <Metric label="Ceiling" value={d.ceiling ? money(d.ceiling) : "none"} hint="Highest price whose total cost stays below the walk-away limit" />
        </div>
      )}
      {room !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-[11.5px] text-[var(--ink-2)]">
            <span>Total cost of our main sheet vs walk-away limit</span>
            <span className="tabular-nums">
              {big(d.c_main)} / {big(d.limit)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--surface-3)]">
            <div className="h-1.5 rounded-full bg-[var(--s-ours)]" style={{ width: `${Math.min(1, room) * 100}%` }} />
          </div>
        </div>
      )}
      {d.claims && d.claims.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-[12px]">
          <span className="text-[var(--ink-2)]">Arguments picked:</span>
          {d.claims.map((c) => (
            <Pill key={c}>{CLAIM_LABEL[c] ?? c}</Pill>
          ))}
        </div>
      )}
    </div>
  );
}

export function StepCard({ caseId, step, prevSupplier, prevOurs }: { caseId: string; step: Step; prevSupplier: number | null; prevOurs: number | null }) {
  const o = step.offer;
  const price = typeof o.terms.unit_price === "number" ? o.terms.unit_price : null;
  const change = price !== null && prevSupplier ? (price - prevSupplier) / prevSupplier : null;
  const reply = step.reply;
  return (
    <article className="grid gap-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3 lg:grid-cols-2">
      {/* Supplier side */}
      <div className="space-y-2.5 lg:border-r lg:border-[var(--line)] lg:pr-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--s-supplier)]" />
          <span className="text-[13px] font-semibold">{supplierName(caseId, step.supplierId)}</span>
          <Pill tone={statusTone(o.status)}>{step.round === 0 && o.status === "open" ? "Opening quote" : (STATUS_LABEL[o.status] ?? o.status)}</Pill>
        </div>
        {price !== null && (
          <div className="flex items-baseline gap-2">
            <span className="text-[20px] font-semibold tabular-nums">{money(price)}</span>
            {change !== null && Math.abs(change) > 0.00005 && (
              <span className="text-[12px] text-[var(--ink-2)] tabular-nums">
                {change < 0 ? "▼" : "▲"} {(Math.abs(change) * 100).toFixed(1)} % vs their last
              </span>
            )}
            {o.alternatives.length > 0 && <span className="text-[12px] text-[var(--muted)]">+{o.alternatives.length} alternative</span>}
          </div>
        )}
        {step.verdicts.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">Checked our arguments</div>
            <ul className="space-y-1 text-[12.5px]">
              {step.verdicts.map((v, i) => (
                <li key={i} className="flex flex-wrap items-center gap-1.5">
                  <Pill tone={verdictTone(v.result)}>
                    {verdictMark(v.result)} {v.result}
                  </Pill>
                  <span>{CLAIM_LABEL[v.claim.type] ?? v.claim.type}</span>
                  {v.claim.refs.map((r) => (
                    <DataId key={r} id={r} />
                  ))}
                </li>
              ))}
            </ul>
          </div>
        )}
        {step.reasons.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">Their reasons</div>
            <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] text-[var(--ink-2)]">
              {step.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {step.inside.length > 0 && (
          <Fold label={`Inside the supplier · ${step.inside.length} internal messages`}>
            <ol className="space-y-1.5 text-[12.5px]">
              {step.inside.map((b, i) => (
                <li key={i} className="grid grid-cols-[minmax(0,9rem)_1fr] gap-2">
                  <span className="truncate text-[var(--ink-2)]" title={`${b.from} → ${b.to}`}>
                    {b.from} → {b.to}
                  </span>
                  <span>{b.text}</span>
                </li>
              ))}
            </ol>
          </Fold>
        )}
        {o.text && (
          <Fold label="Their e-mail">
            <MailBody text={o.text} />
          </Fold>
        )}
      </div>

      {/* Our side */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5">
          <BotIcon className="text-[var(--s-ours)]" />
          <span className="text-[13px] font-semibold">Our agent</span>
        </div>
        {o.status === "walked_away" ? (
          <p className="text-[12.5px] text-[var(--ink-2)]">The supplier ended the thread; nothing left to decide.</p>
        ) : (
          <DecisionView d={step.decision} prev={prevOurs} />
        )}
        {reply?.type === "timeout" && (
          <p className="text-[12.5px] text-[var(--bad)]">No reply within 60 s: counted as a timeout, our last offer repeated.</p>
        )}
        {reply?.type === "accept" && (
          <p className="text-[12.5px]">
            <Pill tone="good">✓ Accepted</Pill> <DataId id={reply.offer_id ?? ""} />
          </p>
        )}
        {reply?.type === "walk_away" && <Pill tone="bad">Walked away</Pill>}
        {reply?.type === "message" && (
          <>
            <Sheets sheets={(reply.term_sheets ?? []).map((t) => t.terms)} />
            {reply.refs && reply.refs.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 text-[12px]">
                <span className="text-[var(--ink-2)]">Cited:</span>
                {reply.refs.map((r) => (
                  <DataId key={r} id={r} />
                ))}
              </div>
            )}
            <Fold label={`Our e-mail${reply.subject ? `: ${reply.subject}` : ""}`}>
              <MailBody text={reply.body ?? ""} />
            </Fold>
          </>
        )}
        {!reply && o.status !== "walked_away" && <p className="text-[12.5px] text-[var(--muted)]">No move recorded after this.</p>}
      </div>
    </article>
  );
}
