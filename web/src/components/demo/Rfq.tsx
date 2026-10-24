"use client";

import { useState } from "react";
import { code, sheetPrice, shortName, showcase, type TimelineEvent } from "@/lib/demo";
import { Ticks } from "./DecideFlow";
import { CodeRef, eur, Panel } from "./ui";

export function Rfq() {
  const session = showcase.sessions.find((x) => x.suppliers.length > 1);
  return (
    <div className="space-y-5">
      <p className="max-w-[90ch] text-[14px] leading-relaxed text-[var(--d-ink-2)]">{code.rfq.summary}</p>
      {session && <Swimlanes events={session.timeline} suppliers={session.suppliers.map((x) => ({ id: x.id, name: x.name, status: x.thread.status }))} title={session.meta.title} note={session.meta.note} />}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title="The RFQ rules, in the order they apply">
          <ol className="divide-y divide-[var(--d-line-soft)]">
            {code.rfq.steps.map((st) => (
              <li key={st.order} className="grid grid-cols-[34px_1fr] gap-2 px-4 py-2.5 text-[12.5px]">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--d-buyer-wash)] text-[12px] font-semibold tabular-nums text-[var(--d-buyer)]">{st.order}</span>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold">{st.name}</span>
                    <CodeRef file={st.file} line={st.line} />
                  </div>
                  <div className="text-[var(--d-ink-2)]">
                    <span className="text-[var(--d-muted)]">When </span>
                    <Ticks text={st.condition} />
                  </div>
                  <div>
                    <span className="text-[var(--d-muted)]">Then </span>
                    <Ticks text={st.action} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        <div className="space-y-3">
          <h3 className="text-[13.5px] font-semibold">Scenarios, walked through the code</h3>
          {code.rfq.examples.map((ex, i) => (
            <div key={i} className="rounded-xl border border-[var(--d-line)] bg-[var(--d-panel)] p-5 shadow-[var(--d-shadow)]">
              <div className="mb-1.5 text-[12.5px] font-semibold text-[var(--d-ink-2)]">Scenario {String.fromCharCode(65 + i)}</div>
              <p className="text-[13px] leading-relaxed">{ex}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Mark = { e: TimelineEvent; x: number };

function Swimlanes({ events, suppliers, title, note }: { events: TimelineEvent[]; suppliers: { id: string; name: string; status: string }[]; title: string; note: string }) {
  const [hover, setHover] = useState<Mark | null>(null);
  const shown = events.filter((e) => e.kind !== "backoffice" && e.kind !== "claim_check" && e.kind !== "end");
  const marks: Mark[] = shown.map((e, i) => ({ e, x: i }));
  const W = 1000;
  const rowH = 64;
  const padL = 190;
  const padR = 24;
  const H = suppliers.length * rowH + 28;
  const xOf = (i: number) => padL + (i / Math.max(1, shown.length - 1)) * (W - padL - padR);
  const row = (sid?: string) => suppliers.findIndex((x) => x.id === sid);
  const calls = marks.filter((m) => m.e.decision?.last_call);
  const firstCall = calls[0];

  return (
    <Panel title={`${title}: three threads on one clock`} aside={note}>
      <div className="px-2 pb-3 pt-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="RFQ swimlanes">
          {firstCall && (
            <>
              <rect x={xOf(firstCall.x) - 14} y={4} width={W - padR - xOf(firstCall.x) + 14} height={H - 24} fill="var(--d-buyer-wash)" rx={6} />
              <text x={W - padR - 4} y={H - 8} fontSize={12} textAnchor="end" fill="var(--d-ink-2)">
                reverse auction: last calls to the runner-up
              </text>
            </>
          )}
          {suppliers.map((sup, r) => {
            const y = r * rowH + rowH / 2 + 4;
            const own = marks.filter((m) => m.e.supplier_id === sup.id);
            return (
              <g key={sup.id}>
                <text x={12} y={y - 4} fontSize={13} fontWeight={600} fill="var(--d-ink)">
                  {shortName(sup.name)}
                </text>
                <text x={12} y={y + 13} fontSize={11.5} fill="var(--d-muted)">
                  {sup.id}, ended {sup.status.replaceAll("_", " ")}
                </text>
                <line x1={padL - 10} x2={W - padR} y1={y} y2={y} stroke="var(--d-line)" />
                {own.length > 1 && <line x1={xOf(own[0].x)} x2={xOf(own[own.length - 1].x)} y1={y} y2={y} stroke="var(--d-ink-2)" strokeWidth={2} />}
              </g>
            );
          })}
          {marks.map((m) => {
            const r = row(m.e.supplier_id);
            if (r < 0) return null;
            const y = r * rowH + rowH / 2 + 4;
            const x = xOf(m.x);
            const price = m.e.kind === "buyer_email" && typeof m.e.decision?.price === "number" ? m.e.decision.price : sheetPrice(m.e.term_sheets[0]);
            const above = m.e.kind === "supplier_email";
            return (
              <g key={m.e.t_index} onMouseEnter={() => setHover(m)} onMouseLeave={() => setHover(null)} className="cursor-default">
                <circle cx={x} cy={y} r={13} fill="transparent" />
                <Glyph e={m.e} x={x} y={y} />
                {price !== null && (
                  <text x={x} y={above ? y - 12 : y + 21} fontSize={11} textAnchor="middle" fill="var(--d-ink-2)">
                    {price.toFixed(2)}
                  </text>
                )}
              </g>
            );
          })}
          {hover && (
            <g pointerEvents="none">
              {(() => {
                const r = row(hover.e.supplier_id);
                const y = Math.max(4, r * rowH + rowH / 2 - 38);
                const x = Math.min(xOf(hover.x) + 12, W - 300);
                return (
                  <>
                    <rect x={x} y={y} width={290} height={34} rx={4} fill="var(--d-ink)" />
                    <text x={x + 8} y={y + 14} fontSize={11.5} fill="var(--d-panel)">
                      {label(hover.e)}, round {hover.e.round}
                    </text>
                    <text x={x + 8} y={y + 28} fontSize={11.5} fill="var(--d-panel)">
                      {(hover.e.decision?.why as string | undefined)?.slice(0, 52) ??
                        (sheetPrice(hover.e.term_sheets[0]) !== null ? `${eur(sheetPrice(hover.e.term_sheets[0]))} per unit` : "")}
                    </text>
                  </>
                );
              })()}
            </g>
          )}
        </svg>
        <div className="flex flex-wrap gap-4 px-2 pt-1 text-[11.5px] text-[var(--d-ink-2)]">
          <LegendDot fill="var(--d-supplier)">supplier e-mail (price above)</LegendDot>
          <LegendDot fill="var(--d-buyer)">our counter (price below)</LegendDot>
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="14" aria-hidden>
              <rect x="3" y="3" width="8" height="8" fill="var(--d-buyer)" transform="rotate(45 7 7)" />
            </svg>
            auction call
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="14" height="14" aria-hidden>
              <circle cx="7" cy="7" r="5" fill="var(--d-good)" />
            </svg>
            we accept
          </span>
          <span className="text-[var(--d-muted)]">left to right: every e-mail in the order it happened</span>
        </div>
      </div>
      <p className="border-t border-[var(--d-line-soft)] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--d-ink-2)]">
        Each thread has its own 60-second clock, but the engine answers one thread per move, oldest reply first. A bidder more than 10 % above the leader in total cost gets no more rounds. Once the leader is ready, the best runner-up gets a last call priced so that it would cost us 2 % less than the leader; the calls stop when the best C no longer improves by 0.5 % or after 4 calls.
      </p>
    </Panel>
  );
}

function label(e: TimelineEvent) {
  if (e.kind === "supplier_email") return `Supplier e-mail${e.status ? `, ${e.status.replaceAll("_", " ")}` : ""}`;
  if (e.kind === "buyer_email") return e.decision?.last_call ? `Auction call (leader ${String(e.decision.leader)})` : "Our counter";
  if (e.kind === "buyer_accept") return "We accept";
  if (e.kind === "buyer_walk") return "We walk away";
  if (e.kind === "buyer_timeout") return "Left to time out";
  return e.kind;
}

function Glyph({ e, x, y }: { e: TimelineEvent; x: number; y: number }) {
  if (e.kind === "supplier_email") {
    if (e.status === "final_offer") return <rect x={x - 5.5} y={y - 5.5} width={11} height={11} fill="var(--d-supplier)" stroke="var(--d-panel)" strokeWidth={2} transform={`rotate(45 ${x} ${y})`} />;
    if (e.status === "agreed") return <circle cx={x} cy={y} r={6} fill="var(--d-panel)" stroke="var(--d-supplier)" strokeWidth={3} />;
    return <circle cx={x} cy={y} r={5.5} fill="var(--d-supplier)" stroke="var(--d-panel)" strokeWidth={2} />;
  }
  if (e.kind === "buyer_email") {
    if (e.decision?.last_call) return <rect x={x - 6.5} y={y - 6.5} width={13} height={13} fill="var(--d-buyer)" stroke="var(--d-panel)" strokeWidth={2} transform={`rotate(45 ${x} ${y})`} />;
    return <circle cx={x} cy={y} r={5.5} fill="var(--d-buyer)" stroke="var(--d-panel)" strokeWidth={2} />;
  }
  if (e.kind === "buyer_accept")
    return (
      <g>
        <circle cx={x} cy={y} r={9} fill="var(--d-good)" stroke="var(--d-panel)" strokeWidth={2} />
        <path d={`M${x - 4} ${y} l3 3 l5 -6`} fill="none" stroke="var(--d-panel)" strokeWidth={2} />
      </g>
    );
  if (e.kind === "buyer_walk") return <circle cx={x} cy={y} r={7} fill="var(--d-bad)" />;
  return <circle cx={x} cy={y} r={4} fill="none" stroke="var(--d-warn)" strokeWidth={2} />;
}

function LegendDot({ fill, children }: { fill: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="12" height="12" aria-hidden>
        <circle cx="6" cy="6" r="4.5" fill={fill} />
      </svg>
      {children}
    </span>
  );
}
