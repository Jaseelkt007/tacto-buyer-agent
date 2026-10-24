import type { ReactNode } from "react";
import type { Claim, Mail, Terms } from "@/lib/inbox";
import { GOALS, count, money, termLabel, termValue } from "@/lib/format";
import { DataId, extractIds } from "./MailBody";
import { BotIcon } from "./icons";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h4 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">{title}</h4>
        {hint && <p className="text-[12px] text-[var(--muted)]">{hint}</p>}
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
          <dd className="tabular-nums text-[var(--ink)]">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warn" }) {
  const cls =
    tone === "warn"
      ? "border-[var(--warn-border)] bg-[var(--warn-bg)] text-[var(--ink)]"
      : "border-[var(--line)] bg-[var(--surface-2)] text-[var(--ink)]";
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[12px] ${cls}`}>{children}</span>;
}

function OfferTable({ sheets }: { sheets: { id: string; label: string; terms: Terms }[] }) {
  const fields = [...new Set(sheets.flatMap((s) => Object.keys(s.terms)))].sort((a, b) =>
    a === "unit_price" ? -1 : b === "unit_price" ? 1 : 0,
  );
  return (
    <div className="overflow-x-auto rounded border border-[var(--line)]">
      <table className="w-full text-[13px]">
        <thead className="bg-[var(--surface-2)] text-left text-[12px] text-[var(--ink-2)]">
          <tr>
            <th className="px-3 py-1.5 font-medium">Term</th>
            {sheets.map((s) => (
              <th key={s.id} className="px-3 py-1.5 font-medium">
                {s.label}
                <div className="font-mono text-[11px] font-normal text-[var(--muted)]">{s.id}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {fields.map((f) => (
            <tr key={f} className="border-t border-[var(--line)]">
              <td className="px-3 py-1.5 text-[var(--ink-2)]">{termLabel(f)}</td>
              {sheets.map((s) => (
                <td key={s.id} className="px-3 py-1.5">
                  {f in s.terms ? termValue(f, s.terms[f]) : <span className="text-[var(--muted)]">not stated</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClaimRow({ claim }: { claim: Claim }) {
  const asserted = Object.entries(claim.asserted).map(([k, v]) =>
    k.endsWith("_pct") ? `${k.replace(/_pct$/, "").replace(/_/g, " ")} ${Number(v) > 0 ? "+" : ""}${v} %` : `${k}: ${v}`,
  );
  return (
    <li className="flex flex-wrap items-center gap-1.5 text-[13px]">
      <Chip>{claim.type.replace(/_/g, " ")}</Chip>
      {claim.refs.map((r) => (
        <DataId key={r} id={r} />
      ))}
      <span className="font-medium tabular-nums">{asserted.join(", ")}</span>
    </li>
  );
}

function QuoteView({ mail }: { mail: Mail }) {
  const q = mail.quote!;
  const sheets = [
    ...q.term_sheets.map((s) => ({ id: s.term_sheet_id, label: "Offer", terms: s.terms })),
    ...q.alternatives.map((a, i) => ({ id: a.offer_id, label: `Alternative ${i + 1}`, terms: a.terms })),
  ];
  return (
    <>
      <Section title="Offer on the table" hint="The term sheet binds; the e-mail text does not.">
        <OfferTable sheets={sheets} />
      </Section>
      {q.missing_fields.length > 0 && (
        <Section
          title="Not stated in the offer"
          hint="These close on the supplier's standard terms from the attached quote PDF."
        >
          <div className="flex flex-wrap gap-1.5">
            {q.missing_fields.map((f) => (
              <Chip key={f} tone="warn">
                {termLabel(f)}
              </Chip>
            ))}
          </div>
        </Section>
      )}
      <Section
        title={`Supplier's claims (${q.claims.length})`}
        hint={q.claims.length ? "Arguments the agent can check against the data package." : "No checkable claims."}
      >
        {q.claims.length > 0 && (
          <ul className="space-y-1.5">
            {q.claims.map((c, i) => (
              <ClaimRow key={i} claim={c} />
            ))}
          </ul>
        )}
      </Section>
      <Section title="Signals">
        <KV
          rows={[
            ["Status", q.status.replace(/_/g, " ")],
            ...Object.entries(q.signals).map(([k, v]) => [k.replace(/_/g, " "), String(v)] as [string, ReactNode]),
          ]}
        />
      </Section>
    </>
  );
}

function CaseView({ mail }: { mail: Mail }) {
  const c = mail.case;
  const b = c.buyer;
  const alt = b.alternative;
  return (
    <>
      <Section title="The job">
        <KV
          rows={[
            ["Case type", c.type.replace(/_/g, " ")],
            ["Category goal", GOALS[b.category_goal ?? ""] ?? b.category_goal ?? "—"],
            ["Part", c.parts.map((p) => p.description ?? p.id).join(", ")],
            ["Need", `${count(b.need_per_year)} pc / year for ${b.horizon_years} year(s)`],
            ["Current price", money(b.current_unit_price)],
            ["Fallback price", money(b.fallback_unit_price)],
            ["Need lead time", b.need_lead_time_days ? `${b.need_lead_time_days} days` : "—"],
            ["Round limit", String(c.round_limit)],
          ]}
        />
      </Section>
      <Section title="If we walk away">
        {alt && alt.kind !== "none" ? (
          <KV
            rows={[
              ["Alternative", <span key="k">{alt.kind.replace(/_/g, " ")} {alt.ref && <DataId id={alt.ref} />}</span>],
              ["Its price", money(alt.terms.unit_price as number)],
            ]}
          />
        ) : (
          <p className="text-[13px] text-[var(--ink)]">No alternative: no deal scores 0.</p>
        )}
      </Section>
      <Section title="Must-haves" hint="Breaking one scores 0.">
        {b.must_haves?.length ? (
          <div className="flex flex-wrap gap-1.5">
            {b.must_haves.map((m) => (
              <Chip key={m.field} tone="warn">
                {termLabel(m.field)} {m.op} {termValue(m.field, m.value)}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-[var(--ink)]">None.</p>
        )}
      </Section>
      <Section title="What can be negotiated">
        <ul className="space-y-1 text-[13px]">
          {c.negotiable.map((f) => (
            <li key={f} className="flex flex-wrap items-baseline gap-1.5">
              <span className="min-w-32 text-[var(--ink-2)]">{termLabel(f)}</span>
              {f === "unit_price" ? (
                <span>any price</span>
              ) : (
                (c.term_options[f] ?? []).map((o) => <Chip key={String(o)}>{termValue(f, o)}</Chip>)
              )}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Fixed by the enquiry">
        <KV rows={Object.entries(c.fixed_terms).map(([k, v]) => [termLabel(k), termValue(k, v)])} />
      </Section>
      <Section title="Suppliers">
        <ul className="space-y-1 text-[13px]">
          {c.suppliers.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <DataId id={s.id} />
              {s.name}
              {s.country && <span className="text-[var(--muted)]">{s.country}</span>}
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function DocView({ mail }: { mail: Mail }) {
  const ids = extractIds(mail.body);
  return (
    <>
      <Section title="Trigger document" hint="The document that starts this case.">
        <KV rows={[["Document", <DataId key="d" id={mail.case.trigger!.doc_id} />]]} />
      </Section>
      <Section title="Data IDs in the text" hint="Starting points for the agent's research.">
        {ids.length ? (
          <div className="flex flex-wrap gap-1.5">
            {ids.map((id) => (
              <DataId key={id} id={id} />
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-[var(--muted)]">None.</p>
        )}
      </Section>
      <Section title="Case references">
        <div className="flex flex-wrap gap-1.5">
          {mail.case.refs.map((id) => (
            <DataId key={id} id={id} />
          ))}
        </div>
      </Section>
    </>
  );
}

export function AgentView({ mail }: { mail: Mail }) {
  return (
    <aside className="rounded-md border border-[var(--accent-line)] bg-[var(--accent-wash)] p-4">
      <header className="mb-4 flex items-center gap-2 text-[var(--accent-ink)]">
        <BotIcon width={18} height={18} />
        <h3 className="text-[14px] font-semibold">What the agent reads</h3>
      </header>
      <div className="space-y-5">
        {mail.kind === "quote" ? <QuoteView mail={mail} /> : mail.kind === "case" ? <CaseView mail={mail} /> : <DocView mail={mail} />}
      </div>
    </aside>
  );
}
