"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { checkWindow, extremeWindow, idxId, monthsBack, TOLERANCE_PP, verdict } from "@/lib/indexRules";

const H = 280;
const PAD = { top: 16, right: 20, bottom: 28, left: 70 };

const fmtVal = (v: number) =>
  Math.abs(v) >= 1000 ? v.toLocaleString("en-GB", { maximumFractionDigits: 0 }) : v.toLocaleString("en-GB", { maximumFractionDigits: 3 });
const signed = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)} %`;

/** Parse "#idx:S@2025-11..idx:S@2026-08" or "#idx:S@2026-08" into a window for this series. */
function fromHash(series: string, months: string[]): [string, string] | null {
  const h = decodeURIComponent(location.hash.slice(1));
  const ids = h.split("..").filter((x) => x.startsWith(`idx:${series}@`));
  const ms = ids.map((x) => x.split("@")[1]).filter((m) => months.includes(m));
  if (ms.length === 2) return [ms[0], ms[1]].sort() as [string, string];
  if (ms.length === 1) {
    const from = monthsBack(ms[0], 12);
    return [months.includes(from) ? from : months[0], ms[0]];
  }
  return null;
}

/** The whole series with a selectable window, and the arena's verdict on a figure for that window. */
export function IndexExplorer({ id, name, unit, values }: { id: string; name: string; unit: string | null; values: [string, number][] }) {
  const months = useMemo(() => values.map((v) => v[0]), [values]);
  const last = months.at(-1)!;
  const year = months.includes(monthsBack(last, 12)) ? monthsBack(last, 12) : months[0];
  const [win, setWin] = useState<[string, string]>([year, last]);
  const [figure, setFigure] = useState("");
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(720);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const apply = () => {
      const w = fromHash(id, months);
      if (w) {
        setWin(w);
        document.getElementById("explorer")?.scrollIntoView({ block: "start" });
      }
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [id, months]);

  const check = checkWindow(values, win[0], win[1]);
  const fall = extremeWindow(values, "fall");
  const rise = extremeWindow(values, "rise");
  const fig = figure.trim() === "" ? null : Number(figure.replace(",", ".").replace(/[^\d.+-]/g, ""));
  const v = fig !== null && Number.isFinite(fig) ? verdict(check, fig) : null;

  const vs = values.map((x) => x[1]);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const pad = (hi - lo) * 0.08 || hi * 0.02;
  const y0 = lo - pad;
  const y1 = hi + pad;
  const iw = w - PAD.left - PAD.right;
  const ih = H - PAD.top - PAD.bottom;
  const n = values.length;
  const x = (i: number) => PAD.left + (i / (n - 1)) * iw;
  const y = (val: number) => PAD.top + (1 - (val - y0) / (y1 - y0)) * ih;
  const iA = months.indexOf(check.from);
  const iB = months.indexOf(check.to);
  const ticks = [0, 1, 2, 3].map((i) => y0 + ((i + 0.5) / 4) * (y1 - y0));
  // Axis labels only need as many decimals as the range calls for.
  const tickDigits = y1 - y0 < 1 ? 3 : y1 - y0 < 20 ? 2 : y1 - y0 < 200 ? 1 : 0;
  const fmtTick = (v: number) => v.toLocaleString("en-GB", { maximumFractionDigits: tickDigits, minimumFractionDigits: tickDigits });
  const sentence =
    check.change !== null
      ? `${name} changed ${check.change >= 0 ? "+" : ""}${check.change.toFixed(1)}% from ${check.from} to ${check.to} (${idxId(id, check.from)}, ${idxId(id, check.to)}).`
      : "";

  const preset = (from: string, to: string) => {
    setWin([from, to]);
    setFigure("");
  };

  return (
    <div id="explorer" className="min-w-0 scroll-mt-4 space-y-3">
      <div className="flex flex-wrap items-end gap-2 text-[12.5px]">
        <label className="space-y-0.5">
          <span className="block text-[var(--muted)]">From</span>
          <select value={check.from} onChange={(e) => setWin([e.target.value, win[1]])} className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1">
            {months.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="space-y-0.5">
          <span className="block text-[var(--muted)]">To</span>
          <select value={check.to} onChange={(e) => setWin([win[0], e.target.value])} className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1">
            {months.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </label>
        <span className="mx-1 h-6 w-px bg-[var(--line)]" />
        <button onClick={() => preset(year, last)} className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 hover:bg-[var(--hover)]">
          Last 12 months
        </button>
        {fall && fall.change < 0 && (
          <button onClick={() => preset(fall.from, fall.to)} className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 hover:bg-[var(--hover)]">
            Largest fall ({signed(fall.change)})
          </button>
        )}
        {rise && rise.change > 0 && (
          <button onClick={() => preset(rise.from, rise.to)} className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 hover:bg-[var(--hover)]">
            Largest rise ({signed(rise.change)})
          </button>
        )}
      </div>

      <div ref={box} className="relative w-full overflow-hidden">
        <svg
          width={w}
          height={H}
          className="block"
          role="img"
          aria-label={`${name} per month`}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const i = Math.round(((e.clientX - r.left - PAD.left) / iw) * (n - 1));
            setHover(i >= 0 && i < n ? i : null);
          }}
          onMouseLeave={() => setHover(null)}
        >
          {iA >= 0 && iB >= 0 && (
            <rect x={x(iA)} y={PAD.top} width={Math.max(1, x(iB) - x(iA))} height={ih} fill={check.valid ? "var(--accent-wash)" : "var(--warn-bg)"} />
          )}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line-soft)" />
              <text x={PAD.left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">
                {fmtTick(t)}
              </text>
            </g>
          ))}
          {months.map((m, i) =>
            m.endsWith("-01") ? (
              <text key={m} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
                {m.slice(0, 4)}
              </text>
            ) : null,
          )}
          <path d={values.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p[1])}`).join("")} fill="none" stroke="var(--s-ours)" strokeWidth={2} strokeLinejoin="round" />
          {[iA, iB].map((i) =>
            i >= 0 ? <circle key={i} cx={x(i)} cy={y(values[i][1])} r={5} fill="var(--s-ours)" stroke="var(--surface)" strokeWidth={2} /> : null,
          )}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--line)" />
              <circle cx={x(hover)} cy={y(values[hover][1])} r={3.5} fill="var(--ink)" />
            </g>
          )}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[12px] shadow-md"
            style={{ left: Math.max(0, Math.min(x(hover) + 10, w - 170)) }}
          >
            <div className="font-semibold">{values[hover][0]}</div>
            <div className="tabular-nums">
              {fmtVal(values[hover][1])} {unit && <span className="text-[var(--muted)]">{unit}</span>}
            </div>
            <div className="font-mono text-[10.5px] text-[var(--muted)]">{idxId(id, values[hover][0])}</div>
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5 rounded border border-[var(--line)] bg-[var(--surface-2)] p-3">
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">This window</div>
          <div className="flex flex-wrap items-baseline gap-x-3 tabular-nums">
            <span className="text-[24px] font-semibold">{check.change !== null ? signed(check.change, 2) : "—"}</span>
            <span className="text-[12.5px] text-[var(--ink-2)]">
              {check.from}: {fmtVal(values[iA]?.[1] ?? NaN)} → {check.to}: {fmtVal(values[iB]?.[1] ?? NaN)}
            </span>
          </div>
          {check.valid ? (
            <p className="text-[12.5px] text-[var(--good)]">✓ The arena accepts this window (≤ 12 months apart, ends within the last 12 months of the data).</p>
          ) : (
            <p className="text-[12.5px] text-[var(--bad)]">✗ {check.reason}</p>
          )}
          {check.valid && (
            <div className="space-y-1">
              <div className="text-[11.5px] text-[var(--muted)]">Sentence to cite (figure next to its IDs, one argument per sentence)</div>
              <p className="rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 font-mono text-[11.5px] break-words">{sentence}</p>
            </div>
          )}
        </div>
        <div className="space-y-1.5 rounded border border-[var(--line)] bg-[var(--surface-2)] p-3">
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">Check a figure</div>
          <p className="text-[12.5px] text-[var(--ink-2)]">
            Type the % someone claims for this window (ours or a supplier&apos;s). The arena verifies within ±{TOLERANCE_PP} percentage points.
          </p>
          <input
            value={figure}
            onChange={(e) => setFigure(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. -6.1"
            className="w-32 rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-[14px] tabular-nums"
          />
          {v && (
            <p
              className={`text-[13px] font-semibold ${v === "verified" ? "text-[var(--good)]" : v === "contradicted" ? "text-[var(--bad)]" : "text-[var(--ink-2)]"}`}
            >
              {v === "verified" ? "✓ verified" : v === "contradicted" ? "✗ contradicted (costs trust)" : "– irrelevant: the window is not accepted"}
              {check.change !== null && fig !== null && v !== "irrelevant" && (
                <span className="font-normal text-[var(--ink-2)]"> · off by {Math.abs(fig - check.change).toFixed(2)} pp</span>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
