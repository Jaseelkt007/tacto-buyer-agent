"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Folder, Mail } from "@/lib/inbox";
import { KIND_LABEL, fileSize, fullDate, initials, listDate, monthGroup } from "@/lib/format";
import { AgentView } from "./AgentView";
import { MailBody } from "./MailBody";
import { BackIcon, BotIcon, ClipIcon, FileIcon, InboxIcon, PdfBadge, SearchIcon, SendIcon, TagIcon } from "./icons";

type Filter = "all" | "unread" | "attachments";

const FOLDERS: { id: Folder; label: string; icon: ReactNode }[] = [
  { id: "inbox", label: "Inbox", icon: <InboxIcon /> },
  { id: "sent", label: "Sent items", icon: <SendIcon /> },
  { id: "cases", label: "Case files", icon: <FileIcon /> },
];

function Avatar({ name, internal }: { name: string; internal?: boolean }) {
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold ${
        internal ? "bg-[var(--surface-3)] text-[var(--ink-2)]" : "bg-[var(--accent-wash)] text-[var(--accent-ink)]"
      }`}
      aria-hidden
    >
      {internal ? <BotIcon /> : initials(name)}
    </span>
  );
}

/** Short label for the case list: the name's first word without legal forms, two for the demo suppliers. */
function shortName(name: string) {
  const words = name.replace(/\b(GmbH|AG|KG|Co\.|s\.r\.o\.|Sp\.|z o\.o\.|&|und|Sohn)/g, "").trim().split(/\s+/);
  return words[0] === "Demo" ? words.slice(0, 2).join(" ") : words[0];
}

function CaseTag({ mail }: { mail: Mail }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-sm px-1.5 text-[11px] font-medium leading-5 ${
        mail.caseSet === "sandbox" ? "bg-[var(--surface-3)] text-[var(--ink-2)]" : "bg-[var(--tag-bg)] text-[var(--tag-fg)]"
      }`}
    >
      {mail.caseId.replace("case:", "")}
    </span>
  );
}

export function Mailbox({ mails, syncedAt }: { mails: Mail[]; syncedAt: string }) {
  const [folder, setFolder] = useState<Folder>("inbox");
  const [caseId, setCaseId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [read, setRead] = useState<Set<string>>(() => new Set());
  const [showAgent, setShowAgent] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  const cases = useMemo(() => {
    const seen = new Map<string, Mail>();
    for (const m of mails) if (!seen.has(m.caseId)) seen.set(m.caseId, m);
    return [...seen.values()].sort((a, b) => a.caseId.localeCompare(b.caseId, "en", { numeric: true }));
  }, [mails]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mails.filter(
      (m) =>
        (caseId ? m.caseId === caseId : m.folder === folder) &&
        (filter !== "unread" || !read.has(m.id)) &&
        (filter !== "attachments" || m.attachments.length > 0) &&
        (!q || `${m.fromName} ${m.subject} ${m.body} ${m.caseId}`.toLowerCase().includes(q)),
    );
  }, [mails, folder, caseId, filter, query, read]);

  const unread = (f: Folder) => mails.filter((m) => m.folder === f && !read.has(m.id)).length;
  const current = mails.find((m) => m.id === selected) ?? null;

  const open = useCallback((id: string) => {
    setSelected(id);
    setRead((r) => (r.has(id) ? r : new Set(r).add(id)));
    history.replaceState(null, "", `#${id}`);
  }, []);

  // Deep link: /#case:P01/msg:70110-0-0 opens that mail in its folder (handy when presenting).
  useEffect(() => {
    function fromHash() {
      const id = decodeURIComponent(location.hash.slice(1));
      const mail = mails.find((m) => m.id === id);
      if (!mail) return;
      setFolder(mail.folder);
      setCaseId(null);
      setSelected(id);
      setRead((r) => new Set(r).add(id));
    }
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [mails]);

  // Arrow keys move through the list, as in a desktop mail client.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const i = visible.findIndex((m) => m.id === selected);
      const next = visible[Math.min(visible.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))];
      if (next) {
        open(next.id);
        listRef.current?.querySelector(`[data-id="${CSS.escape(next.id)}"]`)?.scrollIntoView({ block: "nearest" });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, selected, open]);

  const title = caseId ? cases.find((c) => c.caseId === caseId)?.caseTitle : FOLDERS.find((f) => f.id === folder)?.label;

  return (
    <div className="flex h-full flex-col bg-[var(--page)] text-[var(--ink)]">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center gap-4 bg-[var(--bar)] px-4 text-white">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded bg-white/15 text-[12px] font-bold">HP</span>
          <span className="truncate text-[14px] font-semibold">Hollerau Pumpenwerke</span>
          <span className="hidden text-[13px] text-white/70 sm:inline">· Purchasing mail</span>
        </div>
        <label className="mx-auto hidden w-full max-w-xl items-center gap-2 rounded bg-white/95 px-3 py-1.5 text-[var(--ink)] md:flex">
          <SearchIcon className="text-[var(--ink-2)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mail, suppliers, data IDs"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-[var(--muted)]"
          />
        </label>
        <div className="ml-auto flex items-center gap-2 text-[13px] md:ml-0">
          <span className="hidden text-white/80 lg:inline">Buyer agent</span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20" title="Buyer agent">
            <BotIcon />
          </span>
        </div>
      </header>

      <div className="flex min-h-0 min-w-0 flex-1">
        {/* Folder pane */}
        <nav className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-[var(--line)] bg-[var(--surface-2)] py-3 lg:flex">
          <p className="px-4 pb-1 text-[12px] font-semibold text-[var(--ink-2)]">purchasing@hollerau</p>
          {FOLDERS.map((f) => {
            const active = !caseId && folder === f.id;
            const n = unread(f.id);
            return (
              <button
                key={f.id}
                onClick={() => {
                  setFolder(f.id);
                  setCaseId(null);
                }}
                className={`mx-2 flex items-center gap-3 rounded px-3 py-1.5 text-left text-[13px] ${
                  active ? "bg-[var(--select)] font-semibold" : "hover:bg-[var(--hover)]"
                }`}
              >
                <span className="text-[var(--ink-2)]">{f.icon}</span>
                <span className="flex-1">{f.label}</span>
                {n > 0 && <span className="text-[12px] font-semibold text-[var(--accent-ink)]">{n}</span>}
              </button>
            );
          })}

          <p className="mt-5 px-4 pb-1 text-[12px] font-semibold text-[var(--ink-2)]">Cases</p>
          {cases.map((c) => {
            const active = caseId === c.caseId;
            return (
              <button
                key={c.caseId}
                onClick={() => setCaseId(active ? null : c.caseId)}
                title={c.caseTitle}
                className={`mx-2 flex items-center gap-2 rounded px-3 py-1.5 text-left text-[13px] ${
                  active ? "bg-[var(--select)] font-semibold" : "hover:bg-[var(--hover)]"
                }`}
              >
                <TagIcon className="shrink-0 text-[var(--ink-2)]" />
                <CaseTag mail={c} />
                <span className="truncate">{c.case.suppliers.map((s) => shortName(s.name)).join(", ")}</span>
              </button>
            );
          })}
          <p className="mt-auto px-4 pt-6 text-[11px] text-[var(--muted)]">Snapshot {fullDate(syncedAt)}</p>
        </nav>

        {/* Message list */}
        <section
          className={`min-h-0 w-full min-w-0 shrink-0 flex-col border-r border-[var(--line)] bg-[var(--surface)] md:flex md:w-[380px] ${
            current ? "hidden" : "flex"
          }`}
        >
          <div className="border-b border-[var(--line)] px-4 pb-2 pt-3">
            <h2 className="truncate text-[16px] font-semibold">{title}</h2>
            <div className="mt-2 flex gap-1 text-[12px]">
              {(["all", "unread", "attachments"] as Filter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full px-2.5 py-0.5 capitalize ${
                    filter === f ? "bg-[var(--select)] font-semibold" : "text-[var(--ink-2)] hover:bg-[var(--hover)]"
                  }`}
                >
                  {f === "attachments" ? "Has files" : f}
                </button>
              ))}
            </div>
          </div>
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto" role="listbox" aria-label={title}>
            {visible.length === 0 && <p className="p-6 text-center text-[13px] text-[var(--muted)]">Nothing here.</p>}
            {visible.map((m, i) => {
              const group = monthGroup(m.date);
              const header = i === 0 || monthGroup(visible[i - 1].date) !== group;
              const isRead = read.has(m.id);
              const active = m.id === selected;
              return (
                <div key={m.id}>
                  {header && (
                    <div className="sticky top-0 z-10 bg-[var(--surface)] px-4 pb-1 pt-3 text-[12px] font-semibold text-[var(--ink-2)]">
                      {group}
                    </div>
                  )}
                  <button
                    data-id={m.id}
                    role="option"
                    aria-selected={active}
                    onClick={() => open(m.id)}
                    className={`relative flex w-full min-w-0 gap-3 overflow-hidden border-b border-[var(--line-soft)] px-4 py-2.5 text-left ${
                      active ? "bg-[var(--select)]" : "hover:bg-[var(--hover)]"
                    }`}
                  >
                    {!isRead && <span className="absolute inset-y-0 left-0 w-[3px] bg-[var(--accent)]" aria-label="unread" />}
                    <Avatar name={m.fromName} internal={m.kind === "case"} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className={`truncate text-[13px] ${isRead ? "" : "font-semibold"}`}>{m.fromName}</span>
                        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-[var(--ink-2)]">{listDate(m.date)}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className={`truncate text-[13px] ${isRead ? "text-[var(--ink-2)]" : "font-semibold text-[var(--accent-ink)]"}`}>
                          {m.subject}
                        </span>
                        {m.attachments.length > 0 && <ClipIcon className="shrink-0 text-[var(--ink-2)]" width={13} height={13} />}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1.5">
                        <CaseTag mail={m} />
                        <span className="truncate text-[12px] text-[var(--muted)]">{m.preview}</span>
                      </span>
                    </span>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Reading pane */}
        <main className={`min-h-0 min-w-0 flex-1 overflow-y-auto bg-[var(--surface)] ${current ? "block" : "hidden md:block"}`}>
          {current ? (
            <Reading mail={current} showAgent={showAgent} onToggleAgent={() => setShowAgent((v) => !v)} onBack={() => setSelected(null)} />
          ) : (
            <div className="grid h-full place-items-center p-8 text-center text-[var(--muted)]">
              <div>
                <InboxIcon width={40} height={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-[14px]">Select an item to read</p>
                <p className="mt-1 text-[12px]">↑ ↓ to move through the list</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Reading({
  mail,
  showAgent,
  onToggleAgent,
  onBack,
}: {
  mail: Mail;
  showAgent: boolean;
  onToggleAgent: () => void;
  onBack: () => void;
}) {
  const person = mail.quote?.from_name && mail.quote.from_name !== mail.fromName ? mail.quote.from_name : null;
  return (
    <article className="mx-auto max-w-[980px] px-4 py-5 sm:px-8">
      <div className="mb-3 flex items-center gap-2">
        <button onClick={onBack} className="rounded p-1 hover:bg-[var(--hover)] md:hidden" aria-label="Back to list">
          <BackIcon />
        </button>
        <span className="text-[12px] text-[var(--ink-2)]">{KIND_LABEL[mail.kind]}</span>
        <CaseTag mail={mail} />
        <button
          onClick={onToggleAgent}
          aria-pressed={showAgent}
          className={`ml-auto inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[12px] ${
            showAgent
              ? "border-[var(--accent-line)] bg-[var(--accent-wash)] text-[var(--accent-ink)]"
              : "border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--hover)]"
          }`}
        >
          <BotIcon width={14} height={14} />
          Agent view
        </button>
      </div>
      <h1 className="text-[20px] font-semibold leading-snug">{mail.subject}</h1>

      <div className="mt-4 flex items-start gap-3">
        <Avatar name={mail.fromName} internal={mail.kind === "case"} />
        <div className="min-w-0 flex-1 text-[13px]">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{mail.fromName}</span>
            <span className="text-[var(--ink-2)]">&lt;{mail.fromAddr}&gt;</span>
          </div>
          {person && <div className="text-[var(--ink-2)]">{person}</div>}
          <div className="text-[var(--ink-2)]">To: {mail.to}</div>
        </div>
        <time className="shrink-0 text-[12px] tabular-nums text-[var(--ink-2)]" dateTime={mail.date}>
          {fullDate(mail.date)}
        </time>
      </div>

      {mail.attachments.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {mail.attachments.map((a) => (
            <a
              key={a.href}
              href={a.href}
              target="_blank"
              rel="noreferrer"
              className="flex w-64 max-w-full items-center gap-3 rounded border border-[var(--line)] p-2 hover:bg-[var(--hover)]"
            >
              <PdfBadge />
              <span className="min-w-0">
                <span className="block truncate text-[13px]">{a.name}</span>
                <span className="block text-[11px] text-[var(--ink-2)]">{fileSize(a.size)}</span>
              </span>
            </a>
          ))}
        </div>
      )}

      <div className={`mt-6 grid gap-6 ${showAgent ? "xl:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
        <div className="min-w-0">
          <MailBody text={mail.body} />
        </div>
        {showAgent && <AgentView mail={mail} />}
      </div>
    </article>
  );
}
