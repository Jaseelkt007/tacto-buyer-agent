"use client";

import type { ReactNode } from "react";
import { stats } from "@/lib/demo";
import { s } from "./styles";
import { Callout, CodeRef } from "./ui";

// Chapter 1 in plain words: how ProcuDeal works, whether it calls an LLM, and what runs in parallel.
// Numbers come from stats.json (runs/); behaviour from play.py, cli.py and the procudeal package.

const ms = (sec: number | null | undefined) => (sec === null || sec === undefined ? "—" : sec < 1 ? `${Math.max(1, Math.round(sec * 1000))} ms` : `${Math.round(sec)} s`);
const code = (text: string) => <span className={`${s.code} !text-[12.5px] text-[var(--d-ink)]`}>{text}</span>;

export function Pipeline() {
  const m = stats.moves;
  const t = m.seconds_by_source;
  const since = cleanSince();

  return (
    <div className="space-y-12">
      <Callout title="The short version">
        ProcuDeal negotiates with rules written in code. When a supplier replies, our code reads the e-mail, works out the total cost of every offer on the
        table, and decides whether to accept, counter or walk away. The e-mail we send back is filled in from a fixed template. No AI model is asked what to
        do. A Claude model is set up only as a backup: if our code crashes on a move, the model writes that one move, so the case is not lost.
      </Callout>

      <section>
        <SectionTitle>Do we use an LLM?</SectionTitle>
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <QA q="Does a normal move call an LLM?">
            <p>
              No. A move is plain computation: it takes about <b>{ms(t.engine_median)}</b>, and never more than {ms(t.engine_max)} in our runs. Nothing leaves
              the laptop except the e-mail we send to the arena.
            </p>
          </QA>
          <QA q={`What does "${m.kit_llm} of ${m.total} moves" mean?`}>
            <p>
              Over our {stats.totals.procudeal_runs} recorded practice runs the agent sent {m.total} messages. {m.kit_llm} of them were written by the backup
              model because our code failed on that move. All of them come from early versions{since ? <>; since {since.replace("engine ", "")}, every move came from our code.</> : "."}
            </p>
            <LlmByVersion />
          </QA>
          <QA q="Is a cloud model set up at all?">
            <p>
              Yes, as a safety net: Anthropic&apos;s Claude ({code("claude-opus-5-5")}, low effort), through the API key in our {code(".env")}. It costs
              nothing unless it is used.
            </p>
            <p className="mt-2">
              Two things to know: a backup move takes about <b>{ms(t.kit_llm_median)}</b> instead of {ms(t.engine_median)}, and the runner refuses to start
              when {code("LLM_MODEL")} is missing, even though a normal move never uses it.
            </p>
          </QA>
        </div>
      </section>

      <section>
        <SectionTitle>What runs in parallel</SectionTitle>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="xl:sticky xl:top-4 xl:self-start">
            <Architecture />
          </div>
          <div className="space-y-4">
            <QA q="Do we run several negotiations at once?" source={{ file: "starter-kit/arena_kit/play.py", line: 196 }}>
              <p>
                Yes. The runner keeps a pool of up to <b>10 workers</b>: 8 by default for practice, 10 in the final, which is also the arena&apos;s limit of
                open sessions. Each case gets its own worker and its own negotiator, so cases never share state. If one case crashes, the others keep going.
              </p>
            </QA>
            <QA q="Is anything parallel inside one case?" source={{ file: "starter-kit/arena_kit/play.py", line: 152 }}>
              <p>
                No. A case is one loop: decide, send, wait for the reply, decide again. Our decision takes milliseconds; the supplier&apos;s reply can take
                up to a minute, so the waiting is what takes time.
              </p>
              <p className="mt-2">
                In an RFQ with three suppliers we still answer one supplier at a time, starting with whoever has waited longest. That keeps it simple and
                safe, but the other suppliers&apos; 60-second clocks keep running while we wait on one reply.
              </p>
            </QA>
            <QA q="Do we extract supplier details ahead of time, or in parallel?" source={{ file: "starter-kit/arena_kit/agents/procudeal/dossier.py", line: 64 }}>
              <p>
                Neither: there is no separate extraction job. The data package is loaded once when the runner starts and shared by all workers. On the
                first move of a case, the negotiator builds a short dossier for each supplier, one after the other:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>its company record and who owns it, which sets how much faster payment is worth to it;</li>
                <li>its letters, meeting notes and news, scanned for signs that it needs cash, wants work or is at capacity;</li>
                <li>what the part should cost to make, and the arguments we can back with data;</li>
                <li>its standard terms, read from the quote PDF.</li>
              </ul>
              <p className="mt-2">
                The whole first move takes about <b>{ms(t.engine_first_move_median)}</b>, so preparing it earlier or in parallel would gain nothing.
                Database reads take turns behind one lock, because all workers share one connection.
              </p>
            </QA>
            <QA q="How are different jobs handled?" source={{ file: "starter-kit/arena_kit/play.py", line: 224 }}>
              <p>The same agent runs in three modes:</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>
                  <b>One case</b>, to test something: {code("arena play case:P01")}.
                </li>
                <li>
                  <b>All practice cases at once</b>: {code("arena run --set practice")}. It stops starting new cases when the daily quota runs out.
                </li>
                <li>
                  <b>The Live Final</b>: {code("arena run --set final")}. It checks the arena every 5 seconds, starts each wave&apos;s cases as soon as they
                  open, and gives each case the wave&apos;s deadline. 90 seconds before the cap, a fixed closing move takes the best valid offer or walks
                  away, so no case runs out of time undecided.
                </li>
              </ul>
              <p className="mt-2">Every practice run is saved as one file in runs/, which is where this page gets its numbers.</p>
            </QA>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle sub="The next chapters show each step in detail.">A case in five steps</SectionTitle>
        <ol className="grid gap-3 md:grid-cols-5">
          {STEPS.map((st, i) => (
            <li key={st.title} className="rounded-lg border border-[var(--d-line)] bg-white px-4 py-4">
              <div className={s.label}>{String(i + 1).padStart(2, "0")}</div>
              <div className="mt-2 text-[15.5px] font-medium leading-snug">{st.title}</div>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--d-ink-2)]">{st.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

const STEPS = [
  { title: "Open the case", text: "Read the brief and every supplier's opening quote, including the PDF." },
  { title: "Get to know each supplier", text: "Build its dossier and the arguments we can prove with data." },
  { title: "Set our limits", text: "Price the best opening quote over the whole contract. That, or our fallback if it is cheaper, is the line any deal must beat. Our first offer goes well below it." },
  { title: "Answer each reply", text: "Re-price every offer on the table. Accept if a supplier is ready; otherwise counter with up to 3 packages and data-backed arguments." },
  { title: "Close", text: "Accept the best valid offer, or walk away if none beats what we already have." },
];

function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="text-[24px] font-normal tracking-[-0.02em]">{children}</h2>
      {sub && <span className="text-[14px] text-[var(--d-muted)]">{sub}</span>}
    </div>
  );
}

function QA({ q, children, source }: { q: string; children: ReactNode; source?: { file: string; line: number } }) {
  return (
    <div className="rounded-lg border border-[var(--d-line)] bg-white px-5 py-4">
      <h3 className="text-[16.5px] font-medium tracking-[-0.01em]">{q}</h3>
      <div className="mt-2 text-[14.5px] leading-relaxed text-[var(--d-ink-2)] [&_b]:font-medium [&_b]:text-[var(--d-ink)]">{children}</div>
      {source && (
        <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--d-muted)]">
          In the code <CodeRef file={source.file} line={source.line} />
        </div>
      )}
    </div>
  );
}

/** The first version after which no recorded move came from the LLM. */
function cleanSince() {
  const v = stats.by_version;
  let last = -1;
  v.forEach((x, i) => {
    if (x.kit_llm_moves > 0) last = i;
  });
  return last >= 0 && last < v.length - 1 ? v[last + 1].note : null;
}

/** LLM-written moves per engine version, oldest first: they stop after the early bugs. */
function LlmByVersion() {
  const versions = stats.by_version;
  const max = Math.max(1, ...versions.map((v) => v.kit_llm_moves));
  const causes = new Map<string, string>();
  for (const r of stats.moves.kit_llm_runs) if (!causes.has(r.note)) causes.set(r.note, r.cause);
  return (
    <div className="mt-4 border-t border-[var(--d-line-soft)] pt-3">
      <div className={s.label}>LLM-written moves per version</div>
      <ul className="mt-2 space-y-1.5">
        {versions.map((v) => (
          <li key={v.note} className="grid grid-cols-[96px_1fr_22px] items-center gap-2 text-[12.5px]">
            <span className="truncate text-[var(--d-ink-2)]">{versionName(v.note)}</span>
            <span className="h-2 rounded-r-[3px] bg-[var(--d-sunk)]">
              {v.kit_llm_moves > 0 && <span className="block h-full rounded-r-[3px] bg-[var(--d-llm)]" style={{ width: `${(v.kit_llm_moves / max) * 100}%` }} />}
            </span>
            <span className="text-right tabular-nums">{v.kit_llm_moves}</span>
          </li>
        ))}
      </ul>
      <ul className="mt-3 space-y-1 text-[12.5px] leading-relaxed text-[var(--d-muted)]">
        {[...causes].map(([note, cause]) => (
          <li key={note}>
            <span className="text-[var(--d-ink-2)]">{versionName(note)}:</span> {plainCause(cause)}
          </li>
        ))}
      </ul>
    </div>
  );
}

const versionName = (note: string) => (note === "phase0 wrapper" ? "first test" : note.replace("engine ", ""));

// The causes as the decision log explains them (docs/decision-log.md).
function plainCause(cause: string) {
  if (/phase0/.test(cause)) return "the very first test ran the kit's LLM agent for every move, on purpose.";
  if (/KeyError\('payment_days'\)/.test(cause)) return "a bug reading the quote PDF crashed every move; the backup saved the cases. Fixed in v1.1.";
  if (/InterfaceError/.test(cause)) return "two cases read the shared database at the same moment. Fixed in v1.5b with the lock.";
  return cause;
}

/** Who runs what: one runner process, a pool of case workers, the arena on the other side. */
function Architecture() {
  const cases = ["P01", "P05", "P11", "…"];
  return (
    <div className="rounded-lg border border-[var(--d-line)] bg-white p-5">
      <div className={s.label}>How the work is split up</div>
      <div className="mt-4 space-y-3">
        <Box title="Runner" note="one process on our laptop">
          Loads the data package and the backup model client once, then hands out cases.
        </Box>
        <Arrow label="starts a worker for each case" />
        <div className="rounded-lg border border-dashed border-[#cfcfcf] p-3">
          <div className="mb-2 flex items-baseline justify-between text-[13px]">
            <span className="font-medium">Worker pool</span>
            <span className="text-[12px] text-[var(--d-muted)]">up to 10 cases at the same time</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {cases.map((c) => (
              <div key={c} className="rounded-md border border-[var(--d-line)] bg-[var(--d-panel-2)] px-2 py-2 text-center">
                <div className="text-[13px] font-medium">{c === "…" ? "…" : `Case ${c}`}</div>
                {c !== "…" && <div className="mt-0.5 text-[11px] text-[var(--d-muted)]">own negotiator</div>}
              </div>
            ))}
          </div>
          <div className="mt-2 text-[12px] text-[var(--d-muted)]">Inside a case: one e-mail at a time, oldest reply first.</div>
        </div>
        <Arrow label="e-mails and term sheets over the API" />
        <Box title="Tacto arena" note="the supplier bots">
          Each supplier answers in its own thread, within about a minute.
        </Box>
        <div className="flex flex-wrap gap-2 pt-1">
          <Shared>Shared by all workers: the data package, read-only</Shared>
          <Shared>One database connection, behind a lock</Shared>
        </div>
      </div>
    </div>
  );
}

function Box({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--d-line)] bg-[var(--d-panel-2)] px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[14.5px] font-medium">{title}</span>
        <span className="text-[12px] text-[var(--d-muted)]">{note}</span>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-[var(--d-ink-2)]">{children}</p>
    </div>
  );
}

function Arrow({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pl-5 text-[12px] text-[var(--d-muted)]">
      <svg width="10" height="22" viewBox="0 0 10 22" aria-hidden>
        <path d="M5 0v19M1.5 15.5 5 19.5l3.5-4" fill="none" stroke="#b8b8b8" strokeWidth="1.4" />
      </svg>
      {label}
    </div>
  );
}

function Shared({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-[var(--d-line)] bg-white px-2.5 py-0.5 text-[12px] text-[var(--d-ink-2)]">{children}</span>;
}
