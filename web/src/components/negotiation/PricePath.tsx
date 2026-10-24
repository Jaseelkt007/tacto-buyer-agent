"use client";

import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";

export type PricePoint = { round: number; price: number; label: string };

export type PricePathProps = {
  title: string;
  supplier: PricePoint[];
  ours: PricePoint[];
  ceiling: number | null;
  anchor: number | null;
  /** Round and price the thread ended on, with how it ended. */
  end: { round: number; price: number | null; kind: "deal" | "walked" | "open" } | null;
};

const H = 220;
const PAD = { top: 16, right: 92, bottom: 28, left: 64 };

/** Unit price per round: the supplier's offers against ours, with our walk-away ceiling. */
export function PricePath({ title, supplier, ours, ceiling, anchor, end }: PricePathProps) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(320, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const all = [...supplier, ...ours].map((p) => p.price);
  if (ceiling) all.push(ceiling);
  if (!all.length) return null;
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = Math.max(hi - lo, hi * 0.02);
  const y0 = lo - span * 0.12;
  const y1 = hi + span * 0.12;
  const maxRound = Math.max(1, ...supplier.map((p) => p.round), ...ours.map((p) => p.round));

  const iw = w - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const x = (r: number) => PAD.left + (r / maxRound) * iw;
  const y = (v: number) => PAD.top + (1 - (v - y0) / (y1 - y0)) * ih;
  const path = (pts: PricePoint[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.round)},${y(p.price)}`).join("");

  const ticks = Array.from({ length: 4 }, (_, i) => y0 + ((i + 0.5) / 4) * (y1 - y0));
  const rounds = Array.from({ length: maxRound + 1 }, (_, i) => i);
  const lastS = supplier.at(-1);
  const lastO = ours.at(-1);
  // Keep the two end labels apart when the lines finish close together.
  let sy = lastS ? y(lastS.price) : 0;
  let oy = lastO ? y(lastO.price) : 0;
  if (lastS && lastO && Math.abs(sy - oy) < 14) {
    const mid = (sy + oy) / 2;
    sy = mid + (lastS.price < lastO.price ? 7 : -7);
    oy = mid + (lastS.price < lastO.price ? -7 : 7);
  }

  const at = (r: number) => ({ s: supplier.find((p) => p.round === r), o: ours.find((p) => p.round === r) });
  const h = hover === null ? null : at(hover);

  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-[13px] font-semibold">{title}</span>
        <span className="flex items-center gap-3 text-[12px] text-[var(--ink-2)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-[var(--s-supplier)]" />
            Supplier offer
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-[var(--s-ours)]" />
            Our offer
          </span>
          {ceiling && (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-4 border-t border-dashed border-[var(--ink-2)]" />
              Ceiling
            </span>
          )}
        </span>
      </figcaption>
      <div ref={box} className="relative">
        <svg width={w} height={H} className="block" role="img" aria-label={`${title}: unit price per round`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line-soft)" />
              <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">
                {money(t)}
              </text>
            </g>
          ))}
          {rounds.map((r) => (
            <text key={r} x={x(r)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
              {r === 0 ? "open" : `R${r}`}
            </text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--line)" />}

          {ceiling && (
            <g>
              <line x1={PAD.left} x2={w - PAD.right} y1={y(ceiling)} y2={y(ceiling)} stroke="var(--ink-2)" strokeDasharray="4 4" />
              <text x={PAD.left + 6} y={y(ceiling) - 5} fontSize={11} fill="var(--ink-2)">
                ceiling {money(ceiling)}
              </text>
            </g>
          )}
          {anchor && ours[0] && Math.abs(anchor - ours[0].price) > 0.005 && (
            <text x={x(ours[0].round) + 6} y={y(anchor) + 14} fontSize={10} fill="var(--muted)">
              anchor {money(anchor)}
            </text>
          )}

          <path d={path(supplier)} fill="none" stroke="var(--s-supplier)" strokeWidth={2} strokeLinejoin="round" />
          <path d={path(ours)} fill="none" stroke="var(--s-ours)" strokeWidth={2} strokeLinejoin="round" />
          {supplier.map((p) => (
            <circle key={`s${p.round}`} cx={x(p.round)} cy={y(p.price)} r={4} fill="var(--s-supplier)" stroke="var(--surface)" strokeWidth={2} />
          ))}
          {ours.map((p) => (
            <rect
              key={`o${p.round}`}
              x={x(p.round) - 4}
              y={y(p.price) - 4}
              width={8}
              height={8}
              rx={1}
              fill="var(--s-ours)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ))}
          {end?.kind === "deal" && end.price !== null && (
            <circle cx={x(end.round)} cy={y(end.price)} r={8} fill="none" stroke="var(--good)" strokeWidth={2} />
          )}
          {end?.kind === "walked" && lastS && (
            <g stroke="var(--bad)" strokeWidth={2.5} strokeLinecap="round">
              <line x1={x(end.round) - 5} x2={x(end.round) + 5} y1={y(lastS.price) - 5 - 14} y2={y(lastS.price) + 5 - 14} />
              <line x1={x(end.round) - 5} x2={x(end.round) + 5} y1={y(lastS.price) + 5 - 14} y2={y(lastS.price) - 5 - 14} />
            </g>
          )}

          {lastS && (
            <text x={w - PAD.right + 6} y={sy} dy="0.32em" fontSize={11} fill="var(--ink)">
              {money(lastS.price)}
            </text>
          )}
          {lastO && (
            <text x={w - PAD.right + 6} y={oy} dy="0.32em" fontSize={11} fill="var(--ink)">
              {money(lastO.price)}
            </text>
          )}

          {rounds.map((r) => (
            <rect
              key={`hit${r}`}
              x={x(r) - iw / maxRound / 2}
              y={PAD.top}
              width={iw / maxRound}
              height={ih}
              fill="transparent"
              onMouseEnter={() => setHover(r)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {h && hover !== null && (h.s || h.o) && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-40 rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1.5 text-[12px] shadow-md"
            style={{ left: Math.min(x(hover) + 10, w - 180) }}
          >
            <div className="font-semibold">{hover === 0 ? "Opening" : `Round ${hover}`}</div>
            {h.s && (
              <div className="flex items-center justify-between gap-3 tabular-nums">
                <span className="inline-flex items-center gap-1.5 text-[var(--ink-2)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--s-supplier)]" />
                  {h.s.label}
                </span>
                {money(h.s.price)}
              </div>
            )}
            {h.o && (
              <div className="flex items-center justify-between gap-3 tabular-nums">
                <span className="inline-flex items-center gap-1.5 text-[var(--ink-2)]">
                  <span className="h-2 w-2 rounded-sm bg-[var(--s-ours)]" />
                  {h.o.label}
                </span>
                {money(h.o.price)}
              </div>
            )}
          </div>
        )}
      </div>
    </figure>
  );
}
