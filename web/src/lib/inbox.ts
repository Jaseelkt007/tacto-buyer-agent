import raw from "@/data/inbox.json";

export type Terms = Record<string, string | number | null | undefined>;

export type Claim = { type: string; refs: string[]; asserted: Record<string, number | string> };

export type Attachment = { name: string; type: string; size: number; href: string };

export type Quote = {
  message_id: string;
  supplier_id: string;
  from: string;
  from_name: string;
  to: string;
  subject: string;
  body: string;
  received_at: number;
  attachments: Attachment[];
  term_sheets: { term_sheet_id: string; terms: Terms }[];
  alternatives: { offer_id: string; terms: Terms }[];
  missing_fields: string[];
  signals: Record<string, number | string>;
  status: string;
  claims: Claim[];
};

export type CaseFile = {
  case_id: string;
  set: "practice" | "sandbox";
  type: string;
  title: string;
  briefing: string;
  trigger: { doc_id: string; title: string; kind: string; date: string; from: string; body: string } | null;
  parts: { id: string; description: string | null }[];
  suppliers: { id: string; name: string; country: string | null }[];
  negotiable: string[];
  fixed_terms: Terms;
  term_options: Record<string, (string | number | null)[]>;
  round_limit: number;
  refs: string[];
  buyer: {
    need_per_year?: number;
    horizon_years?: number;
    current_unit_price?: number | null;
    fallback_unit_price?: number | null;
    category_goal?: string;
    need_lead_time_days?: number;
    reference_payment_days?: number;
    must_haves?: { field: string; op: string; value: string | number }[];
    alternative?: { kind: string; ref: string | null; terms: Terms };
  };
  session_id: string | null;
  quotes: Quote[];
};

export type Folder = "inbox" | "sent" | "cases";

export type Mail = {
  id: string;
  folder: Folder;
  kind: "quote" | "letter" | "email" | "memo" | "rfq" | "case";
  caseId: string;
  caseSet: CaseFile["set"];
  caseTitle: string;
  fromName: string;
  fromAddr: string;
  to: string;
  subject: string;
  preview: string;
  body: string;
  date: string; // ISO
  attachments: Attachment[];
  quote?: Quote;
  case: CaseFile;
};

export const data = raw as unknown as { synced_at: string; cases: CaseFile[] };

const OURS = "Hollerau Pumpenwerke";

function preview(text: string) {
  return text
    .replace(/\*\*/g, "")
    .replace(/^#+\s.*$/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

/** One mail per thing the agent reads when a case opens: the case file, the trigger document, and
 * each supplier's opening quote. */
export function buildMails(cases: CaseFile[]): Mail[] {
  const mails: Mail[] = [];
  for (const c of cases) {
    const base = { caseId: c.case_id, caseSet: c.set, caseTitle: c.title, case: c };
    const opened = c.quotes[0]?.received_at;
    const openedIso = opened ? new Date(opened * 1000).toISOString() : (c.trigger?.date ?? "2026-09-30");

    mails.push({
      ...base,
      id: `${c.case_id}/case`,
      folder: "cases",
      kind: "case",
      fromName: "Negotiation Arena",
      fromAddr: "case file",
      to: "Buyer agent",
      subject: `Case file ${c.case_id.replace("case:", "")}: ${c.title}`,
      preview: preview(c.briefing),
      body: c.briefing,
      date: new Date(new Date(openedIso).getTime() - 60_000).toISOString(),
      attachments: [],
    });

    const t = c.trigger;
    if (t) {
      const internal = t.from.startsWith(OURS);
      const sent = t.kind === "rfq";
      mails.push({
        ...base,
        id: `${c.case_id}/trigger`,
        folder: sent ? "sent" : "inbox",
        kind: (["letter", "email", "memo", "rfq"].includes(t.kind) ? t.kind : "letter") as Mail["kind"],
        fromName: t.from,
        fromAddr: internal ? "internal" : t.doc_id,
        to: sent ? c.suppliers.map((s) => s.name).join("; ") : internal ? "Purchasing" : `${OURS} GmbH`,
        subject: t.title,
        preview: preview(t.body),
        body: t.body,
        date: `${t.date}T08:00:00Z`,
        attachments: [],
      });
    }

    for (const q of c.quotes) {
      mails.push({
        ...base,
        id: `${c.case_id}/${q.message_id}`,
        folder: "inbox",
        kind: "quote",
        fromName: c.suppliers.find((s) => s.id === q.supplier_id)?.name ?? q.from_name,
        fromAddr: q.from,
        to: q.to,
        subject: q.subject,
        preview: preview(q.body),
        body: q.body,
        date: new Date(q.received_at * 1000).toISOString(),
        attachments: q.attachments,
        quote: q,
      });
    }
  }
  return mails.sort((a, b) => b.date.localeCompare(a.date));
}
