import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { TrendLine } from "@/components/charts/TrendLine";
import { BackIcon } from "@/components/icons";
import { DataId, MailBody } from "@/components/MailBody";
import { ScoreDot } from "@/components/suppliers/SupplierTable";
import { money } from "@/lib/format";
import {
  appearances,
  DOC_KIND,
  FISCAL_YEARS,
  findSupplier,
  LATEST_FY,
  OWNER_LABEL,
  SIGNAL_LABEL,
  supplierData,
  type Detail,
  type Doc,
  type News,
} from "@/lib/suppliers";

export function generateStaticParams() {
  return supplierData.suppliers.map((s) => ({ id: s.id.replace("sup:", "") }));
}

export async function generateMetadata({ params }: PageProps<"/suppliers/[id]">): Promise<Metadata> {
  const s = findSupplier(`sup:${(await params).id}`);
  return { title: `${s?.name ?? "Supplier"} · ProcuDeal` };
}

const eur0 = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const pct = (v: number) => `${(v * 100).toFixed(1).replace(/\.0$/, "")} %`;

// data/KNOWN_ISSUES.md #5: one supplier sits twice in the vendor master.
const SAME_AS: Record<string, string> = { "sup:71999": "sup:70210", "sup:70210": "sup:71999" };

function Card({ id, title, hint, children }: { id?: string; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="min-w-0 scroll-mt-4 space-y-3 rounded-md border border-[var(--line)] bg-[var(--surface)] p-4">
      <div>
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">{title}</h2>
        {hint && <p className="text-[12.5px] text-[var(--muted)]">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-1 text-[13px]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-[var(--ink-2)]">{k}</dt>
          <dd className="tabular-nums">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function Tile({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
      <div className="text-[11.5px] text-[var(--muted)]">{label}</div>
      <div className="text-[18px] font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11.5px] text-[var(--ink-2)]">{sub}</div>}
    </div>
  );
}

function Signals({ d }: { d: Detail }) {
  const s = d.signals;
  const kinds = (["cash", "work", "full"] as const).filter((k) => s.evidence[k].length);
  return (
    <Card
      title="What our agent reads into this supplier"
      hint="Computed the way the agent's dossier does it (agents/procudeal/dossier.py): owner type and phrases in its letters and news."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5 rounded border border-[var(--line)] bg-[var(--surface-2)] p-3">
          <div className="text-[12.5px] font-semibold">What money is worth to them</div>
          <div className="flex flex-wrap items-baseline gap-x-2 text-[13px] tabular-nums">
            <span>{OWNER_LABEL[d.intel?.owner_type ?? ""] ?? "Owner unknown"}</span>
            <span className="text-[var(--muted)]">{pct(s.owner_rate)}</span>
            {s.cash_premium > 0 && (
              <>
                <span className="text-[var(--muted)]">+ cash need {pct(s.cash_premium)}</span>
              </>
            )}
            <span className="text-[var(--muted)]">=</span>
            <span className="text-[18px] font-semibold">{pct(s.interest_rate)} a year</span>
          </div>
          <p className="text-[12px] text-[var(--ink-2)]">
            Our own cost of capital is 8 %. Above that, paying them earlier is worth more to them than it costs us, so
            the agent can trade shorter payment terms for a lower price.
          </p>
        </div>
        <div className="space-y-2">
          {kinds.length === 0 && <p className="text-[13px] text-[var(--muted)]">No cash, work or capacity signals in its letters or news.</p>}
          {kinds.map((k) => (
            <div key={k} className="space-y-1 rounded border border-[var(--warn-border)] bg-[var(--warn-bg)] p-2.5">
              <div className="text-[13px] font-semibold">{SIGNAL_LABEL[k].title}</div>
              <p className="text-[12px] text-[var(--ink-2)]">{SIGNAL_LABEL[k].meaning}</p>
              <ul className="space-y-0.5 text-[12px]">
                {s.evidence[k].map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-1.5">
                    <a href={`#${e.id}`} className="font-mono text-[11.5px] text-[var(--accent-ink)] hover:underline">
                      {e.id}
                    </a>
                    {e.matches.map((m) => (
                      <q key={m} className="italic">
                        {m}
                      </q>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

type Item = { kind: "doc"; date: string; doc: Doc } | { kind: "news"; date: string; news: News };

function Timeline({ d }: { d: Detail }) {
  const contractNotice = d.contract?.notice_days ?? null;
  const hits = new Map<string, string[]>();
  for (const list of Object.values(d.signals.evidence)) for (const e of list) hits.set(e.id, [...(hits.get(e.id) ?? []), ...e.matches]);
  const items: Item[] = [
    ...d.documents.map((doc) => ({ kind: "doc" as const, date: doc.date, doc })),
    ...d.news.map((news) => ({ kind: "news" as const, date: news.date, news })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  if (!items.length) return <p className="text-[13px] text-[var(--muted)]">No letters, notes or news.</p>;
  return (
    <ol className="relative space-y-2 border-l border-[var(--line)] pl-4">
      {items.map((it) => {
        const id = it.kind === "doc" ? it.doc.id : it.news.id;
        const title = it.kind === "doc" ? it.doc.subject : it.news.headline;
        const label = it.kind === "doc" ? (DOC_KIND[it.doc.kind] ?? it.doc.kind) : `News · ${it.news.topic.replace(/_/g, " ")}`;
        const by = it.kind === "doc" ? it.doc.author : it.news.source;
        const body = it.kind === "doc" ? it.doc.body : (it.news.body ?? "");
        const matched = hits.get(id) ?? [];
        return (
          <li key={id} id={id} className="relative scroll-mt-4 target:[&>details]:ring-2 target:[&>details]:ring-[var(--accent)]">
            <span
              className={`absolute top-3 -left-[21px] h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)] ${
                it.kind === "news" ? "bg-[var(--muted)]" : "bg-[var(--s-ours)]"
              }`}
            />
            <details className="rounded border border-[var(--line)] bg-[var(--surface)]">
              <summary className="cursor-pointer list-none px-3 py-2 hover:bg-[var(--hover)]">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--ink-2)]">
                  <span className="tabular-nums">{it.date}</span>
                  <span className="rounded bg-[var(--surface-3)] px-1.5">{label}</span>
                  {by && <span>{by}</span>}
                  <span className="font-mono text-[11px] text-[var(--muted)]">{id}</span>
                </div>
                <div className="text-[13.5px] font-medium">{title}</div>
                {it.kind === "doc" && (it.doc.asked_pct !== null || it.doc.asked_price !== null || it.doc.notice_days !== null) && (
                  <div className="mt-1 flex flex-wrap gap-1 text-[11.5px]">
                    {it.doc.asked_pct !== null && <span className="rounded border border-[var(--line)] px-1.5">asks +{it.doc.asked_pct} %</span>}
                    {it.doc.asked_price !== null && <span className="rounded border border-[var(--line)] px-1.5">asks {money(it.doc.asked_price)}</span>}
                    {it.doc.effective_date && <span className="rounded border border-[var(--line)] px-1.5">from {it.doc.effective_date}</span>}
                    {it.doc.notice_days !== null && <span className="rounded border border-[var(--line)] px-1.5">{it.doc.notice_days} days&apos; notice</span>}
                    {it.doc.notice_days !== null && contractNotice !== null && it.doc.notice_days < contractNotice && (
                      <a href={`#${d.contract!.id}`} className="rounded bg-[var(--bad-bg)] px-1.5 text-[var(--bad)] hover:underline">
                        contract needs {contractNotice} days
                      </a>
                    )}
                  </div>
                )}
                {matched.length > 0 && (
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[11.5px]">
                    <span className="text-[var(--ink-2)]">Signal:</span>
                    {matched.map((m) => (
                      <q key={m} className="rounded border border-[var(--warn-border)] bg-[var(--warn-bg)] px-1.5 italic">
                        {m}
                      </q>
                    ))}
                  </div>
                )}
              </summary>
              <div className="border-t border-[var(--line)] px-3 py-2.5">
                {it.kind === "doc" && it.doc.part_ids.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1 text-[12px]">
                    {it.doc.part_ids.map((p) => (
                      <DataId key={p} id={p} />
                    ))}
                  </div>
                )}
                <MailBody text={body} />
              </div>
            </details>
          </li>
        );
      })}
    </ol>
  );
}

export default async function Page({ params }: PageProps<"/suppliers/[id]">) {
  const s = findSupplier(`sup:${(await params).id}`);
  if (!s) notFound();
  const d = supplierData.details[s.id];
  const seen = appearances(s.id);
  const spend = FISCAL_YEARS.map((fy) => ({ fy, ...(s.spend[fy] ?? { spend_eur: 0, invoice_count: 0 }) }));
  const maxSpend = Math.max(1, ...spend.map((x) => x.spend_eur));
  const now = s.spend[LATEST_FY]?.spend_eur ?? 0;
  const before = s.spend[FISCAL_YEARS.at(-2) ?? ""]?.spend_eur ?? 0;
  const sc = d?.scorecards.at(-1);
  const intel = d?.intel;
  const twin = SAME_AS[s.id];

  return (
    <main className="h-full overflow-auto bg-[var(--page)]">
      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
        <header className="space-y-2">
          <Link href="/suppliers" className="inline-flex items-center gap-1 text-[12.5px] text-[var(--accent-ink)] hover:underline">
            <BackIcon width={14} height={14} /> All suppliers
          </Link>
          <div>
            <h1 className="text-[22px] font-semibold">{s.name}</h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[var(--ink-2)]">
              <DataId id={s.id} />
              <span>{s.country}</span>·<span>{s.category}</span>
              {s.abc_class && <>· <span>ABC class {s.abc_class}</span></>}
              {s.detail !== "full" && <>· <span>spend only</span></>}
              {s.blocked && <span className="rounded bg-[var(--bad-bg)] px-1.5 text-[var(--bad)]">blocked</span>}
            </p>
            {twin && (
              <p className="mt-1 text-[12.5px] text-[var(--ink-2)]">
                Same company as <DataId id={twin} /> ({s.id === "sup:71999" ? "this is the old record" : "renamed 2024; the old record"}, see
                KNOWN_ISSUES #5).
              </p>
            )}
          </div>
          {seen.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
              <span className="text-[var(--ink-2)]">Negotiated in:</span>
              {seen.map((c) => (
                <span key={c.case_id} className="inline-flex flex-wrap items-center gap-1 rounded border border-[var(--line)] bg-[var(--surface)] px-2 py-0.5">
                  <Link href={`/mail#${c.case_id}/case`} className="font-semibold hover:underline" title={c.title}>
                    {c.case_id.replace("case:", "")}
                  </Link>
                  {c.runs.length > 0 && (
                    <Link
                      href={`/negotiations/${c.runs.at(-1)!.session_id}`}
                      className="text-[var(--accent-ink)] hover:underline"
                      title={`Latest run: ${c.runs.at(-1)!.version}`}
                    >
                      replay · {Math.round(c.runs.at(-1)!.score * 100)}
                    </Link>
                  )}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-6">
          <Tile
            label={`Spend ${LATEST_FY}`}
            value={eur0.format(now)}
            sub={before ? `${now >= before ? "▲" : "▼"} ${Math.abs(((now - before) / before) * 100).toFixed(1)} % vs ${FISCAL_YEARS.at(-2)}` : undefined}
          />
          <Tile
            label="Scorecard"
            value={sc ? <span className="inline-flex items-center gap-2"><ScoreDot colour={sc.colour} />{sc.score.toFixed(1)}</span> : "—"}
            sub={sc ? `class ${sc.class} · ${sc.quarter}` : "no scorecard"}
          />
          <Tile label="On-time delivery" value={sc ? `${sc.otd_pct.toFixed(1)} %` : "—"} sub="target 95 %" />
          <Tile label="Defects" value={sc ? `${sc.ppm.toLocaleString("en-GB")} ppm` : "—"} sub={sc ? `${sc.qn_count} complaints, 12 months` : undefined} />
          <Tile
            label="Credit index"
            value={intel?.credit_index ?? "—"}
            sub={
              intel?.credit_index != null && intel.credit_index_12m_ago != null
                ? intel.credit_index === intel.credit_index_12m_ago
                  ? "unchanged in 12 months · higher is worse"
                  : `${intel.credit_index > intel.credit_index_12m_ago ? "▲ worse" : "▼ better"} from ${intel.credit_index_12m_ago}`
                : "higher is worse"
            }
          />
          <Tile label="Equity ratio" value={intel?.equity_ratio_pct != null ? `${intel.equity_ratio_pct} %` : "—"} sub={intel?.owner_type ? OWNER_LABEL[intel.owner_type] : undefined} />
        </div>

        {d && <Signals d={d} />}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Company" hint={intel ? `Register facts, filed accounts FY${intel.filed_fy ?? "?"}` : "Known only from the spend cube."}>
            {intel ? (
              <KV
                rows={[
                  ["Legal form", intel.legal_form],
                  ["Founded", intel.founded],
                  ["Owner", <>{OWNER_LABEL[intel.owner_type ?? ""] ?? intel.owner_type}{intel.group_parent && <> · parent {intel.group_parent}</>}</>],
                  ["Staff", intel.staff?.toLocaleString("en-GB")],
                  ["Turnover", intel.turnover_eur ? eur0.format(intel.turnover_eur) : intel.turnover_band],
                  ["Equity ratio", intel.equity_ratio_pct != null ? `${intel.equity_ratio_pct} %` : null],
                  ["Credit index", intel.credit_index != null ? `${intel.credit_index} (12 months ago ${intel.credit_index_12m_ago})` : null],
                  ["VDA 6.3 audit", intel.vda63_grade],
                  ["Certifications", intel.certifications],
                  ["In our vendor master since", s.created],
                ]}
              />
            ) : (
              <KV rows={[["In our vendor master since", s.created]]} />
            )}
          </Card>

          <Card
            id={s.contract_id ?? undefined}
            title="Terms and contract"
            hint="Vendor master terms close any field a deal leaves open; the contract sets notice periods and price rules."
          >
            <KV
              rows={[
                ["Payment terms", s.payment_days != null ? `${s.payment_days} days net${s.payment_days < 60 ? " (our standard is 60)" : ""}` : null],
                ["Cash discount", s.skonto_pct ? `${s.skonto_pct} % within ${s.skonto_days} days` : "none"],
                ["Incoterm", s.incoterm ? `${s.incoterm}${s.incoterm !== "DAP" ? " (we prefer DAP: we pay the freight)" : ""}` : null],
                ["Standard lead time", s.standard_lead_time_days != null ? `${s.standard_lead_time_days} days` : null],
                ["Currency", s.currency],
              ]}
            />
            {d?.contract ? (
              <div className="space-y-1 border-t border-[var(--line)] pt-3">
                <div className="flex items-center gap-2 text-[13px]">
                  <DataId id={d.contract.id} />
                  <span className="text-[var(--ink-2)]">{d.contract.type}</span>
                </div>
                <KV
                  rows={[
                    ["Valid", `${d.contract.valid_from} → ${d.contract.valid_to}`],
                    ["Notice for price changes", d.contract.notice_days != null ? `${d.contract.notice_days} days` : null],
                    ["Price basis", d.contract.price_basis],
                    ["Payment / Incoterm", `${d.contract.payment_days ?? "—"} days · ${d.contract.incoterm ?? "—"}`],
                  ]}
                />
              </div>
            ) : (
              <p className="text-[12.5px] text-[var(--muted)]">No framework contract.</p>
            )}
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
          <Card title="Spend with us" hint="Fiscal year October to September (spend cube).">
            <div className="space-y-2">
              {spend.map((x) => (
                <div key={x.fy} className="grid grid-cols-[4.5rem_1fr] items-center gap-2 text-[13px]">
                  <span className="text-[var(--ink-2)]">{x.fy}</span>
                  <div className="space-y-0.5">
                    <div className="h-2 rounded-r bg-[var(--surface-3)]">
                      <div className="h-2 rounded-r bg-[var(--s-ours)]" style={{ width: `${(x.spend_eur / maxSpend) * 100}%` }} />
                    </div>
                    <div className="flex justify-between text-[12px] tabular-nums">
                      <span className="font-semibold">{eur0.format(x.spend_eur)}</span>
                      <span className="text-[var(--muted)]">{x.invoice_count} invoices</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Parts they supply" hint="Source list: approved suppliers per part, quota and who owns the tooling.">
            {d?.sourcing.length ? (
              <div className="overflow-x-auto rounded border border-[var(--line)]">
                <table className="w-full text-[13px]">
                  <thead className="bg-[var(--surface-2)] text-left text-[12px] text-[var(--ink-2)]">
                    <tr>
                      <th className="px-2.5 py-1.5 font-medium">Part</th>
                      <th className="px-2.5 py-1.5 font-medium">Status</th>
                      <th className="px-2.5 py-1.5 font-medium">Quota</th>
                      <th className="px-2.5 py-1.5 font-medium">Approved since</th>
                      <th className="px-2.5 py-1.5 font-medium">Tooling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.sourcing.map((p) => (
                      <tr key={p.part_id} className="border-t border-[var(--line)]">
                        <td className="px-2.5 py-1.5">
                          <DataId id={p.part_id} /> <span>{p.description}</span>
                          <div className="text-[11.5px] text-[var(--muted)]">
                            {p.category}
                            {p.abc_class && ` · ABC ${p.abc_class}`}
                          </div>
                        </td>
                        <td className="px-2.5 py-1.5">{p.status}</td>
                        <td className="px-2.5 py-1.5 tabular-nums">{p.quota_pct != null ? `${p.quota_pct} %` : "—"}</td>
                        <td className="px-2.5 py-1.5 tabular-nums">{p.approved_since ?? "—"}</td>
                        <td className="px-2.5 py-1.5">{p.tooling_owner ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[13px] text-[var(--muted)]">No parts on our source list.</p>
            )}
          </Card>
        </div>

        {d && d.scorecards.length > 0 && (
          <Card
            id="scorecards"
            title="Scorecards"
            hint="Rolling 12 months to each quarter's end, shared with the supplier. Score = ½ on-time + ½ quality points − 5 per overdue 8D; A green ≥ 85, B amber 70–85, C red < 70."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <TrendLine
                title="On-time delivery"
                unit="pct"
                target={{ value: 95, label: "target 95 %" }}
                points={d.scorecards.map((x) => ({ label: x.quarter, value: x.otd_pct, note: `${x.gr_lines} receipt lines` }))}
              />
              <TrendLine
                title="Defects"
                unit="ppm"
                better="lower"
                points={d.scorecards.map((x) => ({ label: x.quarter, value: x.ppm, note: `${x.complaint_qty} bad of ${x.received_qty.toLocaleString("en-GB")}` }))}
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {d.scorecards.map((x) => (
                <span
                  key={x.id}
                  id={x.id}
                  className="inline-flex items-center gap-1.5 rounded border border-[var(--line)] px-2 py-0.5 text-[12px] tabular-nums"
                  title={`${x.id}: OTD ${x.otd_pct} %, ${x.ppm} ppm, ${x.open_8d_overdue} 8D overdue`}
                >
                  <ScoreDot colour={x.colour} />
                  {x.quarter} · {x.score.toFixed(1)} {x.class}
                </span>
              ))}
            </div>
          </Card>
        )}

        {d && (
          <Card
            id="timeline"
            title="Letters, notes and news"
            hint="Newest first. Blue: letters, e-mails and our meeting and call notes; grey: press. Highlighted phrases are what the agent's dossier picks up."
          >
            <Timeline d={d} />
          </Card>
        )}
      </div>
    </main>
  );
}
