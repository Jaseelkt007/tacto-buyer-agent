"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { sheetPrice, sheetTerms, shortCase, shortName, type Decision, type Session, type TimelineEvent } from "@/lib/demo";
import { s } from "./styles";
import { eur, eurK, KindBadge, Panel, Tag } from "./ui";

const STATUS_TONE: Record<string, "neutral" | "good" | "warn" | "bad"> = { open: "neutral", agreed: "good", final_offer: "warn", withdrawn: "bad" };
const STEP_NAMES: [number, string][] = [
  [0.3, "STEP 0.30: close 30 % of the gap"],
  [0.1, "HOLD_STEP 0.10: it dropped deep, hold"],
  [0.45, "STUCK_STEP 0.45: it said it is stuck"],
];

type Point = { t: number; x: number; price: number; who: "supplier" | "buyer"; ev: TimelineEvent };

/** Every e-mail with a price, in the order they happened, so RFQ threads share one x axis. */
function pricedPoints(session: Session) {
  const pts: Point[] = [];
  let x = 0;
  for (const ev of session.timeline) {
    if (ev.kind === "supplier_email") {
      const p = sheetPrice(ev.term_sheets[0]);
      if (p !== null) pts.push({ t: ev.t_index, x: x++, price: p, who: "supplier", ev });
    } else if (ev.kind === "buyer_email") {
      const p = typeof ev.decision?.price === "number" ? ev.decision.price : sheetPrice(ev.term_sheets[0]);
      if (p !== null) pts.push({ t: ev.t_index, x: x++, price: p, who: "buyer", ev });
    }
  }
  return { pts, n: x };
}

export function Replay({ sessions }: { sessions: Session[] }) {
  const [pick, setPick] = useState(0);
  const session = sessions[pick];
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" role="tablist" aria-label="Recorded sessions">
        {sessions.map((x, i) => (
          <button
            key={x.meta.session_id}
            role="tab"
            aria-selected={i === pick}
            type="button"
            onClick={() => setPick(i)}
            className={`rounded-lg border px-3 py-2.5 text-left ${i === pick ? "border-[var(--d-ink)] bg-[var(--d-panel)] shadow-[inset_0_0_0_1px_var(--d-ink)]" : "border-[var(--d-line)] bg-[var(--d-panel-2)] hover:bg-[var(--d-panel)]"}`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className={`${s.plate} text-[20px]`}>{shortCase(x.meta.case_id)}</span>
              <span className="text-[11.5px] text-[var(--d-muted)]">{x.meta.note}</span>
            </div>
            <div className="mt-0.5 truncate text-[12.5px] text-[var(--d-ink-2)]">{x.meta.title}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Tag tone={x.meta.score >= 0.7 ? "good" : x.meta.score > 0 ? "warn" : "bad"}>score {x.meta.score.toFixed(2)}</Tag>
              <Tag>{x.suppliers.length > 1 ? `RFQ, ${x.suppliers.length} suppliers` : "1 supplier"}</Tag>
              <Tag tone={x.stop.category === "accepted" ? "good" : "bad"}>{x.stop.category.replaceAll("_", " ")}</Tag>
            </div>
          </button>
        ))}
      </div>
      <Player key={session.meta.session_id} session={session} />
    </div>
  );
}

function Player({ session }: { session: Session }) {
  const [showBack, setShowBack] = useState(true);
  const steps = useMemo(() => session.timeline.filter((e) => showBack || e.kind !== "backoffice"), [session, showBack]);
  const [at, setAt] = useState(0);
  const [playing, setPlaying] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const cur = steps[Math.min(at, steps.length - 1)];
  const { pts } = useMemo(() => pricedPoints(session), [session]);
  const names = useMemo(() => Object.fromEntries(session.suppliers.map((x) => [x.id, x.name])), [session]);

  const live = playing && at < steps.length - 1; // playback stops by itself on the last step
  useEffect(() => {
    if (!live) return;
    const id = setTimeout(() => setAt((a) => a + 1), cur?.kind === "backoffice" ? 900 : 2200);
    return () => clearTimeout(id);
  }, [live, at, cur]);
  const togglePlay = () => {
    if (live) return setPlaying(false);
    if (at >= steps.length - 1) setAt(0);
    setPlaying(true);
  };

  useEffect(() => {
    // scroll only the step list, never the page around it
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-i="${at}"]`);
    if (list && row) {
      const top = row.offsetTop; // the list is position:relative, so this is relative to it
      if (top < list.scrollTop) list.scrollTop = top;
      else if (top + row.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = top + row.offsetHeight - list.clientHeight;
    }
  }, [at]);

  const onKeys = (e: ReactKeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      setAt((a) => Math.min(steps.length - 1, a + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setAt((a) => Math.max(0, a - 1));
    } else if (e.key === " ") {
      e.preventDefault();
      togglePlay();
    } else if (e.key === "Home") setAt(0);
    else if (e.key === "End") setAt(steps.length - 1);
  };

  const jumpTo = (t: number) => {
    const i = steps.findIndex((e) => e.t_index === t);
    if (i >= 0) setAt(i);
  };

  const m = session.meta;
  const moves = session.timeline.filter((e) => e.decision);
  const llmMoves = moves.filter((e) => e.decision?.source !== "engine").length;
  const emails = session.timeline.filter((e) => e.kind === "supplier_email" || e.kind === "buyer_email").length;

  return (
    <div className="space-y-4">
      <Panel>
        <div className="grid gap-x-8 gap-y-4 p-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <div className="text-[12px] text-[var(--d-muted)]">
              {m.type.replaceAll("_", " ")}, goal {m.category_goal ?? "—"}, engine {m.note.replace("engine ", "")} at {m.commit}
            </div>
            <h2 className={`${s.plate} mt-1 text-[26px]`}>{m.title}</h2>
            {m.briefing && <p className="mt-2 max-w-[76ch] text-[13px] leading-relaxed text-[var(--d-ink-2)]">{m.briefing}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11.5px]">
              {(m.negotiable ?? []).map((f) => (
                <Tag key={f} tone="buyer">
                  negotiable: {f}
                </Tag>
              ))}
              {(m.must_haves ?? []).map((h) => (
                <Tag key={h.field} tone="warn">
                  must-have: {h.field} {h.op} {String(h.value)}
                </Tag>
              ))}
            </div>
          </div>
          <div className="min-w-0 space-y-3">
            <ScoreScale session={session} />
            <dl className="grid grid-cols-4 gap-3 text-[12px]">
              <Mini k="E-mails" v={emails} />
              <Mini k="Our moves" v={moves.length} />
              <Mini k="Model calls" v={llmMoves} tone={llmMoves ? "var(--d-llm)" : undefined} />
              <Mini k="Wall clock" v={`${Math.round(m.seconds)} s`} />
            </dl>
          </div>
        </div>
      </Panel>

      <Corridor session={session} pts={pts} names={names} currentT={cur?.t_index ?? 0} onPick={jumpTo} />

      <div data-keys tabIndex={0} onKeyDown={onKeys} className="grid min-h-[560px] gap-4 rounded-lg outline-none lg:grid-cols-[340px_minmax(0,1fr)]" aria-label="Replay player: arrow keys step, space plays">
        <Panel
          className="flex max-h-[680px] flex-col"
          title={
            <span className="flex items-center gap-2">
              Step {at + 1} of {steps.length}
            </span>
          }
          aside={
            <label className="flex cursor-pointer items-center gap-1.5">
              <input type="checkbox" checked={showBack} onChange={(e) => setShowBack(e.target.checked)} className="accent-[var(--d-supplier)]" />
              supplier back office
            </label>
          }
        >
          <div className="flex items-center gap-1.5 border-b border-[var(--d-line-soft)] px-3 py-2">
            <CtlButton onClick={() => setAt(0)} label="First step">
              ⏮
            </CtlButton>
            <CtlButton onClick={() => setAt((a) => Math.max(0, a - 1))} label="Previous step">
              ‹
            </CtlButton>
            <button
              type="button"
              onClick={togglePlay}
              className="rounded border border-[var(--d-ink)] bg-[var(--d-ink)] px-3 py-1 text-[12px] font-medium text-[var(--d-panel)]"
            >
              {live ? "Pause" : "Play"}
            </button>
            <CtlButton onClick={() => setAt((a) => Math.min(steps.length - 1, a + 1))} label="Next step">
              ›
            </CtlButton>
            <CtlButton onClick={() => setAt(steps.length - 1)} label="Last step">
              ⏭
            </CtlButton>
            <span className="ml-auto text-[11px] text-[var(--d-muted)]">← → space</span>
          </div>
          <ol ref={listRef} className={`${s.scrollPane} relative min-h-0 flex-1 overflow-y-auto py-1`}>
            {steps.map((e, i) => (
              <li key={e.t_index} data-i={i}>
                <button
                  type="button"
                  onClick={() => setAt(i)}
                  className={`flex w-full items-start gap-2.5 px-3 py-1.5 text-left text-[12.5px] ${i === at ? "bg-[var(--d-buyer-wash)]" : i < at ? "" : "opacity-60"} hover:bg-[var(--d-panel-2)]`}
                >
                  <EventGlyph e={e} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-1.5">
                      <span className="font-medium">{eventTitle(e)}</span>
                      <span className="ml-auto shrink-0 text-[10.5px] tabular-nums text-[var(--d-muted)]">r{e.round}</span>
                    </span>
                    <span className="block truncate text-[11.5px] text-[var(--d-muted)]">{eventSub(e, names)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </Panel>
        <div className="min-w-0">{cur && <EventDetail key={cur.t_index} e={cur} session={session} names={names} prevOurs={prevOurs(session, cur)} />}</div>
      </div>

      <Panel>
        <div className="flex flex-wrap items-start gap-3 p-4">
          <Tag tone={session.stop.category === "accepted" ? "good" : "bad"}>Why it stopped</Tag>
          <p className="min-w-0 flex-1 text-[13.5px] leading-relaxed">{session.stop.why}</p>
        </div>
        <p className="border-t border-[var(--d-line-soft)] px-4 py-3 text-[12.5px] leading-relaxed text-[var(--d-ink-2)]">{session.pick}</p>
      </Panel>
    </div>
  );
}

function Mini({ k, v, tone }: { k: string; v: ReactNode; tone?: string }) {
  return (
    <div>
      <dt className="text-[11px] text-[var(--d-muted)]">{k}</dt>
      <dd className={`${s.plate} text-[22px] tabular-nums`} style={tone ? { color: tone } : undefined}>
        {v}
      </dd>
    </div>
  );
}

function CtlButton({ onClick, label, children }: { onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="rounded border border-[var(--d-line)] px-2 py-1 text-[12px] hover:bg-[var(--d-panel-2)]">
      {children}
    </button>
  );
}

/** C_open on the left, C_best on the right: where our deal landed is the score. */
function ScoreScale({ session }: { session: Session }) {
  const m = session.meta;
  const span = m.c_open - m.c_best;
  const pos = m.c_deal !== null && span > 0 ? Math.max(0, Math.min(1, (m.c_open - m.c_deal) / span)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-[var(--d-muted)]">Total cost C over the horizon</span>
        <span className={`${s.plate} text-[26px] tabular-nums`}>{m.score.toFixed(3)}</span>
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-[var(--d-sunk)]">
        <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--d-good)]" style={{ width: `${pos * 100}%` }} />
        {m.c_deal !== null && (
          <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--d-panel)] bg-[var(--d-ink)]" style={{ left: `${pos * 100}%` }} />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] tabular-nums text-[var(--d-ink-2)]">
        <span>C_open {eurK(m.c_open)}</span>
        <span>{m.c_deal !== null ? `deal ${eurK(m.c_deal)}` : m.c_alt !== null ? `no deal: alternative ${eurK(m.c_alt)}` : "no deal, no alternative"}</span>
        <span>C_best {eurK(m.c_best)}</span>
      </div>
    </div>
  );
}

/** One lane per supplier: its prices step down from above, ours step up from below, inside our ceiling. */
function Corridor({
  session,
  pts,
  names,
  currentT,
  onPick,
}: {
  session: Session;
  pts: Point[];
  names: Record<string, string>;
  currentT: number;
  onPick: (t: number) => void;
}) {
  const [hover, setHover] = useState<Point | null>(null);
  const lanes = session.suppliers.map((sup) => {
    const own = pts.filter((p) => p.ev.supplier_id === sup.id);
    const ceilings = own.map((p) => p.ev.decision?.ceiling).filter((c): c is number => typeof c === "number" && c > 0);
    const anchors = own.map((p) => p.ev.decision?.anchor).filter((c): c is number => typeof c === "number" && c > 0);
    return { sup, own, ceiling: ceilings[0] ?? null, anchor: anchors[0] ?? null };
  });
  const n = Math.max(1, pts.length);
  const W = 1000;
  const laneH = session.suppliers.length > 1 ? 150 : 250;
  const padL = 64;
  const padR = 150;
  const xOf = (x: number) => padL + (n === 1 ? 0.5 : x / (n - 1)) * (W - padL - padR);
  const accepted = session.timeline.find((e) => e.kind === "buyer_accept");
  const acceptPrice = accepted ? sheetPrice(session.timeline.find((e) => e.kind === "end")?.term_sheets[0]) : null;

  return (
    <Panel
      title="The price corridor"
      aside={
        <span className="flex flex-wrap items-center gap-3">
          <Key color="var(--d-supplier)">supplier&apos;s price</Key>
          <Key color="var(--d-buyer)">our counter</Key>
          <span className="inline-flex items-center gap-1.5">
            <span className={`${s.hatch} inline-block h-3 w-5 rounded-sm border border-[var(--d-line)]`} />
            above our ceiling
          </span>
        </span>
      }
    >
      <div className="space-y-1 px-2 pb-3 pt-2">
        {lanes.map(({ sup, own, ceiling, anchor }) => {
          const vals = own.map((p) => p.price).concat(ceiling ? [ceiling] : []).concat(anchor ? [anchor] : []);
          if (!vals.length) return null;
          let lo = Math.min(...vals);
          let hi = Math.max(...vals);
          const pad = (hi - lo || hi * 0.05) * 0.18;
          lo -= pad;
          hi += pad;
          const yOf = (v: number) => 14 + (1 - (v - lo) / (hi - lo)) * (laneH - 34);
          const path = (who: Point["who"], upTo = Infinity) => {
            const ps = own.filter((p) => p.who === who && p.t <= upTo);
            return ps.map((p, i) => `${i ? "L" : "M"}${xOf(p.x).toFixed(1)},${yOf(i ? ps[i - 1].price : p.price).toFixed(1)}${i ? ` L${xOf(p.x).toFixed(1)},${yOf(p.price).toFixed(1)}` : ""}`).join(" ");
          };
          const past = own.filter((p) => p.t <= currentT);
          const lastSup = [...past].reverse().find((p) => p.who === "supplier");
          const lastBuy = [...past].reverse().find((p) => p.who === "buyer");
          const won = accepted?.supplier_id === sup.id && currentT >= accepted.t_index;
          // right-edge labels: kept in price order, pushed apart so none overlap
          const labels: { y: number; text: string; fill: string; weight?: number }[] = [];
          if (ceiling !== null) labels.push({ y: yOf(ceiling), text: `ceiling ${eur(ceiling)}`, fill: "var(--d-ink-2)" });
          if (anchor !== null) labels.push({ y: yOf(anchor), text: `anchor ${eur(anchor)}`, fill: "var(--d-muted)" });
          if (lastSup) labels.push({ y: yOf(lastSup.price), text: `its ask ${eur(lastSup.price)}`, fill: "var(--d-ink)" });
          if (won && acceptPrice !== null) labels.push({ y: yOf(acceptPrice), text: `accepted ${eur(acceptPrice)}`, fill: "var(--d-good)", weight: 600 });
          else if (lastBuy) labels.push({ y: yOf(lastBuy.price), text: `our offer ${eur(lastBuy.price)}`, fill: "var(--d-ink-2)" });
          labels.sort((a, b) => a.y - b.y);
          const placed = labels.map((l) => ({ ...l, at: l.y }));
          for (let i = 1; i < placed.length; i++) placed[i].at = Math.max(placed[i].at, placed[i - 1].at + 15);
          const overflow = placed.length ? placed[placed.length - 1].at - (laneH - 8) : 0;
          if (overflow > 0) placed.forEach((l) => (l.at -= overflow));
          return (
            <figure key={sup.id} className="relative">
              <figcaption className="flex items-baseline gap-2 px-2 pt-1 text-[12.5px]">
                <span className="font-semibold">{shortName(sup.name)}</span>
                <span className="text-[11.5px] text-[var(--d-muted)]">
                  {sup.id}, {sup.country}, ended {sup.thread.status.replaceAll("_", " ")}
                </span>
                {won && <Tag tone="good">deal</Tag>}
              </figcaption>
              <svg viewBox={`0 0 ${W} ${laneH}`} className="block h-auto w-full" role="img" aria-label={`Price path with ${sup.name}`}>
                {ceiling !== null && yOf(ceiling) > 14 && (
                  <>
                    <foreignObject x={padL} y={6} width={W - padL - padR} height={Math.max(0, yOf(ceiling) - 6)}>
                      <div className={`${s.hatch} h-full w-full opacity-70`} />
                    </foreignObject>
                    <line x1={padL} x2={W - padR} y1={yOf(ceiling)} y2={yOf(ceiling)} stroke="var(--d-ink-2)" strokeWidth={1} />
                  </>
                )}
                {anchor !== null && <line x1={padL} x2={W - padR} y1={yOf(anchor)} y2={yOf(anchor)} stroke="var(--d-line)" strokeWidth={1} />}
                {placed.map((l) => (
                  <g key={l.text}>
                    {Math.abs(l.at - l.y) > 2 && <line x1={W - padR + 1} x2={W - padR + 6} y1={l.y} y2={l.at} stroke="var(--d-line)" />}
                    <text x={W - padR + 8} y={l.at + 4} fontSize={12} fontWeight={l.weight} fill={l.fill}>
                      {l.text}
                    </text>
                  </g>
                ))}
                <line x1={padL} x2={W - padR} y1={laneH - 18} y2={laneH - 18} stroke="var(--d-line-soft)" />
                {/* playhead */}
                {(() => {
                  const past = pts.filter((p) => p.t <= currentT);
                  if (!past.length) return null;
                  const x = xOf(past[past.length - 1].x);
                  return <line x1={x} x2={x} y1={8} y2={laneH - 18} stroke="var(--d-ink)" strokeOpacity={0.25} strokeWidth={1} />;
                })()}
                <path d={path("supplier")} fill="none" stroke="var(--d-supplier)" strokeOpacity={0.22} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                <path d={path("buyer")} fill="none" stroke="var(--d-buyer)" strokeOpacity={0.22} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                <path d={path("supplier", currentT)} fill="none" stroke="var(--d-supplier)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                <path d={path("buyer", currentT)} fill="none" stroke="var(--d-buyer)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                {own.map((p) => {
                  const future = p.t > currentT;
                  const c = p.who === "supplier" ? "var(--d-supplier)" : "var(--d-buyer)";
                  const status = p.ev.status;
                  return (
                    <g
                      key={p.t}
                      className="cursor-pointer"
                      opacity={future ? 0.25 : 1}
                      onMouseEnter={() => setHover(p)}
                      onMouseLeave={() => setHover(null)}
                      onClick={() => onPick(p.t)}
                    >
                      <circle cx={xOf(p.x)} cy={yOf(p.price)} r={14} fill="transparent" />
                      {status === "final_offer" ? (
                        <rect x={xOf(p.x) - 5.5} y={yOf(p.price) - 5.5} width={11} height={11} fill={c} stroke="var(--d-panel)" strokeWidth={2} transform={`rotate(45 ${xOf(p.x)} ${yOf(p.price)})`} />
                      ) : (
                        <circle cx={xOf(p.x)} cy={yOf(p.price)} r={status === "agreed" ? 6.5 : 5} fill={status === "agreed" ? "var(--d-panel)" : c} stroke={status === "agreed" ? c : "var(--d-panel)"} strokeWidth={status === "agreed" ? 3 : 2} />
                      )}
                      {p.t === currentT && <circle cx={xOf(p.x)} cy={yOf(p.price)} r={10} fill="none" stroke="var(--d-ink)" strokeWidth={1.5} />}
                    </g>
                  );
                })}
                <text x={padL - 8} y={yOf(hi - pad) + 4} fontSize={11} textAnchor="end" fill="var(--d-muted)">
                  {eur(hi - pad, 0)}
                </text>
                <text x={padL - 8} y={yOf(lo + pad) + 4} fontSize={11} textAnchor="end" fill="var(--d-muted)">
                  {eur(lo + pad, 0)}
                </text>
                {hover && hover.ev.supplier_id === sup.id && (
                  <g pointerEvents="none">
                    <rect
                      x={Math.min(xOf(hover.x) + 10, W - padR - 190)}
                      y={Math.max(4, yOf(hover.price) - 40)}
                      width={190}
                      height={34}
                      rx={4}
                      fill="var(--d-ink)"
                    />
                    <text x={Math.min(xOf(hover.x) + 18, W - padR - 182)} y={Math.max(4, yOf(hover.price) - 40) + 14} fontSize={11.5} fill="var(--d-panel)">
                      {hover.who === "supplier" ? `${shortName(names[sup.id] ?? sup.id)}, ${hover.ev.status ?? ""}` : "Our counter"}
                    </text>
                    <text x={Math.min(xOf(hover.x) + 18, W - padR - 182)} y={Math.max(4, yOf(hover.price) - 40) + 28} fontSize={12} fontWeight={600} fill="var(--d-panel)">
                      {eur(hover.price)} per unit, round {hover.ev.round}
                    </text>
                  </g>
                )}
              </svg>
            </figure>
          );
        })}
        <div className="flex flex-wrap gap-4 px-2 pt-1 text-[11.5px] text-[var(--d-muted)]">
          <span>x: every priced e-mail in the order it happened, all threads on one clock</span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden>
              <circle cx="6" cy="6" r="4" fill="none" stroke="var(--d-ink-2)" strokeWidth="2.5" />
            </svg>
            agreed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <svg width="12" height="12" aria-hidden>
              <rect x="2" y="2" width="8" height="8" fill="var(--d-ink-2)" transform="rotate(45 6 6)" />
            </svg>
            final offer
          </span>
          <span>click a point to jump there</span>
        </div>
      </div>
    </Panel>
  );
}

function Key({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg width="16" height="8" aria-hidden>
        <line x1="0" x2="16" y1="4" y2="4" stroke={color} strokeWidth="2" />
        <circle cx="8" cy="4" r="3.5" fill={color} />
      </svg>
      {children}
    </span>
  );
}

function EventGlyph({ e }: { e: TimelineEvent }) {
  const map: Record<string, [string, string]> = {
    supplier_email: ["var(--d-supplier)", "In"],
    buyer_email: ["var(--d-buyer)", "Out"],
    buyer_accept: ["var(--d-good)", "✓"],
    buyer_walk: ["var(--d-bad)", "✕"],
    buyer_timeout: ["var(--d-warn)", "⏱"],
    claim_check: ["var(--d-arena)", "?"],
    backoffice: ["var(--d-muted)", "…"],
    end: ["var(--d-ink)", "■"],
  };
  const [c, t] = map[e.kind] ?? ["var(--d-muted)", "·"];
  return (
    <span
      className="mt-0.5 inline-flex h-[18px] min-w-[26px] shrink-0 items-center justify-center rounded px-1 text-[10px] font-semibold"
      style={{ color: e.kind === "backoffice" ? "var(--d-ink-2)" : "var(--d-panel)", background: e.kind === "backoffice" ? "var(--d-sunk)" : c }}
      aria-hidden
    >
      {t}
    </span>
  );
}

function eventTitle(e: TimelineEvent) {
  switch (e.kind) {
    case "supplier_email":
      return `Supplier e-mail${e.status && e.status !== "open" ? `, ${e.status.replaceAll("_", " ")}` : ""}`;
    case "buyer_email":
      return e.decision?.last_call ? "Our e-mail, auction call" : "Our e-mail";
    case "buyer_accept":
      return "We accept";
    case "buyer_walk":
      return "We walk away";
    case "buyer_timeout":
      return "Thread left to time out";
    case "claim_check":
      return "Arena checks our claims";
    case "backoffice":
      return "Supplier back office";
    case "end":
      return "Session ends";
  }
}

function eventSub(e: TimelineEvent, names: Record<string, string>) {
  const who = e.supplier_id ? shortName(names[e.supplier_id] ?? e.supplier_id) : "";
  if (e.kind === "supplier_email" || e.kind === "buyer_email") {
    const p = e.kind === "buyer_email" && typeof e.decision?.price === "number" ? e.decision.price : sheetPrice(e.term_sheets[0]);
    return `${who}${p !== null ? `, ${eur(p)}` : ""}${e.term_sheets.length > 1 ? `, ${e.term_sheets.length} sheets` : ""}`;
  }
  if (e.kind === "claim_check") return `${who}, ${e.claims.map((c) => c.result).join(", ")}`;
  if (e.kind === "backoffice") return `${e.from ?? ""}: ${e.text ?? ""}`;
  return `${who}${e.text ? `, ${e.text}` : ""}`;
}

/** Our previous counter in the same thread, to read the concession step off the decision. */
function prevOurs(session: Session, cur: TimelineEvent) {
  if (cur.kind !== "buyer_email") return null;
  const before = session.timeline.filter((e) => e.kind === "buyer_email" && e.supplier_id === cur.supplier_id && e.t_index < cur.t_index);
  const last = before[before.length - 1];
  if (!last) return null;
  return typeof last.decision?.price === "number" ? last.decision.price : sheetPrice(last.term_sheets[0]);
}

function EventDetail({ e, session, names, prevOurs }: { e: TimelineEvent; session: Session; names: Record<string, string>; prevOurs: number | null }) {
  const who = e.supplier_id ? names[e.supplier_id] ?? e.supplier_id : "";
  const shell = (badge: ReactNode, title: ReactNode, body: ReactNode, aside?: ReactNode) => (
    <Panel
      className={`${s.enter} h-full`}
      title={
        <span className="flex flex-wrap items-center gap-2">
          {badge}
          {title}
        </span>
      }
      aside={aside}
    >
      <div className="space-y-4 p-4">{body}</div>
    </Panel>
  );

  if (e.kind === "supplier_email") {
    return shell(
      <KindBadge kind="arena" />,
      <span>
        {who} writes{" "}
        {e.status && (
          <Tag tone={STATUS_TONE[e.status] ?? "neutral"}>
            {e.status.replaceAll("_", " ")}
          </Tag>
        )}
      </span>,
      <>
        <Mail text={e.text ?? ""} tone="supplier" />
        <Sheets sheets={e.term_sheets} label="Its term sheet(s)" />
        {(e.missing_fields?.length ?? 0) > 0 && (
          <p className="text-[12.5px] text-[var(--d-ink-2)]">
            Fields it left out (they close on its standard terms from the quote PDF): <b>{e.missing_fields?.join(", ")}</b>
          </p>
        )}
        {e.supplier_reasons.length > 0 && (
          <div>
            <div className="mb-1 text-[12px] font-semibold">What the arena says moved it</div>
            <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] text-[var(--d-ink-2)]">
              {e.supplier_reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {e.signals && Object.values(e.signals).some((v) => v !== null) && (
          <p className="text-[12px] text-[var(--d-muted)]">
            Signals: {Object.entries(e.signals).filter(([, v]) => v !== null).map(([k, v]) => `${k.replaceAll("_", " ")} ${String(v)}`).join(", ")}
          </p>
        )}
      </>,
      e.offer_id,
    );
  }
  if (e.kind === "buyer_email") {
    const d = e.decision;
    return shell(
      <KindBadge kind={d?.source === "engine" ? "template" : "llm"} />,
      <span>Our e-mail to {who}</span>,
      <>
        {d && <WhyPanel d={d} prevOurs={prevOurs} />}
        <Mail text={e.text ?? ""} tone="buyer" subject={e.subject} />
        <Sheets sheets={e.term_sheets} label="Binding term sheets we sent" />
        {e.claims.length > 0 && <ClaimList claims={e.claims} />}
      </>,
      d ? `${d.seconds}s to decide` : undefined,
    );
  }
  if (e.kind === "claim_check") {
    return shell(<KindBadge kind="arena" />, <span>The arena checks the claims we sent {who}</span>, <ClaimList claims={e.claims} />);
  }
  if (e.kind === "backoffice") {
    return shell(
      <Tag tone="supplier">back office</Tag>,
      <span>Inside {who}</span>,
      <>
        <p className="text-[12px] text-[var(--d-muted)]">
          {e.from} to {e.to}. Humans only: our agent never sees this.
        </p>
        <Mail text={e.text ?? ""} tone="supplier" />
      </>,
    );
  }
  if (e.kind === "buyer_accept" || e.kind === "buyer_walk" || e.kind === "buyer_timeout") {
    const d = e.decision;
    return shell(
      <KindBadge kind="code" />,
      <span>{e.kind === "buyer_accept" ? `We accept ${e.term_sheet_id ?? ""}` : e.kind === "buyer_walk" ? "We walk away" : "We let this thread time out"}</span>,
      <>
        <p className="text-[15px] leading-relaxed">{e.text}</p>
        {d && (
          <dl className="grid grid-cols-2 gap-3 text-[12.5px] sm:grid-cols-4">
            <Mini k="Their status" v={<span className="text-[15px]">{String(d.their_status ?? "—")}</span>} />
            <Mini k="Their price" v={<span className="text-[15px]">{eur(sheetPrice({ terms: d.their_terms as never }) ?? undefined)}</span>} />
            <Mini k="Decided by" v={<span className="text-[15px]">{d.source === "engine" ? "engine" : "kit LLM"}</span>} />
            <Mini k="Took" v={<span className="text-[15px]">{d.seconds}s</span>} />
          </dl>
        )}
      </>,
    );
  }
  return shell(
    <Tag tone={session.stop.category === "accepted" ? "good" : "bad"}>end</Tag>,
    <span>Session over: {e.end_reason?.replaceAll("_", " ")}</span>,
    <>
      <p className="text-[15px] leading-relaxed">{session.stop.why}</p>
      {e.term_sheets[0] && <Sheets sheets={e.term_sheets} label="The deal that binds" />}
      {session.meta.cost_breakdown && <Breakdown b={session.meta.cost_breakdown} />}
    </>,
  );
}

function WhyPanel({ d, prevOurs }: { d: Decision; prevOurs: number | null }) {
  const their = typeof d.their_price_on_our_terms === "number" ? d.their_price_on_our_terms : null;
  const price = typeof d.price === "number" ? d.price : null;
  let rule = "";
  if (d.source !== "engine") rule = "The engine raised an exception, so the kit's LLM agent wrote this move (1 model call).";
  else if (d.last_call) rule = `Reverse-auction call: the price at which this supplier would cost us 2 % less (AUCTION_EDGE) than the leader ${String(d.leader)} at C ${eurK(d.leader_c as number)}.`;
  else if (price !== null && prevOurs === null) rule = `First counter: min(anchor ${eur(d.anchor)}, 99 % of its price on our terms), never above the ceiling.`;
  else if (price !== null && prevOurs !== null && their !== null && their !== prevOurs) {
    const share = (price - prevOurs) / (their - prevOurs);
    const named = STEP_NAMES.find(([v]) => Math.abs(v - share) < 0.015);
    const capped = d.ceiling && Math.abs(price - (d.ceiling as number)) < 0.01;
    rule = capped
      ? `Capped at our ceiling ${eur(d.ceiling)}.`
      : named
        ? `${named[1]}: ${eur(prevOurs)} + ${named[0]} × (${eur(their)} − ${eur(prevOurs)}).`
        : `Moved ${(share * 100).toFixed(0)} % of the gap from ${eur(prevOurs)} toward ${eur(their)} (a health-price, frozen-price or 99.8 % cap rule applied).`;
  }
  const rows: [string, ReactNode][] = [];
  if (price !== null) rows.push(["Our price", eur(price)]);
  if (their !== null) rows.push(["Its price on our terms", eur(their)]);
  if (typeof d.anchor === "number") rows.push(["Anchor", eur(d.anchor)]);
  if (typeof d.ceiling === "number") rows.push(["Ceiling", eur(d.ceiling)]);
  if (typeof d.c_main === "number") rows.push(["C of our main sheet", eurK(d.c_main)]);
  if (typeof d.limit === "number") rows.push(["Walk-away limit", eurK(d.limit)]);
  const asks = (d.asks as string[] | undefined) ?? [];
  const traits = (d.traits as string[] | undefined) ?? [];
  const claims = (d.claims as string[] | undefined) ?? [];
  const mix = d.mix as Record<string, unknown> | undefined;
  return (
    <div className="rounded-md border border-[var(--d-buyer)] bg-[var(--d-buyer-wash)] p-3">
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="font-semibold">Why the engine sent this</span>
        <span className="text-[var(--d-ink-2)]">{d.source === "engine" ? "decided in code, 0 model calls" : "kit LLM fallback, 1 model call"}</span>
      </div>
      {rule && <p className="mt-1.5 text-[13px] leading-relaxed">{rule}</p>}
      {rows.length > 0 && (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] sm:grid-cols-3">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[var(--d-muted)]">{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {mix && Object.entries(mix).map(([k, v]) => <Tag key={k}>{`${k} ${typeof v === "object" ? "clause" : String(v)}`}</Tag>)}
        {asks.map((a) => (
          <Tag key={a} tone="supplier">
            it asked: {a}
          </Tag>
        ))}
        {traits.map((a) => (
          <Tag key={a} tone="warn">
            trait: {a}
          </Tag>
        ))}
        {claims.map((c, i) => (
          <Tag key={i} tone="arena">
            claim: {c}
          </Tag>
        ))}
      </div>
    </div>
  );
}

function Mail({ text, tone, subject }: { text: string; tone: "buyer" | "supplier"; subject?: string }) {
  return (
    <div className="rounded-md border border-[var(--d-line)] bg-[var(--d-panel-2)]" style={{ borderLeft: `3px solid var(--d-${tone})` }}>
      {subject && <div className="border-b border-[var(--d-line-soft)] px-3 py-1.5 text-[12px] text-[var(--d-ink-2)]">{subject}</div>}
      <div className="max-h-[300px] overflow-y-auto whitespace-pre-wrap px-3 py-2.5 text-[13px] leading-relaxed">{text}</div>
    </div>
  );
}

function Sheets({ sheets, label }: { sheets: TimelineEvent["term_sheets"]; label: string }) {
  if (!sheets.length) return null;
  const rows = sheets.map(sheetTerms);
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r)))).sort((a, b) => (a === "unit_price" ? -1 : b === "unit_price" ? 1 : a.localeCompare(b)));
  return (
    <div>
      <div className="mb-1 text-[12px] font-semibold">{label}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px] tabular-nums">
          <thead>
            <tr className="text-left text-[var(--d-muted)]">
              <th className="py-1 pr-3 font-normal">field</th>
              {rows.map((_, i) => (
                <th key={i} className="py-1 pr-3 font-normal">
                  {sheets[i].term_sheet_id ?? `sheet ${i + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k} className="border-t border-[var(--d-line-soft)]">
                <td className="py-1 pr-3 text-[var(--d-ink-2)]">{k}</td>
                {rows.map((r, i) => {
                  const v = r[k];
                  return (
                    <td key={i} className={`py-1 pr-3 ${k === "unit_price" ? "font-semibold" : ""}`}>
                      {v === undefined ? "" : v === null ? "none" : typeof v === "object" ? "index clause" : k === "unit_price" ? eur(v as number) : String(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ClaimList({ claims }: { claims: TimelineEvent["claims"] }) {
  return (
    <div>
      <div className="mb-1 text-[12px] font-semibold">Claims and the arena&apos;s verdict</div>
      <ul className="space-y-1.5">
        {claims.map((c, i) => (
          <li key={i} className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
            <Tag tone={c.result === "verified" ? "good" : c.result === "contradicted" ? "bad" : c.result ? "warn" : "neutral"}>{c.result ?? "sent"}</Tag>
            <span className="font-medium">{c.type}</span>
            {c.asserted &&
              Object.entries(c.asserted).map(([k, v]) => (
                <span key={k} className="text-[var(--d-ink-2)]">
                  {k.replaceAll("_", " ")} {String(v)}
                </span>
              ))}
            {c.refs.map((r) => (
              <code key={r} className={`${s.code} rounded bg-[var(--d-sunk)] px-1 !text-[11px]`}>
                {r}
              </code>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Breakdown({ b }: { b: Record<string, number> }) {
  const parts = Object.entries(b).filter(([, v]) => v !== 0);
  const total = parts.reduce((a, [, v]) => a + Math.abs(v), 0) || 1;
  return (
    <div>
      <div className="mb-1 text-[12px] font-semibold">Where the deal&apos;s total cost comes from</div>
      <ul className="space-y-1 text-[12px]">
        {parts.map(([k, v]) => (
          <li key={k} className="grid grid-cols-[150px_1fr_90px] items-center gap-2">
            <span className="text-[var(--d-ink-2)]">{k.replaceAll("_", " ")}</span>
            <span className="h-2 rounded-r-full bg-[var(--d-buyer)]" style={{ width: `${Math.max(1, (Math.abs(v) / total) * 100)}%` }} />
            <span className="text-right tabular-nums">{eurK(v)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
