"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { StoryStep, Verdict } from "@/lib/story";
import { DemandBars } from "../charts/DemandBars";
import { DataId } from "../MailBody";
import { PricePath } from "../negotiation/PricePath";
import { CostLegend, CostStack, Sparkline } from "../parts/CostBits";

const eur = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "—"
    : v.toLocaleString("en-GB", { style: "currency", currency: "EUR" });
const eur0 = (v: number | null | undefined) =>
  v === null || v === undefined
    ? "—"
    : v.toLocaleString("en-GB", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      });
const pct = (v: number | null | undefined, d = 1) =>
  v === null || v === undefined
    ? "—"
    : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)} %`;
const AUTOPLAY_MS = 7000;

const VERDICT: Record<string, string> = {
  verified: "bg-[var(--good-bg)] text-[var(--good)]",
  contradicted: "bg-[var(--bad-bg)] text-[var(--bad)]",
  sent: "bg-[var(--accent-wash)] text-[var(--accent-ink)]",
};

function Box({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-2 rounded-md border border-[var(--line)] bg-[var(--surface)] p-3">
      {title && (
        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="text-[11px] text-[var(--muted)]">{label}</div>
      <div className="text-[17px] font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-[var(--ink-2)]">{sub}</div>}
    </div>
  );
}

function Verdicts({ list }: { list: Verdict[] }) {
  return (
    <ul className="space-y-1 text-[12.5px]">
      {list.map((v, i) => (
        <li key={i} className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded px-1.5 py-px text-[11px] font-medium ${VERDICT[v.result] ?? "bg-[var(--surface-3)] text-[var(--ink-2)]"}`}
          >
            {v.result === "verified"
              ? "✓ verified"
              : v.result === "contradicted"
                ? "✗ contradicted"
                : v.result}
          </span>
          <span className="font-medium">{v.type}</span>
          {v.asserted && (
            <span className="text-[var(--ink-2)]">{v.asserted}</span>
          )}
          {v.refs.map((r) => (
            <DataId key={r} id={r} />
          ))}
        </li>
      ))}
    </ul>
  );
}

function Body({ s }: { s: StoryStep }) {
  switch (s.kind) {
    case "open":
      return (
        <div className="grid gap-3 lg:grid-cols-2">
          {s.trigger && (
            <Box title="The letter">
              <div className="text-[13px] font-semibold">{s.trigger.title}</div>
              <div className="text-[12px] text-[var(--ink-2)]">
                {s.trigger.from} · <DataId id={s.trigger.doc_id} />
              </div>
              <p className="text-[12.5px] text-[var(--ink-2)] italic">
                “{s.trigger.excerpt}…”
              </p>
              {s.ask && (s.ask.pct !== null || s.ask.notice !== null) && (
                <div className="flex flex-wrap gap-1.5 text-[12px]">
                  {s.ask.pct !== null && (
                    <span className="rounded bg-[var(--bad-bg)] px-1.5 font-semibold text-[var(--bad)]">
                      asks {pct(s.ask.pct)}
                    </span>
                  )}
                  {s.ask.price !== null && (
                    <span className="rounded border border-[var(--line)] px-1.5">
                      {eur(s.ask.price)}
                    </span>
                  )}
                  {s.ask.from && (
                    <span className="rounded border border-[var(--line)] px-1.5">
                      from {s.ask.from}
                    </span>
                  )}
                  {s.ask.notice !== null && (
                    <span className="rounded border border-[var(--line)] px-1.5">
                      {s.ask.notice} days&apos; notice
                    </span>
                  )}
                </div>
              )}
            </Box>
          )}
          <Box title="The case file">
            <dl className="grid grid-cols-[minmax(6rem,auto)_1fr] gap-x-3 gap-y-1 text-[12.5px]">
              {s.facts.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-[var(--ink-2)]">{k}</dt>
                  <dd className="min-w-0">{v}</dd>
                </div>
              ))}
              <dt className="text-[var(--ink-2)]">Negotiable</dt>
              <dd>
                {s.negotiable.map((n) => n.replace(/_/g, " ")).join(", ")}
              </dd>
              {s.mustHaves.length > 0 && (
                <>
                  <dt className="text-[var(--ink-2)]">Must-haves</dt>
                  <dd>{s.mustHaves.join("; ")} (break one: score 0)</dd>
                </>
              )}
            </dl>
          </Box>
        </div>
      );
    case "supplier":
      return (
        <div className="grid gap-3 lg:grid-cols-2">
          {s.cards.map((c) => (
            <Box key={c.id} title={c.name}>
              <div className="grid grid-cols-2 gap-2">
                <Tile
                  label="Money is worth to it"
                  value={`${(c.rate * 100).toFixed(1)} %`}
                  sub={`${c.owner}; ours 8 %`}
                />
                {c.contract && (
                  <Tile
                    label="On time, 12 months"
                    value={
                      c.contract.otd !== null ? `${c.contract.otd} %` : "—"
                    }
                    sub="target 95 %"
                  />
                )}
                {c.contract && (
                  <Tile
                    label="We pay it late"
                    value={
                      c.contract.lateShare !== null
                        ? `${c.contract.lateShare} %`
                        : "—"
                    }
                    sub={
                      c.contract.lateDays !== null
                        ? `of invoices, ${c.contract.lateDays} days on average`
                        : undefined
                    }
                  />
                )}
                {c.contract && (
                  <Tile
                    label="Price-change notice"
                    value={
                      c.contract.notice !== null
                        ? `${c.contract.notice} days`
                        : "—"
                    }
                    sub={<DataId id={c.contract.id} />}
                  />
                )}
              </div>
              {c.signals.length > 0 ? (
                <ul className="space-y-1 text-[12.5px]">
                  {c.signals.map((g, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded border border-[var(--warn-border)] bg-[var(--warn-bg)] px-1.5 text-[11px]">
                        {g.kind === "cash"
                          ? "needs cash"
                          : g.kind === "work"
                            ? "looks for work"
                            : "capacity full"}
                      </span>
                      <DataId id={g.id} />
                      {g.matches.map((m) => (
                        <q key={m} className="italic text-[var(--ink-2)]">
                          {m}
                        </q>
                      ))}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-[var(--muted)]">
                  No cash, work or capacity signals in its letters or news.
                </p>
              )}
            </Box>
          ))}
        </div>
      );
    case "cost": {
      const max = Math.max(1, ...s.rows.flatMap((r) => [r.price ?? 0, r.full]));
      return (
        <div className="grid gap-3 lg:grid-cols-2">
          <Box title={`Price against full cost, ${s.part.unit}`}>
            {s.rows.length ? (
              <>
                <CostLegend />
                {s.rows.map((r) => (
                  <div key={r.name} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                      <span className="font-medium">{r.name}</span>
                      <DataId id={r.source} />
                      {r.margin !== null && (
                        <span
                          className={
                            r.margin < 0
                              ? "font-semibold text-[var(--bad)]"
                              : "text-[var(--ink-2)]"
                          }
                        >
                          margin {pct(r.margin)}
                        </span>
                      )}
                    </div>
                    <CostStack
                      material={r.material}
                      conversion={r.conversion}
                      overhead={r.overhead}
                      price={r.price}
                      max={max}
                    />
                  </div>
                ))}
              </>
            ) : (
              <p className="text-[12.5px] text-[var(--muted)]">
                No should-cost estimate for this part.
              </p>
            )}
          </Box>
          <Box title="Cost drivers, last 36 months">
            <ul className="space-y-1.5">
              {s.drivers.map((d) => (
                <li
                  key={d.series}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 text-[12.5px]"
                >
                  <span className="min-w-0">
                    <span className="block truncate" title={d.name}>
                      {d.name}
                    </span>
                    <span className="text-[11px] text-[var(--muted)]">
                      {Math.round(d.weight * 100)} % of cost · 12 m{" "}
                      {pct(d.change)}
                    </span>
                  </span>
                  <Sparkline
                    values={d.values.slice(-36)}
                    mark={
                      d.fall
                        ? {
                            from: d.fall.from.split("@")[1],
                            to: d.fall.to.split("@")[1],
                          }
                        : null
                    }
                    width={96}
                  />
                  {d.fall ? (
                    <Link
                      href={`/market/${d.series}#${d.fall.from}..${d.fall.to}`}
                      className="rounded bg-[var(--good-bg)] px-1.5 text-[11px] font-semibold text-[var(--good)] hover:underline"
                    >
                      cite {pct(d.fall.pct)}
                    </Link>
                  ) : (
                    <span className="text-[11px] text-[var(--muted)]">
                      no fall
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 border-t border-[var(--line)] pt-2 text-[12.5px]">
              <span>
                Market moved the cost <strong>{pct(s.implied)}</strong> (
                {Math.round(s.share * 100)} % index-linked)
              </span>
              {s.asked !== null && (
                <span>
                  · asked{" "}
                  <strong className="text-[var(--bad)]">{pct(s.asked)}</strong>
                </span>
              )}
            </div>
          </Box>
        </div>
      );
    }
    case "demand": {
      const vols = s.coverage
        ? [...new Set(s.coverage.map((x) => x.volume))]
        : [];
      const months = s.coverage
        ? [...new Set(s.coverage.map((x) => x.months))]
        : [];
      return (
        <div className="grid gap-3 lg:grid-cols-2">
          <Box title="Called off, last 12 months, and the forecast">
            <DemandBars past={s.past} future={s.future} unit={s.part.uom} />
            <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
              <span>
                Forecast {s.forecast?.toLocaleString("en-GB") ?? "—"} vs{" "}
                {s.calledOff?.toLocaleString("en-GB") ?? "—"} called off:{" "}
                <strong>{pct(s.change)}</strong>
              </span>
              {s.fcId && <DataId id={s.fcId} />}
            </div>
          </Box>
          <div className="min-w-0 space-y-3">
            {s.coverage && (
              <Box title="Coverage trap: extra cost of each option">
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px] tabular-nums">
                    <thead className="text-[var(--ink-2)]">
                      <tr>
                        <th className="py-0.5 text-left font-medium">
                          Volume / year
                        </th>
                        {months.map((m) => (
                          <th key={m} className="py-0.5 text-right font-medium">
                            {m} m
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {vols.map((v) => (
                        <tr key={v} className="border-t border-[var(--line)]">
                          <td className="py-0.5">
                            {v.toLocaleString("en-GB")}
                          </td>
                          {months.map((m) => {
                            const c = s.coverage!.find(
                              (x) => x.volume === v && x.months === m,
                            )!;
                            return (
                              <td
                                key={m}
                                className={`py-0.5 text-right ${c.uncovered === 0 ? "text-[var(--good)]" : "font-semibold text-[var(--bad)]"}`}
                              >
                                {c.uncovered === 0
                                  ? "✓"
                                  : `+${eur0(c.premium)}`}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Box>
            )}
            <Box title="Sources and latest quotes">
              <ul className="space-y-0.5 text-[12.5px]">
                {s.sources.map((x) => (
                  <li key={x.name}>
                    {x.name}{" "}
                    <span className="text-[var(--muted)]">
                      · {x.status} · quota {x.quota} %
                    </span>
                  </li>
                ))}
                {s.rivals.map((q) => (
                  <li
                    key={q.id}
                    className="flex flex-wrap items-center gap-1.5"
                  >
                    <DataId id={q.id} /> {q.supplier} quoted{" "}
                    <strong className="tabular-nums">{eur(q.price)}</strong>
                  </li>
                ))}
                {!s.sources.length && !s.rivals.length && (
                  <li className="text-[var(--muted)]">
                    No source list or RFQs for this part.
                  </li>
                )}
              </ul>
            </Box>
          </div>
        </div>
      );
    }
    case "plan":
      return (
        <div className="space-y-3">
          {s.plans.map((p) => {
            const pts = [
              { k: "Their opening", v: p.opening, c: "var(--s-supplier)" },
              {
                k: "Their price on our terms",
                v: p.theirOnOurs,
                c: "var(--s-supplier)",
              },
              { k: "Our ceiling", v: p.ceiling, c: "var(--ink-2)" },
              {
                k: "Our anchor = first offer",
                v: p.anchor ?? p.offer,
                c: "var(--s-ours)",
              },
            ].filter(
              (x): x is { k: string; v: number; c: string } =>
                x.v !== null && x.v !== undefined,
            );
            const lo = Math.min(...pts.map((x) => x.v));
            const hi = Math.max(...pts.map((x) => x.v));
            const pos = (v: number) =>
              hi === lo ? 50 : ((v - lo) / (hi - lo)) * 100;
            const gap =
              p.theirOnOurs !== null && (p.anchor ?? p.offer) !== null
                ? p.theirOnOurs - (p.anchor ?? p.offer)!
                : null;
            return (
              <Box key={p.name} title={p.name}>
                <div className="space-y-1.5">
                  {[...pts]
                    .sort((a, b) => b.v - a.v)
                    .map((x) => (
                      <div
                        key={x.k}
                        className="grid grid-cols-[minmax(0,11rem)_1fr_5.5rem] items-center gap-2 text-[12.5px]"
                      >
                        <span
                          className="truncate text-[var(--ink-2)]"
                          title={x.k}
                        >
                          {x.k}
                        </span>
                        <span className="relative h-2 rounded-full bg-[var(--surface-3)]">
                          <span
                            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)]"
                            style={{ left: `${pos(x.v)}%`, background: x.c }}
                          />
                        </span>
                        <span className="text-right font-semibold tabular-nums">
                          {eur(x.v)}
                        </span>
                      </div>
                    ))}
                </div>
                {gap !== null && (
                  <p className="text-[12px] text-[var(--ink-2)]">
                    Gap to close: {eur(gap)} between their price on our terms
                    and our first offer. The ceiling is where a deal stops
                    beating our alternative.
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
                  <span
                    className={`rounded px-1.5 text-[11px] font-medium ${p.source === "engine" ? "bg-[var(--accent-wash)] text-[var(--accent-ink)]" : "bg-[var(--warn-bg)]"}`}
                  >
                    {p.source === "engine"
                      ? "Engine (code)"
                      : p.source === "none"
                        ? "no decision log"
                        : "LLM fallback"}
                  </span>
                  {p.source !== "none" && (
                    <span className="text-[var(--muted)]">{p.ms} ms</span>
                  )}
                  {p.sheets > 0 && <span>{p.sheets} term sheets</span>}
                  {p.claims.map((c, i) => (
                    <span
                      key={i}
                      className="rounded border border-[var(--line)] px-1.5 text-[11px]"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </Box>
            );
          })}
        </div>
      );
    case "round":
      return (
        <div className="grid gap-3 lg:grid-cols-[1fr_1.1fr]">
          <div className="min-w-0 space-y-3">
            {s.paths.map((p) => (
              <Box key={p.title}>
                <PricePath {...p} />
              </Box>
            ))}
          </div>
          <div className="min-w-0 space-y-3">
            {s.moves.map((m) => (
              <Box key={m.supplierId}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[var(--s-supplier)]" />
                  <span className="text-[13px] font-semibold">{m.name}</span>
                  <span className="rounded bg-[var(--surface-3)] px-1.5 text-[11px]">
                    {m.status}
                  </span>
                  <span className="ml-auto text-[16px] font-semibold tabular-nums">
                    {eur(m.price)}
                  </span>
                  {m.prev !== null && m.price !== null && (
                    <span className="text-[11.5px] text-[var(--ink-2)]">
                      {pct((m.price / m.prev - 1) * 100)}
                    </span>
                  )}
                </div>
                {m.verdicts.length > 0 && (
                  <div className="space-y-1">
                    <div className="text-[11px] text-[var(--muted)]">
                      It checked our last arguments:
                    </div>
                    <Verdicts list={m.verdicts} />
                  </div>
                )}
                {m.reasons.length > 0 && (
                  <ul className="list-disc pl-5 text-[12px] text-[var(--ink-2)]">
                    {m.reasons.slice(0, 3).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
                {m.inside.length > 0 && (
                  <details className="text-[12px]">
                    <summary className="cursor-pointer text-[var(--ink-2)]">
                      Inside the supplier ({m.inside.length})
                    </summary>
                    <ul className="mt-1 space-y-0.5">
                      {m.inside.map((x, i) => (
                        <li key={i}>
                          <span className="text-[var(--muted)]">
                            {x.from} → {x.to}:
                          </span>{" "}
                          {x.text}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {m.decision && (
                  <div className="space-y-1.5 border-t border-[var(--line)] pt-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                      <span className="h-2.5 w-2.5 rounded-sm bg-[var(--s-ours)]" />
                      <span className="font-semibold">
                        {m.decision.action === "accept"
                          ? "Our agent accepts"
                          : `Our agent counters at ${eur(m.decision.price)}`}
                      </span>
                      {m.decision.source !== "none" && (
                        <span className="text-[11px] text-[var(--muted)]">
                          {m.decision.source === "engine"
                            ? "engine"
                            : "LLM fallback"}{" "}
                          · {m.decision.ms} ms
                        </span>
                      )}
                      {m.decision.finalPush && (
                        <span className="rounded bg-[var(--bad-bg)] px-1.5 text-[11px] text-[var(--bad)]">
                          pushed after a final offer
                        </span>
                      )}
                    </div>
                    {m.decision.why && (
                      <p className="text-[12px] text-[var(--ink-2)]">
                        {m.decision.why}
                      </p>
                    )}
                    {m.sent.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[11px] text-[var(--muted)]">
                          Arguments it sends (checked in the next reply):
                        </div>
                        <Verdicts list={m.sent} />
                      </div>
                    )}
                  </div>
                )}
              </Box>
            ))}
          </div>
        </div>
      );
    case "close": {
      const span = (s.cOpen ?? 0) - (s.cBest ?? 0);
      const at = (c: number | null) =>
        c === null || span <= 0
          ? null
          : Math.max(0, Math.min(1, ((s.cOpen ?? 0) - c) / span)) * 100;
      const extras = s.terms.filter((t) => t.label !== "Price");
      const maxT = Math.max(1, ...extras.map((t) => Math.abs(t.eur)));
      return (
        <div className="grid gap-3 lg:grid-cols-2">
          <Box title="Score">
            <div className="text-[44px] leading-none font-semibold tabular-nums">
              {Math.round(s.score * 100)}
            </div>
            <div className="relative mt-3 h-3 rounded-full bg-[var(--surface-3)]">
              {s.deal && at(s.cDeal) !== null && (
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[var(--ink)]"
                  style={{ width: `${at(s.cDeal)}%` }}
                />
              )}
            </div>
            <div className="grid grid-cols-3 text-[11.5px] tabular-nums">
              <span>
                <span className="block text-[var(--muted)]">opening</span>
                {eur0(s.cOpen)}
              </span>
              <span className="text-center">
                <span className="block text-[var(--s-supplier)]">deal</span>
                {s.deal ? eur0(s.cDeal) : "none"}
              </span>
              <span className="text-right">
                <span className="block text-[var(--muted)]">best</span>
                {eur0(s.cBest)}
              </span>
            </div>
            <p className="text-[12px] text-[var(--ink-2)]">
              score = (opening − deal) ÷ (opening − best). Walking away:{" "}
              {s.cAlt !== null ? eur0(s.cAlt) : "no alternative (0)"}.
            </p>
          </Box>
          <Box
            title={
              s.deal
                ? `Deal at ${eur(s.price)}: cost on top of the price`
                : "No deal"
            }
          >
            {s.deal ? (
              <div className="space-y-1">
                {s.terms
                  .filter((t) => t.label === "Price")
                  .map((t) => (
                    <div
                      key={t.label}
                      className="flex justify-between text-[12.5px]"
                    >
                      <span>Price (units × unit price)</span>
                      <strong className="tabular-nums">{eur0(t.eur)}</strong>
                    </div>
                  ))}
                {extras.map((t) => (
                  <div
                    key={t.label}
                    className="grid grid-cols-[8rem_1fr_5.5rem] items-center gap-2 text-[12.5px]"
                  >
                    <span className="text-[var(--ink-2)]">{t.label}</span>
                    <span className="h-2 rounded-r bg-[var(--surface-3)]">
                      <span
                        className="block h-2 rounded-r bg-[var(--s-ours)]"
                        style={{ width: `${(Math.abs(t.eur) / maxT) * 100}%` }}
                      />
                    </span>
                    <span className="text-right tabular-nums">
                      {eur0(t.eur)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12.5px] text-[var(--ink-2)]">
                Ended: {(s.endReason ?? "no deal").replace("_", " ")}.
              </p>
            )}
          </Box>
        </div>
      );
    }
  }
}

/** Steps through a run's story: chapter strip, Prev / Play / Next, arrow keys, #step-n in the URL. */
export function StoryPlayer({
  steps,
  runs,
  current,
}: {
  steps: StoryStep[];
  runs: { id: string; label: string }[];
  current: string;
}) {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const n = steps.length;
  const go = useCallback(
    (k: number) => {
      const next = Math.max(0, Math.min(n - 1, k));
      setI(next);
      history.replaceState(null, "", `#step-${next + 1}`);
    },
    [n],
  );

  useEffect(() => {
    const m = location.hash.match(/^#step-(\d+)$/);
    if (m) {
      const k = Math.max(0, Math.min(n - 1, Number(m[1]) - 1));
      queueMicrotask(() => setI(k));
    }
  }, [n]);

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

  useEffect(() => {
    if (!playing) return;
    if (i >= n - 1) {
      queueMicrotask(() => setPlaying(false));
      return;
    }
    const t = setTimeout(() => go(i + 1), AUTOPLAY_MS);
    return () => clearTimeout(t);
  }, [playing, i, n, go]);

  const s = steps[i];
  if (!s)
    return (
      <p className="text-[13px] text-[var(--muted)]">No story for this run.</p>
    );

  const btn =
    "rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[13px] font-medium hover:bg-[var(--hover)] disabled:opacity-40";
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
        <span className="text-[var(--ink-2)]">Run</span>
        <select
          value={current}
          onChange={(e) => router.push(`/story/${e.target.value}`)}
          className="w-full min-w-0 rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-1 sm:w-auto sm:max-w-full"
        >
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <nav aria-label="Chapters" className="flex gap-1 overflow-x-auto pb-1">
        {steps.map((x, k) => (
          <button
            key={k}
            onClick={() => go(k)}
            aria-current={k === i ? "step" : undefined}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] whitespace-nowrap ${
              k === i
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--ink)]"
                : k < i
                  ? "border-[var(--accent-line)] bg-[var(--accent-wash)] text-[var(--accent-ink)]"
                  : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
            }`}
          >
            <span className="tabular-nums">{k + 1}</span>
            {x.short}
          </button>
        ))}
      </nav>
      <div className="h-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div
          className="h-1 bg-[var(--accent)] transition-all"
          style={{ width: `${((i + 1) / n) * 100}%` }}
        />
      </div>

      <section className="space-y-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)] p-4">
        <div className="space-y-1">
          <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--accent-ink)]">
            Step {i + 1} of {n}
          </div>
          <h2 className="text-[20px] leading-tight font-semibold">{s.title}</h2>
          <p className="text-[14px] text-[var(--ink)]">{s.lead}</p>
        </div>
        <Body s={s} />
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[12px] text-[var(--muted)]">Go deeper:</span>
          {s.links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded border border-[var(--accent-line)] bg-[var(--accent-wash)] px-2 py-0.5 text-[12.5px] text-[var(--accent-ink)] hover:bg-[var(--select)]"
            >
              {l.label} →
            </Link>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button className={btn} onClick={() => go(i - 1)} disabled={i === 0}>
          ← Previous
        </button>
        <button
          className={`${btn} min-w-24`}
          onClick={() =>
            i >= n - 1 ? (go(0), setPlaying(true)) : setPlaying((p) => !p)
          }
        >
          {playing ? "❚❚ Pause" : i >= n - 1 ? "↻ Replay" : "▶ Play"}
        </button>
        <button
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink)] hover:opacity-90 disabled:opacity-40"
          onClick={() => go(i + 1)}
          disabled={i >= n - 1}
        >
          Next →
        </button>
        <span className="text-[12px] text-[var(--muted)]">
          ← → keys to step, space to play
        </span>
      </div>
    </div>
  );
}
