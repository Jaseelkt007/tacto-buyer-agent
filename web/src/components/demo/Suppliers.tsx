"use client";

import { useMemo, useState } from "react";
import { code, suppliers, type DetailedSupplier } from "@/lib/demo";
import { s } from "./styles";
import { CodeRef, Panel, pct, Seg, Tag } from "./ui";

type GroupBy = "category" | "country" | "abc_class";

export function Suppliers() {
  const [by, setBy] = useState<GroupBy>("category");
  const [q, setQ] = useState("");
  const [hover, setHover] = useState<string | null>(null);
  const [sel, setSel] = useState<string>(suppliers.detailed.find((d) => d.cases.length)?.id ?? suppliers.detailed[0].id);
  const detail = useMemo(() => Object.fromEntries(suppliers.detailed.map((d) => [d.id, d])), []);
  const inCase = (id: string) => (suppliers.in_cases[id]?.length ?? 0) > 0;
  const match = (x: (typeof suppliers.all)[number]) => !q || `${x.id} ${x.name} ${x.category} ${x.country}`.toLowerCase().includes(q.toLowerCase());

  const groups = useMemo(() => {
    const m = new Map<string, typeof suppliers.all>();
    for (const x of suppliers.all) {
      const k = String(x[by] ?? "—");
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(x);
    }
    for (const list of m.values()) list.sort((a, b) => Number(b.detailed) - Number(a.detailed) || Number(inCase(b.id)) - Number(inCase(a.id)));
    return [...m.entries()].sort((a, b) => (by === "abc_class" ? a[0].localeCompare(b[0]) : b[1].length - a[1].length));
  }, [by]);

  const hovered = hover ? suppliers.all.find((x) => x.id === hover) : null;
  const d = detail[sel];
  const hits = q ? suppliers.all.filter(match).length : null;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel
          title={`${suppliers.total} suppliers, one square each`}
          aside={
            <span className="flex flex-wrap items-center gap-3">
              <Swatch cls="bg-[var(--d-ink)]">dossier ({suppliers.detailed_count})</Swatch>
              <Swatch cls="bg-[var(--d-supplier)]">in a practice case</Swatch>
              <Swatch cls="bg-[var(--d-line)]">spend data only</Swatch>
            </span>
          }
        >
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--d-line-soft)] px-4 py-2.5">
            <Seg
              label="Group suppliers by"
              value={by}
              onChange={setBy}
              options={[
                { value: "category", label: "Category" },
                { value: "country", label: "Country" },
                { value: "abc_class", label: "ABC class" },
              ]}
            />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find a supplier by name, ID or category"
              className="min-w-[220px] flex-1 rounded-md border border-[var(--d-line)] bg-[var(--d-panel-2)] px-2.5 py-1.5 text-[12.5px] placeholder:text-[var(--d-muted)]"
            />
            {hits !== null && <span className="text-[12px] text-[var(--d-muted)]">{hits} match</span>}
          </div>
          <div className="h-6 px-4 pt-2 text-[12px] text-[var(--d-ink-2)]" aria-live="polite">
            {hovered ? (
              <>
                <b className="text-[var(--d-ink)]">{hovered.name}</b> {hovered.id}, {hovered.country}, {hovered.category}, class {hovered.abc_class}
                {hovered.blocked ? ", blocked" : ""}
                {inCase(hovered.id) ? `, in ${suppliers.in_cases[hovered.id].join(", ")}` : ""}
              </>
            ) : (
              <span className="text-[var(--d-muted)]">Point at a square for its name. Click a dark one to open its dossier.</span>
            )}
          </div>
          <div className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map(([k, list]) => (
              <div key={k} className="min-w-0">
                <div className="mb-1 flex items-baseline justify-between text-[12px]">
                  <span className="font-medium">{by === "abc_class" ? `Class ${k}` : k}</span>
                  <span className="tabular-nums text-[var(--d-muted)]">
                    {list.length}
                    {list.some((x) => x.detailed) ? `, ${list.filter((x) => x.detailed).length} dossier` : ""}
                  </span>
                </div>
                <div className="flex flex-wrap gap-[2px]">
                  {list.map((x) => {
                    const on = match(x);
                    const cls = inCase(x.id) ? "bg-[var(--d-supplier)]" : x.detailed ? "bg-[var(--d-ink)]" : "bg-[var(--d-line)]";
                    return (
                      <button
                        key={x.id}
                        type="button"
                        aria-label={`${x.name}, ${x.id}`}
                        onMouseEnter={() => setHover(x.id)}
                        onFocus={() => setHover(x.id)}
                        onMouseLeave={() => setHover(null)}
                        onClick={() => x.detailed && setSel(x.id)}
                        className={`h-[11px] w-[11px] rounded-[2px] ${cls} ${on ? "" : "opacity-15"} ${x.id === sel ? "outline outline-2 outline-offset-1 outline-[var(--d-buyer)]" : ""} ${x.detailed ? "cursor-pointer" : "cursor-default"}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {suppliers.notes.length > 0 && <p className="border-t border-[var(--d-line-soft)] px-4 py-2.5 text-[11.5px] text-[var(--d-muted)]">{suppliers.notes.join(" ")}</p>}
        </Panel>

        <Panel title="How a dossier prices a supplier's money" aside={<CodeRef file="starter-kit/arena_kit/agents/procudeal/dossier.py" line={24} />}>
          <div className="space-y-3 p-4 text-[12.5px] leading-relaxed">
            <p className="text-[var(--d-ink-2)]">
              What a year of money is worth to it, by owner type. Faster payment buys more price from a supplier whose money is dear.
            </p>
            <ul className="space-y-1">
              {Object.entries(suppliers.dossier_rules.owner_rate).map(([k, v]) => (
                <li key={k} className="grid grid-cols-[1fr_auto] items-center gap-2">
                  <span>{k}</span>
                  <span className="tabular-nums font-semibold">{pct(v, 1)}</span>
                </li>
              ))}
              <li className="grid grid-cols-[1fr_auto] gap-2 text-[var(--d-muted)]">
                <span>unknown owner</span>
                <span className="tabular-nums">{pct(suppliers.dossier_rules.default_rate, 1)}</span>
              </li>
            </ul>
            <p className="rounded-md bg-[var(--d-supplier-wash)] p-2.5">
              Its letters, notes or news mention cash (overdue invoices, liquidity, skonto…): <b>+{pct(suppliers.dossier_rules.cash_premium)}</b>, and our e-mail offers faster payment.
            </p>
            <p className="text-[var(--d-ink-2)]">
              Full cost comes from its own should-cost row, else the German should-cost times a country factor, else its quote less 10 %. A supplier never sells below that floor, so every price it offers caps the estimate.
            </p>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Panel title={`The ${suppliers.detailed_count} suppliers our code can build a dossier for`} aside="click a row">
          <div className={`${s.scrollPane} max-h-[520px] overflow-auto`}>
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-[var(--d-panel)] text-left text-[11.5px] text-[var(--d-muted)]">
                <tr>
                  <th className="px-4 py-2 font-normal">Supplier</th>
                  <th className="py-2 pr-3 font-normal">Owner</th>
                  <th className="py-2 pr-3 text-right font-normal">Rate</th>
                  <th className="py-2 pr-3 font-normal">Signals</th>
                  <th className="py-2 pr-3 text-right font-normal">Paid late</th>
                  <th className="py-2 pr-4 font-normal">Cases</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.detailed.map((x) => (
                  <tr
                    key={x.id}
                    onClick={() => setSel(x.id)}
                    className={`cursor-pointer border-t border-[var(--d-line-soft)] ${x.id === sel ? "bg-[var(--d-buyer-wash)]" : "hover:bg-[var(--d-panel-2)]"}`}
                  >
                    <td className="px-4 py-1.5">
                      <div className="font-medium">{x.name}</div>
                      <div className="text-[11px] text-[var(--d-muted)]">
                        {x.id}, {x.country}, {x.category}
                      </div>
                    </td>
                    <td className="py-1.5 pr-3 text-[var(--d-ink-2)]">{String(x.intel?.owner_type ?? "—")}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums font-semibold">{pct(x.dossier.interest_rate, 1)}</td>
                    <td className="py-1.5 pr-3">
                      <span className="flex flex-wrap gap-1">
                        {x.dossier.cash_need && <Tag tone="supplier">cash</Tag>}
                        {x.dossier.wants_work && <Tag tone="arena">wants work</Tag>}
                        {x.dossier.capacity_full && <Tag tone="warn">full</Tag>}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{x.late_paid_share === null ? "—" : pct(x.late_paid_share)}</td>
                    <td className="py-1.5 pr-4 text-[var(--d-ink-2)]">{x.cases.map((c) => c.replace("case:", "")).join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        {d && <Dossier d={d} />}
      </div>
    </div>
  );
}

function Swatch({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-[11px] w-[11px] rounded-[2px] ${cls}`} />
      {children}
    </span>
  );
}

function Dossier({ d }: { d: DetailedSupplier }) {
  const i = d.intel ?? {};
  const owner = String(i.owner_type ?? "");
  const ownerRate = d.dossier.owner_rate ?? suppliers.dossier_rules.default_rate;
  const country = code.constants.find((c) => c.name === "COUNTRY_COST")?.value as Record<string, number> | undefined;
  return (
    <Panel key={d.id} className={s.enter} title={d.name} aside={d.id}>
      <div className="space-y-4 p-4 text-[12.5px]">
        <div className="rounded-md border border-[var(--d-line)] bg-[var(--d-panel-2)] p-3">
          <div className="mb-1 text-[12px] font-semibold">Its cost of money, as the engine computes it</div>
          <div className={`${s.plate} text-[26px] tabular-nums`}>
            {pct(ownerRate, 1)} {d.dossier.cash_need ? `+ ${pct(d.dossier.cash_premium)} ` : ""}= {pct(d.dossier.interest_rate, 1)}
          </div>
          <div className="text-[11.5px] text-[var(--d-muted)]">
            {owner ? `${owner}-owned` : "owner unknown"}
            {d.dossier.cash_need ? ", and its documents ask for cash" : ""}
            {country && d.country in country ? `. Country cost factor vs DE: ${country[d.country]}` : ""}
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          <Item k="Legal form" v={i.legal_form} />
          <Item k="Staff" v={i.staff} />
          <Item k="Turnover" v={i.turnover_band} />
          <Item k="Equity ratio" v={i.equity_ratio_pct !== undefined && i.equity_ratio_pct !== null ? `${i.equity_ratio_pct} %` : null} />
          <Item k="Credit index" v={i.credit_index !== undefined ? `${i.credit_index}${i.credit_index_12m_ago && i.credit_index_12m_ago !== i.credit_index ? ` (was ${i.credit_index_12m_ago})` : ""}` : null} />
          <Item k="Scorecard" v={d.latest_scorecard ? `${d.latest_scorecard.score}, OTD ${d.latest_scorecard.otd_pct} %, ${d.latest_scorecard.ppm} ppm` : null} />
          <Item k="Contract" v={d.contract ? `${d.contract.type}, ${d.contract.notice_days} d notice, to ${d.contract.valid_to}` : null} />
          <Item k="Invoices paid late" v={d.late_paid_share !== null ? `${pct(d.late_paid_share)} of ${d.invoices}` : null} />
          <Item k="Documents" v={`${d.n_documents} (${Object.entries(d.document_kinds).map(([k, n]) => `${n} ${k.replace("_", " ")}`).join(", ")})`} />
          <Item k="Should-cost rows" v={d.should_cost_rows} />
          <Item k="News items" v={d.n_news} />
          <Item k="Index clauses" v={d.index_clauses} />
        </dl>
        {Object.entries(d.dossier.evidence).some(([, v]) => v.length) && (
          <div>
            <div className="mb-1 font-semibold">What the dossier regexes found</div>
            <ul className="space-y-1.5">
              {Object.entries(d.dossier.evidence).flatMap(([k, list]) =>
                list.map((hit, j) => (
                  <li key={`${k}${j}`} className="flex flex-wrap items-center gap-2">
                    <Tag tone={k === "cash_need" ? "supplier" : k === "wants_work" ? "arena" : "warn"}>{k.replace("_", " ")}</Tag>
                    <span className="text-[var(--d-ink-2)]">{hit.matches.map((m) => `“${m}”`).join(", ")}</span>
                    <code className={`${s.code} rounded bg-[var(--d-sunk)] px-1 !text-[11px]`}>{hit.id}</code>
                  </li>
                )),
              )}
            </ul>
          </div>
        )}
        {d.cases.length > 0 && <p className="text-[var(--d-ink-2)]">Negotiated in {d.cases.join(", ")}.</p>}
      </div>
    </Panel>
  );
}

function Item({ k, v }: { k: string; v: unknown }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-[var(--d-muted)]">{k}</dt>
      <dd className="truncate">{v === null || v === undefined || v === "" ? "—" : String(v)}</dd>
    </div>
  );
}
