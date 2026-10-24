"use client";

import { useEffect, useRef, useState } from "react";

export type TrendUnit = "pct" | "ppm" | "eur" | "num";

const fmt = (u: TrendUnit, v: number) =>
  u === "pct"
    ? `${v.toFixed(1)} %`
    : u === "ppm"
      ? `${Math.round(v).toLocaleString("en-GB")} ppm`
      : u === "eur"
        ? v.toLocaleString("en-GB", { style: "currency", currency: "EUR" })
        : v.toLocaleString("en-GB");

const H = 160;
const PAD = { top: 14, right: 24, bottom: 26, left: 58 };

/** One series over time, with an optional target line and a hover readout. Single series: the
 * title names it, so no legend. */
export function TrendLine({
  title,
  points,
  unit,
  target,
  better = "higher",
}: {
  title: string;
  points: { label: string; value: number; note?: string }[];
  unit: TrendUnit;
  target?: { value: number; label: string };
  better?: "higher" | "lower";
}) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(480);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!points.length) return null;
  const vals = points.map((p) => p.value).concat(target ? [target.value] : []);
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (unit === "ppm" || unit === "eur") lo = Math.min(0, lo);
  const pad = Math.max((hi - lo) * 0.12, Math.abs(hi) * 0.01, 1);
  lo -= lo === 0 ? 0 : pad;
  hi += pad;

  const iw = w - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const n = points.length;
  const x = (i: number) => PAD.left + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * ih;
  const ticks = [0, 1, 2].map((i) => lo + ((i + 0.5) / 3) * (hi - lo));
  const every = Math.ceil(n / Math.max(2, Math.floor(iw / 64)));
  const last = points.at(-1)!;
  const h = hover !== null ? points[hover] : null;

  return (
    <figure className="min-w-0 space-y-1">
      <figcaption className="flex items-baseline justify-between gap-2 text-[12.5px]">
        <span className="font-semibold">{title}</span>
        <span className="text-[var(--ink-2)]">
          latest <span className="font-semibold text-[var(--ink)] tabular-nums">{fmt(unit, last.value)}</span>
          <span className="text-[var(--muted)]"> · {better} is better</span>
        </span>
      </figcaption>
      <div ref={box} className="relative w-full overflow-hidden">
        <svg width={w} height={H} className="block" role="img" aria-label={`${title} per period`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line-soft)" />
              <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10.5} fill="var(--muted)">
                {fmt(unit, t)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % every === 0 || i === n - 1 ? (
              <text
                key={p.label}
                x={x(i)}
                y={H - 8}
                textAnchor={n > 1 && i === n - 1 ? "end" : i === 0 && n > 1 ? "start" : "middle"}
                fontSize={10.5}
                fill="var(--muted)"
              >
                {p.label}
              </text>
            ) : null,
          )}
          {target && (
            <g>
              <line x1={PAD.left} x2={w - PAD.right} y1={y(target.value)} y2={y(target.value)} stroke="var(--ink-2)" strokeDasharray="4 4" />
              <text x={PAD.left + 4} y={y(target.value) - 4} fontSize={10.5} fill="var(--ink-2)">
                {target.label}
              </text>
            </g>
          )}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--line)" />}
          <path
            d={points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join("")}
            fill="none"
            stroke="var(--s-ours)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {points.map((p, i) => (
            <circle
              key={p.label}
              cx={x(i)}
              cy={y(p.value)}
              r={hover === i ? 5 : 3.5}
              fill="var(--s-ours)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ))}
          {points.map((p, i) => (
            <rect
              key={`hit${p.label}`}
              x={x(i) - (n === 1 ? iw : iw / (n - 1)) / 2}
              y={PAD.top}
              width={n === 1 ? iw : iw / (n - 1)}
              height={ih}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] shadow-md"
            style={{ left: Math.max(0, Math.min(x(hover) + 10, w - 170)) }}
          >
            <div className="font-semibold">{h.label}</div>
            <div className="tabular-nums">{fmt(unit, h.value)}</div>
            {h.note && <div className="text-[var(--ink-2)]">{h.note}</div>}
          </div>
        )}
      </div>
    </figure>
  );
}
