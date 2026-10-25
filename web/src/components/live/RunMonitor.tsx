"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Replay,
  ReplayEvent,
  Scenario,
  Stage,
  V19Benchmark,
  V19Message,
} from "@/lib/v19";
import {
  ChartIcon,
  ContractIcon,
  DatabaseIcon,
  FactoryIcon,
  FileIcon,
  InboxIcon,
  ScaleIcon,
  SendIcon,
} from "@/components/icons";
import { EngineConnections } from "./EngineConnections";
import { dealStage, feedbackRoutes, type DealStage } from "@/lib/architecture";
import { ReviewInspector, ReviewNode } from "./ReviewExtension";
import { ReplyInterpretationInspector, ReplyInterpretationNode } from "./ReplyInterpretation";
import "./monitor.css";

const STAGES: Record<
  Stage,
  { title: string; text: string; tag: string; icon: ReactNode }
> = {
  records: {
    title: "Case & goals",
    text: "Targets, must-haves and room to negotiate.",
    tag: "BUYING BRIEF",
    icon: <DatabaseIcon />,
  },
  dossier: {
    title: "Supplier dossier",
    text: "Each supplier’s costs, history and supporting evidence.",
    tag: "SUPPLIER CONTEXT",
    icon: <FileIcon />,
  },
  claims: {
    title: "Evidence & arguments",
    text: "Compute each claim. Attach the supporting records.",
    tag: "SOURCE REFERENCES",
    icon: <ContractIcon />,
  },
  economics: {
    title: "Package economics",
    text: "Price the terms, quality and supplier health.",
    tag: "TOTAL COST",
    icon: <ChartIcon />,
  },
  policy: {
    title: "Decision policy",
    text: "Price the options. Accept, counter or walk away.",
    tag: "CODE-OWNED TERMS",
    icon: <ScaleIcon />,
  },
  writer: {
    title: "Email writer",
    text: "Turn the selected terms and evidence into an email.",
    tag: "PREPARED RESPONSE",
    icon: <SendIcon />,
  },
  supplier: {
    title: "Send to supplier",
    text: "Dispatch the reviewed email. Receive the supplier’s reply.",
    tag: "SEND & RECEIVE",
    icon: <InboxIcon />,
  },
  outcome: {
    title: "Acceptance & outcome",
    text: "Check the must-haves. Record the final deal.",
    tag: "RECORDED RESULT",
    icon: <FactoryIcon />,
  },
};

const money = (n: number | null | undefined, digits = 2) =>
  n == null
    ? "—"
    : n.toLocaleString("en-GB", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });
const label = (s: string) => s.replaceAll("_", " ");

function ControlIcon({
  kind,
}: {
  kind: "play" | "pause" | "reset" | "back" | "next" | "expand";
}) {
  const paths = {
    play: "m9 5 10 7-10 7Z",
    pause: "M8 5v14M16 5v14",
    reset: "M4 10a8 8 0 1 1 1 8M4 4v6h6",
    back: "m15 6-6 6 6 6",
    next: "m9 6 6 6-6 6",
    expand: "M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5",
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[kind]} />
    </svg>
  );
}

function Metric({
  title,
  value,
  note,
}: {
  title: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="monitor-metric">
      <span>{title}</span>
      <strong>{value}</strong>
      {note && <small>{note}</small>}
    </div>
  );
}

function EventDetail({
  event,
  replay,
}: {
  event: ReplayEvent;
  replay: Replay;
}) {
  const session = replay.session;
  switch (event.kind) {
    case "records":
      return (
        <>
          <dl className="monitor-facts">
            <dt>Case</dt>
            <dd>
              {session.case_id} · {label(session.goal)}
            </dd>
            <dt>Annual need</dt>
            <dd>{session.need?.toLocaleString("en-GB") ?? "—"} units</dd>
            <dt>Negotiable terms</dt>
            <dd>{session.negotiable.map(label).join(", ")}</dd>
          </dl>
          <Link
            className="monitor-text-link"
            href={`/mail#case:${session.case_id}/case`}
          >
            Open the case file <span>↗</span>
          </Link>
        </>
      );
    case "dossier": {
      const d = event.dossier;
      return (
        <>
          <p className="monitor-detail-name">{d.name}</p>
          <dl className="monitor-facts">
            <dt>Country / ownership</dt>
            <dd>
              {d.country} · {d.owner_type}
            </dd>
            <dt>Estimated full cost</dt>
            <dd>{money(d.full_cost)} / unit</dd>
            <dt>Source</dt>
            <dd>{d.full_cost_source}</dd>
            <dt>Estimated financing</dt>
            <dd>{(d.interest_rate * 100).toFixed(1)}% annually</dd>
            <dt>Latest defects</dt>
            <dd>{d.ppm ?? "—"} PPM</dd>
            <dt>Cash need</dt>
            <dd>{d.cash_need ? "Detected in source text" : "Not detected"}</dd>
            <dt>Seeking work</dt>
            <dd>{d.wants_work ? "Detected in source text" : "Not detected"}</dd>
            <dt>Capacity full</dt>
            <dd>
              {d.capacity_full ? "Detected in source text" : "Not detected"}
            </dd>
            <dt>Hedging</dt>
            <dd>{d.hedged ? "Detected in source text" : "Not detected"}</dd>
          </dl>
          <p className="monitor-footnote">
            Initial data-package estimate after the quote cap, before rate
            updates inferred from supplier offers. Financing and cost are
            estimates.
          </p>
          <h4>Source documents · {d.documents.length}</h4>
          <ul className="monitor-source-list">
            {d.documents.map((doc) => (
              <li key={doc.id}>
                <span>{doc.subject}</span>
                <code>{doc.id}</code>
              </li>
            ))}
          </ul>
          <Link
            className="monitor-text-link"
            href={`/suppliers/${d.supplier_id.replace("sup:", "")}`}
          >
            Explore this supplier ↗
          </Link>
        </>
      );
    }
    case "claims":
      return (
        <>
          <div className="monitor-tags">
            {event.claims.map((c, i) => (
              <span key={`${c}-${i}`}>{label(c)}</span>
            ))}
          </div>
          <h4>Supporting record IDs</h4>
          <ul className="monitor-source-list">
            {event.refs.map((ref) => (
              <li key={ref}>
                <code>{ref}</code>
              </li>
            ))}
          </ul>
          <p className="monitor-footnote">
            The arena checks claims after the message is sent. A reference alone
            does not prove that a claim was accepted.
          </p>
          <Link className="monitor-text-link" href="/arguments">
            Explore recorded claim checks ↗
          </Link>
        </>
      );
    case "economics":
    case "policy": {
      const d = event.decision;
      return (
        <>
          <div className="monitor-detail-metrics">
            <Metric title="Recorded proposal" value={money(d.price)} />
            <Metric title="Price ceiling" value={money(d.ceiling)} />
          </div>
          <dl className="monitor-facts">
            <dt>Action</dt>
            <dd>{label(d.action)}</dd>
            <dt>Opening anchor</dt>
            <dd>{money(d.anchor)}</dd>
            <dt>Package total cost</dt>
            <dd>{money(d.cost, 0)}</dd>
            <dt>Walk-away cost limit</dt>
            <dd>{money(d.limit, 0)}</dd>
            <dt>Decision source</dt>
            <dd>Python engine</dd>
            <dt>Measured decision time</dt>
            <dd>{(d.seconds * 1000).toFixed(0)} ms</dd>
          </dl>
          {d.why && <blockquote>{d.why}</blockquote>}
          {d.trade && <p className="monitor-callout">Term trade: {d.trade}</p>}
          <p className="monitor-footnote">
            A dash means this field was not logged for this move. v1.9 also
            refreshes its estimates as new supplier offers arrive.
          </p>
        </>
      );
    }
    case "writer":
    case "supplier":
      return <Message message={event.message} />;
    case "outcome":
      return (
        <>
          <div className="monitor-detail-metrics">
            <Metric
              title="Agreed unit price"
              value={money(session.result.unit_price)}
            />
            <Metric
              title="Case score / 100"
              value={session.result.score.toFixed(2)}
            />
          </div>
          <dl className="monitor-facts">
            <dt>Opening total cost</dt>
            <dd>{money(session.result.opening_cost)}</dd>
            <dt>Agreed total cost</dt>
            <dd>{money(session.result.deal_cost)}</dd>
            <dt>Must-haves</dt>
            <dd>All passed</dd>
            {session.result.terms.map((t) => (
              <div className="monitor-fact-row" key={t.label}>
                <dt>{t.label}</dt>
                <dd>{t.value}</dd>
              </div>
            ))}
          </dl>
          <Link
            className="monitor-text-link"
            href={`/negotiations/${session.id}/anatomy`}
          >
            Inspect the deal calculation ↗
          </Link>
        </>
      );
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}

function Message({ message }: { message: V19Message }) {
  return (
    <article className={`monitor-message is-${message.actor}`}>
      <header>
        <span>{message.actor === "buyer" ? "Our buyer" : "Supplier"}</span>
        <small>Round {message.round}</small>
      </header>
      {message.price != null && (
        <strong>
          {money(message.price)} <small>/ unit</small>
        </strong>
      )}
      <p>{message.body || label(message.status)}</p>
      {message.terms.map((terms, i) => (
        <details key={i}>
          <summary>Term sheet {i + 1}</summary>
          <dl className="monitor-facts">
            {terms.map((t) => (
              <div className="monitor-fact-row" key={t.label}>
                <dt>{t.label}</dt>
                <dd>{t.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      ))}
      {message.checks.length > 0 && (
        <div className="monitor-tags">
          {message.checks.map((c, i) => (
            <span key={i}>
              Claim {c.index + 1} · {label(c.result)}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export function RunMonitor({
  replay,
  options,
  benchmark,
}: {
  replay: Replay;
  options: Scenario[];
  benchmark: V19Benchmark;
}) {
  const router = useRouter();
  const { session, events } = replay;
  const [cursor, setCursor] = useState(0);
  const [requestedPlay, setRequestedPlay] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState<"map" | "log">("map");
  const [panel, setPanel] = useState<"conversation" | "inspect" | "review" | "feedback">(
    "conversation",
  );
  const [selected, setSelected] = useState<Stage | null>(null);
  const [supplier, setSupplier] = useState<string | null>(null);
  const [fullscreenError, setFullscreenError] = useState("");
  const shell = useRef<HTMLDivElement>(null);
  const lanes = useRef<HTMLDivElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const inspectorPane = useRef<HTMLElement>(null);
  const complete = cursor === events.length;
  const playing = requestedPlay && !complete;
  const visible = events.slice(0, cursor);
  const current = visible.at(-1);
  const supplierId =
    supplier ?? current?.supplierId ?? session.dossiers[0]?.supplier_id;
  const dossier = session.dossiers.find((d) => d.supplier_id === supplierId);
  const contextEvents = visible.filter(
    (event) =>
      event.kind === "records" ||
      event.kind === "outcome" ||
      event.supplierId === supplierId,
  );
  const selectedStage = selected ?? current?.kind ?? "records";
  const inspected = contextEvents.findLast(
    (event) => event.kind === selectedStage,
  );
  const activeStage =
    current && contextEvents.includes(current) ? dealStage[current.kind] : undefined;
  const winner = session.dossiers.find(
    (d) => d.supplier_id === session.result.supplier_id,
  );
  const mail = visible.filter(
    (e) =>
      (e.kind === "supplier" || e.kind === "writer") &&
      e.supplierId === supplierId,
  );
  const supplierQuote = mail.findLast((e) => e.kind === "supplier");
  const buyerOffer = mail.findLast((e) => e.kind === "writer");
  const supplierPrice =
    supplierQuote?.kind === "supplier" ? supplierQuote.message.price : null;
  const buyerPrice =
    buyerOffer?.kind === "writer" ? buyerOffer.message.price : null;
  const status = complete
    ? "Complete"
    : playing
      ? "Playing"
      : cursor
        ? "Paused"
        : "Ready to play";

  const jump = useCallback(
    (value: number) => {
      setRequestedPlay(false);
      setSelected(null);
      setCursor(Math.max(0, Math.min(events.length, value)));
    },
    [events.length],
  );
  const toggle = useCallback(() => {
    if (complete) setCursor(0);
    setSelected(null);
    setRequestedPlay(!playing);
  }, [complete, playing]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(
      () => setCursor((n) => Math.min(events.length, n + 1)),
      1500 / speed,
    );
    return () => window.clearTimeout(timer);
  }, [playing, cursor, speed, events.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest(
            "input, select, textarea, button, a, summary, [contenteditable]",
          ))
      )
        return;
      if ([" ", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
        event.preventDefault();
      if (event.key === " ") toggle();
      if (event.key === "ArrowLeft") jump(cursor - 1);
      if (event.key === "ArrowRight") jump(cursor + 1);
      if (event.key === "Home") jump(0);
      if (event.key === "End") jump(events.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, events.length, jump, toggle]);

  useEffect(() => {
    if (playing && conversation.current)
      conversation.current.scrollTop = conversation.current.scrollHeight;
  }, [cursor, playing, panel]);

  function inspect(stage: Stage) {
    setSelected(stage);
    setPanel("inspect");
    setRequestedPlay(false);
  }

  function inspectModel(model: "review" | "feedback") {
    setPanel(model);
    setSelected(null);
    setRequestedPlay(false);
    if (window.matchMedia("(max-width: 1050px)").matches)
      window.requestAnimationFrame(() =>
        inspectorPane.current?.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
          block: "start",
        }),
      );
  }

  function inspectReviewer() {
    inspectModel("review");
  }

  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await shell.current?.requestFullscreen();
    } catch {
      setFullscreenError("Full screen is unavailable in this browser.");
    }
  }

  function nodeValue(stage: DealStage) {
    const event = contextEvents.findLast((e) => dealStage[e.kind] === stage);
    if (!event) return null;
    switch (event.kind) {
      case "records":
        return `${session.negotiable.length} negotiable terms`;
      case "dossier":
        return `${money(event.dossier.full_cost)} estimated full cost`;
      case "claims":
        return `${event.claims.length} sourced arguments selected`;
      case "economics":
        return event.decision.cost == null
          ? "Acceptance economics checked"
          : `${money(event.decision.cost, 0)} package cost`;
      case "policy":
        return event.decision.action === "accept"
          ? "Accept the standing offer"
          : `${money(event.decision.price)} next offer`;
      case "writer":
        return `${event.message.terms.length} term sheet${event.message.terms.length === 1 ? "" : "s"} sent`;
      case "supplier":
        return `${money(event.message.price)} latest supplier quote`;
      case "outcome":
        return `${session.result.score.toFixed(2)} / 100 · all must-haves passed`;
      default: {
        const exhaustive: never = event;
        return exhaustive;
      }
    }
  }

  function card(stage: DealStage) {
    const info = STAGES[stage];
    const done = contextEvents.some((e) => dealStage[e.kind] === stage);
    const active = activeStage === stage;
    const value = nodeValue(stage);
    return (
      <button
        type="button"
        data-stage={stage}
        className={`monitor-node node-${stage} ${active ? "is-active" : ""} ${done ? "is-visited" : ""} ${selected === stage ? "is-inspected" : ""}`}
        onClick={() => inspect(stage)}
        aria-pressed={selected === stage}
        aria-label={`Inspect ${info.title}`}
      >
        <span className="monitor-node-top">
          <span className="monitor-node-icon">{info.icon}</span>
          <span className="monitor-node-tag">{info.tag}</span>
          <span className="monitor-node-plus">+</span>
        </span>
        <strong>{info.title}</strong>
        <span className="monitor-node-description">{info.text}</span>
        {value && (
          <span className="monitor-node-value">
            <i />
            {value}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="run-monitor" ref={shell}>
      <main className="monitor-main">
        <header className="monitor-header">
          <div>
            <p className="monitor-eyebrow">
              <span className="monitor-brand-dot" /> PROCUDEAL <span>/</span>{" "}
              ENGINE v1.9
            </p>
            <h1>
              How a deal <span>gets made.</span>
            </h1>
            <p>
              Know the supplier. Choose the move. Learn from every reply.
            </p>
          </div>
          <div className="monitor-header-actions">
            <Link href="/demo" className="monitor-text-link">
              Case story <span>↗</span>
            </Link>
            <span className="monitor-recorded">
              <i /> Recorded arena replay
            </span>
            <button
              className="monitor-icon-button"
              type="button"
              onClick={() => void fullscreen()}
              aria-label="Toggle full screen"
              title="Full screen"
            >
              <ControlIcon kind="expand" />
            </button>
          </div>
        </header>
        <details className="monitor-benchmark-details">
          <summary>
            <span>Recorded v1.9 benchmark</span>
            <strong>{benchmark.mean.toFixed(2)} mean</strong>
            <span>{benchmark.deals}/{benchmark.cases} valid deals</span>
            <span className="monitor-benchmark-toggle">View details</span>
          </summary>
          <section
          className="monitor-benchmark"
          aria-label="v1.9 ten-case benchmark"
        >
          <div className="monitor-benchmark-label">
            <span className="monitor-eyebrow">THE v1.9 BENCHMARK</span>
            <span>10 hosted practice cases</span>
          </div>
          <Metric
            title={`${benchmark.cases}-case mean / 100`}
            value={benchmark.mean.toFixed(2)}
          />
          <Metric
            title="Valid deals"
            value={`${benchmark.deals} / ${benchmark.cases}`}
          />
          <Metric
            title="Engine decisions"
            value={String(benchmark.engine_decisions)}
          />
          <Metric
            title="LLM decisions used"
            value={String(benchmark.llm_decisions)}
          />
          <Link href="/negotiations">
            Explore run history <span>↗</span>
          </Link>
        </section>
        </details>
        <div className="monitor-casebar">
          <div className="monitor-case-pick">
            <label htmlFor="monitor-case">PLAY A CASE</label>
            <select
              id="monitor-case"
              aria-label="Choose a v1.9 case"
              value={session.id}
              onChange={(e) => {
                router.push(`/live/${e.target.value}`);
              }}
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div
            className="monitor-case-score"
            role="group"
            aria-label={`${session.case_id} recorded final score`}
          >
            <Metric
              title={`${session.case_id} final score / 100`}
              value={session.result.score.toFixed(2)}
            />
          </div>
          <div className="monitor-shortcuts">
            {["P01", "P02", "P05"].map((id) => {
              const option = options.find((o) => o.label.startsWith(id));
              return (
                option && (
                  <Link
                    key={id}
                    href={`/live/${option.id}`}
                    aria-current={session.id === option.id ? "page" : undefined}
                  >
                    {id === "P01"
                      ? "Price increase"
                      : id === "P02"
                        ? "Protection trade"
                        : "3-supplier RFQ"}
                    <span>↗</span>
                  </Link>
                )
              );
            })}
          </div>
        </div>
        <div className="monitor-workspace">
          <section
            className="monitor-board"
            aria-label="Current buyer architecture with supplier feedback and two advisory LLMs"
          >
            <div className="monitor-board-toolbar">
              <div className="monitor-tabs" aria-label="Replay views">
                {[
                  { id: "map", name: "Deal flow" },
                  { id: "log", name: "Activity log" },
                ].map((tab) => (
                  <button
                    type="button"
                    key={tab.id}
                    aria-pressed={view === tab.id}
                    onClick={() => setView(tab.id === "map" ? "map" : "log")}
                  >
                    {tab.name}
                    {tab.id === "log" && <span>{cursor}</span>}
                  </button>
                ))}
              </div>
              <span className={`monitor-status ${playing ? "is-playing" : ""}`}>
                <i />
                {status}
              </span>
            </div>
            {view === "map" ? (
              <div className="monitor-canvas">
                <div className="monitor-runner">
                  <span>
                    <span className="monitor-diamond" /> From supplier context to an agreed deal
                  </span>
                  <small>
                    Two LLMs <b> / </b> One negotiation loop
                  </small>
                  <code>v1.9 + advisory LLMs</code>
                </div>
                <p className="monitor-dispatch-path" aria-label="Reviewed email delivery path">
                  <span>Decision policy</span><i aria-hidden="true">→</i>
                  <span>Email writer</span><i aria-hidden="true">→</i>
                  <strong>LLM Decision model</strong><i aria-hidden="true">→</i>
                  <span>Send to supplier</span>
                </p>
                <div className="monitor-deal-flow" ref={lanes}>
                  <EngineConnections
                    containerRef={lanes}
                    active={activeStage}
                  />
                  {card("dossier")}
                  {card("records")}
                  <div className="monitor-context-caption">
                    <span className="monitor-eyebrow">01 / THE STARTING POINT</span>
                    <p>Know who we’re buying from and what this deal needs.</p>
                  </div>
                  {card("policy")}
                  {card("writer")}
                    <ReviewNode
                      inspected={panel === "review"}
                      onInspect={inspectReviewer}
                    />
                  {card("supplier")}
                  <div className="monitor-loop-caption" aria-label="Negotiation feedback loop">
                    <strong>Supplier feedback feeds both LLMs</strong>
                    <span>Reply interpreter → decision policy</span>
                    <small>Decision reviewer → supported concerns</small>
                  </div>
                  <ReplyInterpretationNode
                      inspected={panel === "feedback"}
                      onInspect={() => inspectModel("feedback")}
                  />
                </div>
                <section className="monitor-feedback-routes" aria-label="Two supplier feedback paths">
                  {feedbackRoutes.map((route) => (
                    <div key={route.title}>
                      <h3>{route.title}</h3>
                      <span>{route.path}</span>
                      <p>{route.description}</p>
                    </div>
                  ))}
                </section>
                <div className={`monitor-deal-result ${complete ? "is-complete" : ""}`}>
                  <span aria-hidden="true">{complete ? "✓" : "↻"}</span>
                  <div>
                    <strong>{complete ? "Deal agreed" : "Negotiate until the deal works"}</strong>
                    <p>{complete ? `${money(session.result.unit_price)} / unit · ${session.result.score.toFixed(2)} / 100 · all must-haves passed` : "The policy chooses when to counter, accept or walk away."}</p>
                  </div>
                  {complete && <Link href={`/negotiations/${session.id}/anatomy`}>See the deal ↗</Link>}
                </div>
                <div className="monitor-trust-note">
                  <span>✓</span>
                  <p>
                    Both LLMs advise; code owns the terms. The recorded v1.9 replay
                    predates these two LLM stages.
                  </p>
                </div>
                <div className="monitor-map-legend">
                  <span>
                    <i className="legend-done" /> Visited
                  </span>
                  <span>
                    <i className="legend-active" /> Current stage
                  </span>
                  <span>
                    <i className="legend-review" /> Advisory stages & feedback
                  </span>
                  <span>
                    Click a stage to inspect its evidence <span>↗</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="monitor-log">
                <header>
                  <h2>The recorded run, step by step</h2>
                  <p>Choose any step to jump through the replay.</p>
                </header>
                {events.map((event, i) => (
                  <button
                    type="button"
                    className={i < cursor ? "is-revealed" : ""}
                    aria-current={i === cursor - 1 ? "step" : undefined}
                    key={i}
                    onClick={() => jump(i + 1)}
                  >
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <span>
                      <strong>{event.title}</strong>
                      <small>
                        {STAGES[event.kind].tag} · round {event.round}
                      </small>
                    </span>
                    <span>→</span>
                  </button>
                ))}
              </div>
            )}
            <div
              className="monitor-activity"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="monitor-activity-icon">
                {current ? (
                  STAGES[current.kind].icon
                ) : (
                  <ControlIcon kind="play" />
                )}
              </span>
              <div>
                <span className="monitor-eyebrow">
                  {current
                    ? `STEP ${String(cursor).padStart(2, "0")} · ${STAGES[current.kind].tag}`
                    : "READY WHEN YOU ARE"}
                </span>
                <h3>{current?.title ?? "Follow the logic behind the deal"}</h3>
                <p>
                  {current?.summary ??
                    "Press play to watch real offers and decisions move through our v1.9 engine."}
                </p>
              </div>
            </div>
          </section>
          <aside
            className="monitor-inspector"
            ref={inspectorPane}
            aria-label="Run evidence and supplier conversation"
          >
            <div
              className={`monitor-inspector-top ${panel === "review" || panel === "feedback" ? "is-review" : ""}`}
            >
              {panel === "review" ? (
                <>
                  <div className="monitor-eyebrow">
                    DECISION REVIEWER / SAVED EXAMPLES
                  </div>
                  <h2>A second look at the decision.</h2>
                  <p>
                    Saved synthetic examples, separate from this{" "}
                    {session.case_id} replay.
                  </p>
                </>
              ) : panel === "feedback" ? (
                <>
                  <div className="monitor-eyebrow">SUPPLIER FEEDBACK / CURRENT AGENT</div>
                  <h2>Read the reply. Close the loop.</h2>
                  <p>A structured supplier reading before the next policy decision.</p>
                </>
              ) : (
                <>
                  <div className="monitor-eyebrow">
                    {session.case_id} <span>/</span>{" "}
                    {session.dossiers.length > 1
                      ? "MULTI-SUPPLIER RFQ"
                      : "SUPPLIER NEGOTIATION"}
                  </div>
                  <h2>{session.title}</h2>
                  <p>
                    {session.need?.toLocaleString("en-GB")} units / year{" "}
                    <span>·</span> {session.result.rounds} recorded rounds
                  </p>
                  {session.dossiers.length > 1 && (
                    <div
                      className="monitor-supplier-tabs"
                      aria-label="Supplier threads"
                    >
                      {session.dossiers.map((d) => (
                        <button
                          type="button"
                          key={d.supplier_id}
                          aria-pressed={supplierId === d.supplier_id}
                          onClick={() => setSupplier(d.supplier_id)}
                        >
                          {d.name.split(" ").slice(0, 2).join(" ")}
                        </button>
                      ))}
                      {supplier && (
                        <button type="button" onClick={() => setSupplier(null)}>
                          Follow playback
                        </button>
                      )}
                    </div>
                  )}
                  <h3>{dossier?.name}</h3>
                  <div className="monitor-price-pair">
                    <Metric
                      title="Supplier offer"
                      value={money(supplierPrice)}
                    />
                    <span>→</span>
                    <Metric title="Our proposal" value={money(buyerPrice)} />
                  </div>
                </>
              )}
            </div>
            <div className="monitor-panel-tabs">
              <button
                type="button"
                aria-pressed={panel === "conversation"}
                onClick={() => setPanel("conversation")}
              >
                Conversation <span>{mail.length}</span>
              </button>
              <button
                type="button"
                aria-pressed={panel === "inspect"}
                onClick={() => setPanel("inspect")}
              >
                Inspector <span>↗</span>
              </button>
              <button
                type="button"
                aria-pressed={panel === "review"}
                onClick={inspectReviewer}
              >
                Reviewer
              </button>
              <button
                type="button"
                aria-pressed={panel === "feedback"}
                onClick={() => inspectModel("feedback")}
              >
                Feedback
              </button>
            </div>
            <div className="monitor-inspector-body" ref={conversation}>
              {panel === "conversation" ? (
                <>
                  {mail.length ? (
                    mail.map(
                      (event, i) =>
                        (event.kind === "supplier" ||
                          event.kind === "writer") && (
                          <Message key={i} message={event.message} />
                        ),
                    )
                  ) : (
                    <div className="monitor-empty">
                      <InboxIcon width={30} height={30} />
                      <h3>The conversation starts here</h3>
                      <p>
                        Supplier quotes and buyer offers appear as the replay
                        advances.
                      </p>
                      <span>
                        {session.decision_count} engine decisions ·{" "}
                        {session.result.rounds} rounds
                      </span>
                    </div>
                  )}
                  {complete && supplierId === session.result.supplier_id && (
                    <div className="monitor-deal">
                      <span>✓ DEAL AGREED</span>
                      <strong>
                        {money(session.result.unit_price)} <small>/ unit</small>
                      </strong>
                      <p>
                        {session.result.score.toFixed(2)} / 100 · all must-haves
                        passed
                      </p>
                      <Link href={`/negotiations/${session.id}/anatomy`}>
                        View the deal calculation ↗
                      </Link>
                    </div>
                  )}
                  {complete && supplierId !== session.result.supplier_id && (
                    <div className="monitor-callout">
                      This case was awarded to {winner?.name}.
                      <button
                        type="button"
                        className="monitor-text-link"
                        onClick={() => setSupplier(session.result.supplier_id)}
                      >
                        View winning supplier →
                      </button>
                    </div>
                  )}
                </>
              ) : panel === "review" ? (
                <ReviewInspector />
              ) : panel === "feedback" ? (
                <ReplyInterpretationInspector />
              ) : (
                <div className="monitor-detail">
                  <div className="monitor-eyebrow">
                    {STAGES[selectedStage].tag}
                  </div>
                  <h3>{STAGES[selectedStage].title}</h3>
                  <p>{inspected?.summary ?? STAGES[selectedStage].text}</p>
                  {inspected ? (
                    <EventDetail event={inspected} replay={replay} />
                  ) : (
                    <p className="monitor-callout">
                      This stage has not run yet. Advance playback to inspect
                      its recorded values.
                    </p>
                  )}
                </div>
              )}
            </div>
            <footer>
              {panel === "review" ? (
                <>
                  <span>
                    Saved reviewer evidence · original buyer action unchanged
                  </span>
                  <small>Offline study · not a stage in this replay</small>
                </>
              ) : panel === "feedback" ? (
                <>
                  <span>Validated observations · code owns the decision</span>
                  <small>Current architecture · absent from the v1.9 recording</small>
                </>
              ) : (
                <>
                  <Link href={`/negotiations/${session.id}`}>
                    Open the full saved trace <span>↗</span>
                  </Link>
                  <small>Original v1.9 suite · {session.commit}</small>
                </>
              )}
            </footer>
          </aside>
        </div>
        <div className="monitor-caption">
          <span>
            Stage order is illustrated; emails and decisions are recorded.
          </span>
          <span>
            Measured runtime {session.seconds.toFixed(1)}s <b>·</b> buyer
            decisions {(session.engine_seconds * 1000).toFixed(0)}ms
          </span>
        </div>
        {fullscreenError && (
          <p role="status" className="monitor-footnote">
            {fullscreenError}
          </p>
        )}
      </main>
      <footer className="monitor-playback">
        <div
          className="monitor-progress-line"
          style={{ width: `${(cursor / events.length) * 100}%` }}
        />
        <div className="monitor-playback-inner">
          <button
            type="button"
            className="monitor-play-button"
            onClick={toggle}
          >
            <ControlIcon
              kind={playing ? "pause" : complete ? "reset" : "play"}
            />
            {playing
              ? "Pause replay"
              : complete
                ? "Replay again"
                : cursor
                  ? "Resume replay"
                  : "Play negotiation"}
          </button>
          <button
            type="button"
            className="monitor-icon-button"
            aria-label="Reset replay"
            onClick={() => jump(0)}
            disabled={cursor === 0}
          >
            <ControlIcon kind="reset" />
          </button>
          <div className="monitor-seek">
            <div>
              <span>
                {current?.title ??
                  `${session.case_id} · ${session.decision_count} engine decisions`}
              </span>
              <code>
                {String(cursor).padStart(2, "0")} / {events.length}
              </code>
            </div>
            <input
              type="range"
              min={0}
              max={events.length}
              value={cursor}
              onChange={(e) => jump(Number(e.target.value))}
              aria-label="Replay step"
              aria-valuetext={
                current ? `Step ${cursor}: ${current.title}` : "Ready to play"
              }
            />
          </div>
          <div className="monitor-step-buttons">
            <button
              type="button"
              className="monitor-icon-button"
              aria-label="Previous step"
              onClick={() => jump(cursor - 1)}
              disabled={cursor === 0}
            >
              <ControlIcon kind="back" />
            </button>
            <button
              type="button"
              className="monitor-icon-button"
              aria-label="Next step"
              onClick={() => jump(cursor + 1)}
              disabled={complete}
            >
              <ControlIcon kind="next" />
            </button>
          </div>
          <select
            aria-label="Playback speed"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            <option value={0.5}>0.5× speed</option>
            <option value={1}>1× speed</option>
            <option value={2}>2× speed</option>
          </select>
          <span className="monitor-key-hint">
            <kbd>space</kbd> to play
          </span>
        </div>
      </footer>
    </div>
  );
}
