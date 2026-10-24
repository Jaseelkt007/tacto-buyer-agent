import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { hrefFor } from "@/lib/links";

// Data IDs the agent can cite (brief: "Data IDs"), e.g. part:310010, idx:PPI-D351@2026-08.
const ID = /\b(?:sup|part|po|gr|inv|qn|ctr|quote|rfq|fc|idx|sc|cost|news|doc|offer):[A-Za-z0-9\-.#@]+/g;

/** A data ID; links to the page that explains it when there is one. */
export function DataId({ id }: { id: string }) {
  const href = hrefFor(id);
  const code = (
    <code
      className={`rounded bg-[var(--id-bg)] px-1 py-px font-mono text-[0.85em] text-[var(--id-fg)] ${
        href ? "underline decoration-[var(--accent-line)] underline-offset-2 hover:bg-[var(--select)]" : ""
      }`}
      title={href ? "Data ID: open its page" : "Data ID"}
    >
      {id}
    </code>
  );
  return href ? <Link href={href}>{code}</Link> : code;
}

/** Inline text: **bold** and data IDs. */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  text.split(/(\*\*[^*]+\*\*)/g).forEach((chunk, i) => {
    if (chunk.startsWith("**") && chunk.endsWith("**")) {
      out.push(<strong key={`b${i}`}>{chunk.slice(2, -2)}</strong>);
      return;
    }
    let last = 0;
    for (const m of chunk.matchAll(ID)) {
      const id = m[0].replace(/[.,;:)]+$/, "");
      const at = m.index ?? 0;
      out.push(chunk.slice(last, at));
      out.push(<DataId key={`i${i}-${at}`} id={id} />);
      last = at + id.length;
    }
    out.push(chunk.slice(last));
  });
  return out;
}

export function extractIds(text: string) {
  return [...new Set([...text.matchAll(ID)].map((m) => m[0].replace(/[.,;:)]+$/, "")))];
}

/** Paragraphs, "- " lists and inline marks; enough for the letters and quote e-mails. */
export function MailBody({ text }: { text: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className="space-y-3 text-[14px] leading-relaxed text-[var(--ink)]">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => /^\s*[-*] /.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-0.5 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*] /, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
