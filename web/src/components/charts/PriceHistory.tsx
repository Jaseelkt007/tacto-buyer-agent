"use client";

import { useEffect, useRef, useState } from "react";

export type PriceSeries = {
  name: string;
  /** Fixed categorical slot (1–3), by the supplier's order on the part, never by rank. */
  slot: 1 | 2 | 3;
  steps: { from: string; to: string | null; price: number; label: string }[];
};

export type RefLine = { value: number; label: string; style: "cost" | "ask" };

const H = 240;
const PAD = { top: 16, right: 100, bottom: 28, left: 64 };
const COLOR = { 1: "var(--s-ours)", 2: "var(--s-supplier)", 3: "var(--s-3)" } as const;

const eur = (v: number) => v.toLocaleString("en-GB", { style: "currency", currency: "EUR" });
const t = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();

/** Price per supplier over time as steps (a price holds until the next condition), with reference
 * lines for the full cost our agent assumes and the price the supplier now asks. */
export function PriceHistory({ series, refs, end }: { series: PriceSeries[]; refs: RefLine[]; end: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const all = series.flatMap((s) => s.steps);
  if (!all.length) return <p className="text-[13px] text-[var(--muted)]">No price conditions for this part.</p>;
  const x0 = Math.min(...all.map((s) => t(s.from)));
  const x1 = t(end);
  const vals = all.map((s) => s.price).concat(refs.map((r) => r.value));
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = Math.max(hi - lo, hi * 0.03);
  const y0 = lo - span * 0.15;
  const y1 = hi + span * 0.15;

  const iw = w - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (ms: number) => PAD.left + ((ms - x0) / (x1 - x0)) * iw;
  const y = (v: number) => PAD.top + (1 - (v - y0) / (y1 - y0)) * ih;
  const years = [];
  for (let yr = new Date(x0).getUTCFullYear(); yr <= new Date(x1).getUTCFullYear(); yr++) years.push(yr);
  const ticks = [0, 1, 2, 3].map((i) => y0 + ((i + 0.5) / 4) * (y1 - y0));

  const paths = series.map((s) => {
    const d = s.steps
      .map((st, i) => {
        const a = x(t(st.from));
        const b = x(st.to ? t(st.to) : x1);
        return `${i ? "L" : "M"}${a},${y(st.price)}H${b}`;
      })
      .join("");
    return { s, d };
  });

  // Hover by time: what each supplier's price was at the pointer.
  const at = (ms: number) =>
    series
      .map((s) => ({ s, st: s.steps.find((st) => t(st.from) <= ms && (!st.to || ms <= t(st.to))) }))
      .filter((r) => r.st);
  const hv = hover !== null ? at(hover) : [];

  // End labels, nudged apart.
  const ends = series
    .map((s) => ({ s, price: s.steps.at(-1)!.price }))
    .sort((a, b) => b.price - a.price)
    .map((e) => ({ ...e, y: y(e.price) }));
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;

  return (
    <figure className="min-w-0 space-y-2">
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--ink-2)]">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: COLOR[s.slot] }} />
            {s.name}
          </span>
        ))}
        {refs.map((r) => (
          <span key={r.label} className="inline-flex items-center gap-1.5">
            <span className={`w-4 border-t ${r.style === "cost" ? "border-dashed" : "border-dotted border-t-2"} border-[var(--ink-2)]`} />
            {r.label}
          </span>
        ))}
      </figcaption>
      <div ref={box} className="relative w-full overflow-hidden">
        <svg
          width={w}
          height={H}
          className="block"
          role="img"
          aria-label="Price per supplier over time"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const px = e.clientX - r.left;
            setHover(px < PAD.left || px > w - PAD.right ? null : x0 + ((px - PAD.left) / iw) * (x1 - x0));
          }}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={w - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--line-soft)" />
              <text x={PAD.left - 6} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">
                {eur(v)}
              </text>
            </g>
          ))}
          {years.map((yr) => {
            const ms = Date.UTC(yr, 0, 1);
            if (ms < x0 || ms > x1) return null;
            return (
              <g key={yr}>
                <line x1={x(ms)} x2={x(ms)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--line-soft)" />
                <text x={x(ms) + 4} y={H - 8} fontSize={11} fill="var(--muted)">
                  {yr}
                </text>
              </g>
            );
          })}
          {refs.map((r) => (
            <g key={r.label}>
              <line
                x1={PAD.left}
                x2={w - PAD.right}
                y1={y(r.value)}
                y2={y(r.value)}
                stroke="var(--ink-2)"
                strokeDasharray={r.style === "cost" ? "5 4" : "1.5 3"}
                strokeWidth={r.style === "cost" ? 1 : 2}
              />
              <text x={w - PAD.right + 6} y={y(r.value)} dy="0.32em" fontSize={10.5} fill="var(--ink-2)">
                {r.style === "cost" ? "full cost" : "asked"} {eur(r.value)}
              </text>
            </g>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--line)" />}
          {paths.map(({ s, d }) => (
            <path key={s.name} d={d} fill="none" stroke={COLOR[s.slot]} strokeWidth={2} strokeLinejoin="round" />
          ))}
          {series.flatMap((s) =>
            s.steps.map((st) => (
              <circle key={`${s.name}${st.from}`} cx={x(t(st.from))} cy={y(st.price)} r={3.5} fill={COLOR[s.slot]} stroke="var(--surface)" strokeWidth={2} />
            )),
          )}
          {ends.map((e) => (
            <text key={e.s.name} x={w - PAD.right + 6} y={e.y} dy="0.32em" fontSize={11} fill="var(--ink)">
              {eur(e.price)}
            </text>
          ))}
        </svg>
        {hover !== null && hv.length > 0 && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-48 rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] shadow-md"
            style={{ left: Math.max(0, Math.min(x(hover) + 10, w - 230)) }}
          >
            <div className="font-semibold">{new Date(hover).toISOString().slice(0, 7)}</div>
            {hv.map(({ s, st }) => (
              <div key={s.name} className="flex items-center justify-between gap-3 tabular-nums">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-[var(--ink-2)]">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: COLOR[s.slot] }} />
                  <span className="truncate">{st!.label}</span>
                </span>
                {eur(st!.price)}
              </div>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
