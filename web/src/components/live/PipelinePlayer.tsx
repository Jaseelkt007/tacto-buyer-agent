"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PipeFrame } from "@/lib/pipeline";
import { KINDS, type Graph, type Kind } from "./graphs";

const W = 160;
const H = 58;
const fmtT = (t: number) => (t < 10 ? t.toFixed(2) : t.toFixed(1));

function edgePath(g: Graph, a: string, b: string) {
  const A = g.nodes[a];
  const B = g.nodes[b];
  if (!A || !B) return "";
  const ah = A.h ?? H;
  const bh = B.h ?? H;
  if (B.x === A.x) {
    const x = A.x + W / 2;
    const y1 = B.y > A.y ? A.y + ah : A.y;
    const y2 = B.y > A.y ? B.y : B.y + bh;
    return `M${x},${y1} L${x},${y2}`;
  }
  const forward = B.x > A.x;
  const x1 = forward ? A.x + W : A.x;
  const x2 = forward ? B.x : B.x + W;
  const y1 = A.y + ah / 2;
  const y2 = B.y + bh / 2;
  const mx = (x1 + x2) / 2;
  return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
}

function defaultLabel(f: PipeFrame) {
  if (f.label) return f.label;
  if (f.stage === "open") return "Session opens";
  if (f.stage === "prepare") return "Prepare";
  if (f.stage === "close") return "Case closed";
  return f.round === 0 ? "Round 0: first counter" : `Round ${f.round}`;
}

/** Plays frames over a pipeline graph: controls, the diagram with the working box glowing, a detail
 * panel per box, a timeline per part and an event log. */
export function PipelinePlayer({
  graph,
  frames,
  stats,
  links,
  toolbar,
  note,
}: {
  graph: Graph;
  frames: PipeFrame[];
  stats: [string, string, string][];
  links: Partial<Record<string, string>>;
  toolbar?: ReactNode;
  note: string;
}) {
  const n = frames.length;
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [picked, setPicked] = useState<string | null>(null);
  // The canvas keeps its coordinates and is scaled to fit its box (down to 60 %, then it scrolls).
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) =>
      setScale(
        Math.max(0.6, Math.min(1, (e.contentRect.width - 2) / graph.width)),
      ),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, [graph.width]);
  const f = frames[Math.min(i, n - 1)];
  const go = useCallback(
    (k: number) => setI(Math.max(0, Math.min(n - 1, k))),
    [n],
  );

  useEffect(() => {
    if (!playing) return;
    if (i >= n - 1) {
      queueMicrotask(() => setPlaying(false));
      return;
    }
    const id = setTimeout(() => go(i + 1), 1100 / speed);
    return () => clearTimeout(id);
  }, [playing, i, n, speed, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go]);

  const { states, visited } = useMemo(() => {
    const st: Record<string, { round: number; lines: string[] }[]> = {};
    const v = new Set<string>();
    for (const x of frames.slice(0, i + 1)) {
      v.add(x.node);
      if (x.from) v.add(x.from);
      if (x.state?.length)
        (st[x.node] ??= []).push({ round: x.round, lines: x.state });
    }
    return { states: st, visited: v };
  }, [frames, i]);

  const total = useMemo(
    () => Math.max(0.01, ...frames.map((x) => x.t + x.dur)),
    [frames],
  );
  const roundStarts = useMemo(() => {
    const m = new Map<number, number>();
    for (const x of frames)
      if (x.stage === "round" && !m.has(x.round)) m.set(x.round, x.t);
    return [...m.entries()];
  }, [frames]);
  const kinds = useMemo(
    () => [...new Set(Object.values(graph.nodes).map((x) => x.kind))] as Kind[],
    [graph],
  );

  if (!f)
    return (
      <p className="text-[13px] text-[var(--muted)]">Nothing to replay.</p>
    );
  const sel = picked ?? f.node;
  const info = graph.nodes[sel];
  const btn =
    "rounded border border-[var(--line)] bg-[var(--surface)] px-2.5 py-1 text-[12.5px] font-medium hover:bg-[var(--hover)] disabled:opacity-40";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map(([v, l, s]) => (
          <div
            key={l}
            className="min-w-0 border-t-2 border-[var(--ink)] pt-1.5"
          >
            <div className="text-[22px] leading-tight font-semibold tabular-nums">
              {v}
            </div>
            <div className="text-[12px]">{l}</div>
            <div className="text-[11px] text-[var(--muted)]">{s}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        {toolbar}
        <button
          className="rounded bg-[var(--ink)] px-3 py-1 text-[12.5px] font-semibold text-[var(--page)] hover:opacity-90"
          onClick={() =>
            i >= n - 1 ? (go(0), setPlaying(true)) : setPlaying((p) => !p)
          }
        >
          {playing ? "❚❚ Pause" : i >= n - 1 ? "↻ Again" : "▶ Play"}
        </button>
        <button className={btn} onClick={() => (setPlaying(false), go(0))}>
          Restart
        </button>
        <button
          className={btn}
          onClick={() => go(i - 1)}
          disabled={i === 0}
          aria-label="Step back"
        >
          ◀
        </button>
        <button
          className={btn}
          onClick={() => go(i + 1)}
          disabled={i >= n - 1}
          aria-label="Step forward"
        >
          ▶
        </button>
        <div className="flex rounded border border-[var(--line)] bg-[var(--surface)] p-0.5">
          {[1, 2, 5].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`rounded px-2 py-0.5 ${speed === s ? "bg-[var(--ink)] text-[var(--page)]" : "text-[var(--ink-2)]"}`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 font-mono text-[12px] text-[var(--ink-2)]">
        <span>
          <strong className="text-[var(--ink)]">{defaultLabel(f)}</strong> ·
          step {i + 1} / {n}
        </span>
        <span>
          t = <strong className="text-[var(--ink)]">{fmtT(f.t)} s</strong>
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_17rem]">
        <div
          ref={box}
          className="min-w-0 overflow-x-auto rounded-md border border-[var(--line)] bg-[var(--surface)]"
        >
          <div
            style={{ width: graph.width * scale, height: graph.height * scale }}
          >
            <div
              className="relative origin-top-left"
              style={{
                width: graph.width,
                height: graph.height,
                transform: `scale(${scale})`,
              }}
            >
              <svg
                width={graph.width}
                height={graph.height}
                className="absolute inset-0"
                aria-hidden
              >
                <defs>
                  <marker
                    id="arrow"
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M0,0 L8,4 L0,8 z" fill="var(--line)" />
                  </marker>
                  <marker
                    id="arrow-on"
                    viewBox="0 0 8 8"
                    refX="7"
                    refY="4"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M0,0 L8,4 L0,8 z" fill="var(--accent)" />
                  </marker>
                </defs>
                {graph.edges.map(([a, b]) => {
                  const on = f.from === a && f.node === b;
                  return (
                    <path
                      key={`${a}-${b}`}
                      d={edgePath(graph, a, b)}
                      fill="none"
                      stroke={on ? "var(--accent)" : "var(--line)"}
                      strokeWidth={on ? 2.5 : 1.2}
                      className={on ? "flow" : undefined}
                      markerEnd={on ? "url(#arrow-on)" : "url(#arrow)"}
                    />
                  );
                })}
                {f.from &&
                  !graph.edges.some(
                    ([a, b]) => a === f.from && b === f.node,
                  ) && (
                    <path
                      d={edgePath(graph, f.from, f.node)}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth={2.5}
                      className="flow"
                      markerEnd="url(#arrow-on)"
                    />
                  )}
                {graph.columns.map((c) => (
                  <text
                    key={c.text}
                    x={c.x}
                    y={graph.height - 8}
                    fontSize={10.5}
                    fill="var(--muted)"
                  >
                    {c.text}
                  </text>
                ))}
              </svg>
              {Object.entries(graph.nodes).map(([id, nd]) => {
                const active = f.node === id;
                const done = visited.has(id);
                const color = KINDS[nd.kind].color;
                return (
                  <button
                    key={id}
                    onClick={() => setPicked(picked === id ? null : id)}
                    className={`absolute rounded-md border text-left transition-all ${active ? "pulse-ring" : ""} ${sel === id ? "ring-2 ring-[var(--accent)]" : ""}`}
                    style={{
                      left: nd.x,
                      top: nd.y,
                      width: W,
                      height: nd.h ?? H,
                      borderColor: active || done ? color : "var(--line)",
                      background: active
                        ? `color-mix(in oklab, ${color} 22%, var(--surface))`
                        : done
                          ? `color-mix(in oklab, ${color} 8%, var(--surface))`
                          : "var(--surface)",
                      opacity: active || done ? 1 : 0.55,
                      borderLeftWidth: 4,
                    }}
                    title={`${nd.title}: click for details`}
                  >
                    <span className="block px-2 pt-1 text-[12.5px] leading-tight font-semibold">
                      {nd.title}
                    </span>
                    <span className="block px-2 font-mono text-[10.5px] leading-tight text-[var(--ink-2)]">
                      {nd.sub}
                    </span>
                    {done && !active && (
                      <span className="absolute top-1 right-1.5 text-[10px] text-[var(--muted)]">
                        done
                      </span>
                    )}
                    {active && (
                      <span
                        className="absolute top-1 right-1.5 text-[10px] font-semibold"
                        style={{ color }}
                      >
                        now
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {info && (
          <aside className="min-w-0 space-y-2 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3 text-[12.5px]">
            <div className="flex items-center justify-between gap-2">
              <span
                className="rounded px-1.5 py-px text-[10.5px] font-semibold text-white"
                style={{ background: KINDS[info.kind].color }}
              >
                {KINDS[info.kind].label.toUpperCase()}
              </span>
              {picked ? (
                <button
                  onClick={() => setPicked(null)}
                  className="text-[11px] text-[var(--accent-ink)] hover:underline"
                >
                  follow live
                </button>
              ) : (
                <span className="text-[11px] text-[var(--muted)]">
                  following live
                </span>
              )}
            </div>
            <div className="text-[15px] font-semibold">{info.title}</div>
            {[
              ["When", info.when],
              ["Reads", info.reads],
              ["Returns", info.returns],
              ["Checked by", info.check],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {k}
                </div>
                <div>{v}</div>
              </div>
            ))}
            <div className="border-t border-[var(--line)] pt-2">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                In this run, so far
              </div>
              {states[sel]?.length ? (
                <ul className="mt-1 space-y-1">
                  {states[sel].slice(-3).map((s, k) => (
                    <li
                      key={k}
                      className="rounded bg-[var(--surface-2)] px-2 py-1"
                    >
                      {roundStarts.length > 0 && (
                        <div className="text-[10.5px] text-[var(--muted)]">
                          round {s.round}
                        </div>
                      )}
                      {s.lines.map((l, j) => (
                        <div key={j} className="break-words">
                          {l}
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[var(--muted)]">
                  {visited.has(sel)
                    ? "Ran, nothing to report."
                    : "Has not run yet."}
                </p>
              )}
            </div>
            {links[sel] && (
              <Link
                href={links[sel]!}
                className="inline-block pt-1 font-medium text-[var(--accent-ink)] hover:underline"
              >
                Open the full page →
              </Link>
            )}
          </aside>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--ink-2)]">
        {kinds.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: KINDS[k].color }}
            />
            {KINDS[k].label}
          </span>
        ))}
        <span>
          · the glowing box is working now; arrows light up as data moves; click
          any box
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_22rem]">
        <section className="min-w-0 space-y-1 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[14px] font-semibold">Timeline</h3>
            <span className="text-[11px] text-[var(--muted)]">
              x = seconds since the start · very short steps drawn at minimum
              width
            </span>
          </div>
          <div className="overflow-x-auto">
            <div className="relative min-w-[560px]">
              {graph.rows.map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[8.5rem_1fr] items-center gap-2 py-[3px] text-[11.5px]"
                >
                  <span className="truncate text-[var(--ink-2)]">
                    {row.label}
                  </span>
                  <div className="relative h-3.5 rounded-sm bg-[var(--surface-2)]">
                    {roundStarts.map(([r, t0]) => (
                      <span
                        key={r}
                        className="absolute inset-y-0 w-px bg-[var(--line)]"
                        style={{ left: `${(t0 / total) * 100}%` }}
                      />
                    ))}
                    {frames.slice(0, i + 1).map((x, k) =>
                      row.nodes.includes(x.node) ? (
                        <span
                          key={k}
                          className="absolute inset-y-0 rounded-sm"
                          style={{
                            left: `${(x.t / total) * 100}%`,
                            width: `max(3px, ${(x.dur / total) * 100}%)`,
                            background:
                              x.tone === "bad"
                                ? "var(--bad)"
                                : KINDS[graph.nodes[x.node]?.kind ?? "arena"]
                                    .color,
                            opacity: k === i ? 1 : 0.75,
                          }}
                          title={x.log}
                        />
                      ) : null,
                    )}
                    <span
                      className="absolute -inset-y-0.5 w-0.5 bg-[var(--ink)]"
                      style={{ left: `${(f.t / total) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-[8.5rem_1fr] gap-2 pt-1 font-mono text-[10.5px] text-[var(--muted)]">
                <span />
                <div className="relative h-4">
                  {roundStarts
                    .filter(
                      ([, t0], k, arr) =>
                        k === 0 || (t0 - arr[k - 1][1]) / total > 0.04,
                    )
                    .map(([r, t0]) => (
                      <span
                        key={r}
                        className="absolute"
                        style={{ left: `${(t0 / total) * 100}%` }}
                      >
                        R{r}
                      </span>
                    ))}
                  <span className="absolute right-0">{fmtT(total)} s</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="min-w-0 space-y-1 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
          <h3 className="text-[14px] font-semibold">
            Event log{" "}
            <span className="text-[11px] font-normal text-[var(--muted)]">
              newest first
            </span>
          </h3>
          <ol className="max-h-56 space-y-1 overflow-y-auto font-mono text-[11.5px]">
            {frames
              .slice(0, i + 1)
              .slice(-12)
              .reverse()
              .map((x, k) => (
                <li
                  key={`${x.t}-${k}`}
                  className={`flex gap-2 ${k === 0 ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-2)]"}`}
                >
                  <span className="shrink-0 tabular-nums text-[var(--muted)]">
                    {fmtT(x.t).padStart(5, " ")}s
                  </span>
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{
                      background:
                        x.tone === "bad"
                          ? "var(--bad)"
                          : x.tone === "good"
                            ? "var(--good)"
                            : KINDS[graph.nodes[x.node]?.kind ?? "arena"].color,
                    }}
                  />
                  <span className="min-w-0 break-words">{x.log}</span>
                </li>
              ))}
          </ol>
        </section>
      </div>
      <p className="text-[12px] text-[var(--muted)]">
        {note} ← → step, space plays.
      </p>
    </div>
  );
}
