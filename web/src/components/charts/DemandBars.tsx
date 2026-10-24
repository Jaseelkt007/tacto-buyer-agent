"use client";

import { useEffect, useRef, useState } from "react";

const H = 200;
const PAD = { top: 14, right: 12, bottom: 28, left: 56 };

/** Monthly quantities: what we called off (solid) and the latest forecast (outlined). One hue; the
 * two states differ by fill, and the legend names them. */
export function DemandBars({ past, future, unit }: { past: { month: string; qty: number }[]; future: { month: string; qty: number }[]; unit: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const bars = [...past.map((b) => ({ ...b, kind: "past" as const })), ...future.map((b) => ({ ...b, kind: "future" as const }))];
  if (!bars.length) return null;
  const max = Math.max(1, ...bars.map((b) => b.qty));
  const iw = w - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const slot = iw / bars.length;
  const bw = Math.max(2, slot - 2);
  const y = (v: number) => PAD.top + ih - (v / max) * ih;
  const ticks = [0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));
  const split = past.length;
  const fmt = (v: number) => v.toLocaleString("en-GB");

  return (
    <figure className="min-w-0 space-y-2">
      <figcaption className="flex flex-wrap gap-x-4 text-[12px] text-[var(--ink-2)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-[var(--s-ours)]" />
          Called off (by requested month)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm border-2 border-dashed border-[var(--s-ours)]" />
          Latest forecast
        </span>
      </figcaption>
      <div ref={box} className="relative w-full overflow-hidden">
        <svg width={w} height={H} className="block" role="img" aria-label={`Monthly quantity in ${unit}`} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line-soft)" />
              <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">
                {fmt(t)}
              </text>
            </g>
          ))}
          {split > 0 && split < bars.length && (
            <g>
              <line x1={PAD.left + split * slot} x2={PAD.left + split * slot} y1={PAD.top - 4} y2={H - PAD.bottom} stroke="var(--ink-2)" strokeDasharray="3 3" />
              <text x={PAD.left + split * slot + 4} y={PAD.top + 6} fontSize={10.5} fill="var(--ink-2)">
                data date
              </text>
            </g>
          )}
          {bars.map((b, i) => {
            const x = PAD.left + i * slot + 1;
            const top = y(b.qty);
            const h = Math.max(0, H - PAD.bottom - top);
            return (
              <g key={b.month} onMouseEnter={() => setHover(i)}>
                <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={ih} fill="transparent" />
                {b.kind === "past" ? (
                  <rect x={x} y={top} width={bw} height={h} rx={Math.min(2, bw / 2)} fill="var(--s-ours)" opacity={hover === null || hover === i ? 1 : 0.55} />
                ) : (
                  <rect
                    x={x + 0.75}
                    y={top + 0.75}
                    width={Math.max(1, bw - 1.5)}
                    height={Math.max(0, h - 0.75)}
                    rx={Math.min(2, bw / 2)}
                    fill="var(--accent-wash)"
                    stroke="var(--s-ours)"
                    strokeWidth={1.5}
                    strokeDasharray="3 2"
                  />
                )}
                {b.month.endsWith("-01") && (
                  <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
                    {b.month.slice(0, 4)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] shadow-md"
            style={{ left: Math.max(0, Math.min(PAD.left + hover * slot + slot, w - 170)) }}
          >
            <div className="font-semibold">{bars[hover].month}</div>
            <div className="tabular-nums">
              {fmt(bars[hover].qty)} {unit} <span className="text-[var(--muted)]">{bars[hover].kind === "past" ? "called off" : "forecast"}</span>
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
