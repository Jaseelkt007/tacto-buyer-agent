// A saved run turned into playback frames for the "Inside a run" page: which part of the pipeline
// works at each moment, what it hands to the next, and what it found. Built on the server from the
// run log, the case file and the dossier snapshot; the client only plays the frames.
//
// Timing: our decision times are measured (decision log `seconds`). The run's total wall time is
// measured too; the rest of it is the supplier and the arena, spread evenly over the supplier's
// replies because the log keeps no per-reply timestamps.

import { buildSteps, caseFile, CLAIM_LABEL, STATUS_LABEL, supplierName, versionOf, type Run } from "./runs";
import { OWNER_LABEL, supplierData } from "./suppliers";

export type NodeId =
  | "case"
  | "quote"
  | "tables"
  | "letters"
  | "facts"
  | "reader"
  | "dossier"
  | "claims"
  | "economics"
  | "policy"
  | "writer"
  | "llm"
  | "arena"
  | "clock"
  | "sales"
  | "office"
  | "score";

export type Frame = {
  /** Seconds since the session opened (see the timing note above). */
  t: number;
  dur: number;
  node: NodeId;
  from?: NodeId;
  round: number;
  stage: "open" | "prepare" | "round" | "close";
  log: string;
  /** Lines the node shows in the detail panel from this frame on. */
  state?: string[];
  tone?: "good" | "bad" | "warn";
};

export type LiveRun = {
  id: string;
  label: string;
  caseId: string;
  title: string;
  suppliers: string[];
  seconds: number;
  ourMs: number;
  decisions: number;
  llmMoves: number;
  rounds: number;
  argsSent: number;
  argsVerified: number;
  score: number;
  deal: boolean;
  frames: Frame[];
};

const eur = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString("en-GB", { style: "currency", currency: "EUR" }));
const priceOf = (t: Record<string, unknown>) => (typeof t.unit_price === "number" ? (t.unit_price as number) : null);
const short = (name: string) => name.split(" ").slice(0, 2).join(" ");

export function buildLive(run: Run): LiveRun | null {
  const c = caseFile(run.case_id);
  if (!c) return null;
  const steps = buildSteps(run);
  const sups = c.suppliers.map((s) => s.id);
  const frames: Frame[] = [];
  const ourMs = run.decisions.reduce((s, d) => s + d.seconds * 1000, 0);
  const replies = steps.filter((s) => s.round > 0).length || 1;
  const total = Math.max(run.seconds ?? 0, ourMs / 1000 + 1);
  const supplierShare = Math.max(0.2, (total - ourMs / 1000) / (replies + sups.length));
  let t = 0;
  const push = (f: Omit<Frame, "t">, advance = f.dur) => {
    frames.push({ ...f, t });
    t += advance;
  };
  const b = c.buyer;

  // The session opens: the case file and every opening quote arrive.
  push({
    node: "case",
    round: 0,
    stage: "open",
    dur: 0.01,
    log: `Session opens: ${c.case_id.replace("case:", "")}, ${c.title}`,
    state: [
      `Goal: ${b.category_goal ?? "—"}`,
      `Need: ${b.need_per_year?.toLocaleString("en-GB") ?? "—"} a year for ${b.horizon_years ?? "—"} years`,
      `Price today: ${eur(b.current_unit_price)}`,
      `If no deal: ${b.alternative ? b.alternative.kind.replace(/_/g, " ") : "—"}`,
      `Negotiable: ${c.negotiable.join(", ")}`,
    ],
  });
  for (const id of sups) {
    const open = steps.find((s) => s.supplierId === id && s.round === 0);
    if (!open) continue;
    push(
      {
        node: "sales",
        round: 0,
        stage: "open",
        dur: supplierShare,
        log: `${short(supplierName(run.case_id, id))} sends its opening quote: ${eur(priceOf(open.offer.terms))}`,
        state: [`Opening quote ${eur(priceOf(open.offer.terms))} (${open.offer.offer_id})`, ...open.reasons.slice(0, 2)],
      },
      supplierShare / Math.max(1, sups.length),
    );
    push({
      node: "quote",
      from: "sales",
      round: 0,
      stage: "open",
      dur: 0.01,
      log: `Quote PDF received from ${short(supplierName(run.case_id, id))}`,
      state: [`${short(supplierName(run.case_id, id))}: ${eur(priceOf(open.offer.terms))}`, `Left to its standard terms: ${open.offer.missing_fields.join(", ") || "nothing"}`],
    });
  }

  // Prepare: once per case, before the first move.
  const first = run.decisions.filter((d) => d.round === 0);
  const setupS = Math.max(0.002, (first[0]?.seconds ?? 0.002) * 0.6);
  push({
    node: "reader",
    from: "quote",
    round: 0,
    stage: "prepare",
    dur: setupS / 5,
    log: "Quote reader: standard terms read from each quote PDF",
    state: ["Reads every line of the quote PDF; an unreadable line is skipped, the rest kept", "Fields a term sheet leaves out close on these terms"],
  });
  for (const id of sups) {
    const d = supplierData.details[id];
    if (!d) continue;
    const signals = (["cash", "work", "full"] as const).filter((k) => d.signals.evidence[k].length);
    const ctr = d.contract;
    const owner = OWNER_LABEL[d.intel?.owner_type ?? ""] ?? "owner unknown";
    push({
      node: "dossier",
      from: "tables",
      round: 0,
      stage: "prepare",
      dur: setupS / 10,
      log: `Dossier ${short(supplierName(run.case_id, id))}: ${owner}${ctr?.notice_days ? `, contract notice ${ctr.notice_days} days` : ""}`,
      state: [
        `${short(supplierName(run.case_id, id))}: ${owner}${d.intel?.equity_ratio_pct != null ? `, equity ${d.intel.equity_ratio_pct} %` : ""}`,
        ...(ctr ? [`Contract ${ctr.id}: ${ctr.payment_days ?? "—"} days, ${ctr.incoterm ?? "—"}, notice ${ctr.notice_days ?? "—"} days`] : []),
      ],
    });
    push({
      node: "dossier",
      from: "letters",
      round: 0,
      stage: "prepare",
      dur: setupS / 5,
      log: `Dossier ${short(supplierName(run.case_id, id))}: money worth ${(d.signals.interest_rate * 100).toFixed(1)} %${signals.length ? `; ${signals.map((k) => (k === "cash" ? "needs cash" : k === "work" ? "looks for work" : "capacity full")).join(", ")}` : ""}`,
      state: [
        `${short(supplierName(run.case_id, id))}: ${OWNER_LABEL[d.intel?.owner_type ?? ""] ?? "owner unknown"}, money worth ${(d.signals.interest_rate * 100).toFixed(1)} % a year (ours 8 %)`,
        ...signals.map((k) => `${k === "cash" ? "Needs cash" : k === "work" ? "Looks for work" : "Capacity full"}: ${d.signals.evidence[k][0].id} “${d.signals.evidence[k][0].matches[0]}”`),
      ],
      tone: signals.length ? "warn" : undefined,
    });
  }
  const bank = [...new Set(first.flatMap((d) => d.claims ?? []))];
  push({
    node: "claims",
    from: "facts",
    round: 0,
    stage: "prepare",
    dur: setupS / 5,
    log: bank.length ? `Claim bank: strongest first: ${bank.map((k) => CLAIM_LABEL[k] ?? k).join(", ")}` : "Claim bank: built from the data (this run kept no decision log)",
    state: bank.length ? bank.map((k) => `${CLAIM_LABEL[k] ?? k}: figure computed from the data, IDs checked against facts.json`) : ["No decision log for this agent"],
  });
  for (const d of first) {
    push({
      node: "economics",
      from: "case",
      round: 0,
      stage: "prepare",
      dur: setupS / 5,
      log: `Economics ${short(supplierName(run.case_id, d.supplier_id))}: anchor ${eur(d.anchor)}, ceiling ${eur(d.ceiling)}`,
      state: [
        `${short(supplierName(run.case_id, d.supplier_id))}: their price on our terms ${eur(d.their_price_on_our_terms)}`,
        `Anchor (first offer) ${eur(d.anchor)} · ceiling ${eur(d.ceiling)}`,
        `Walk-away limit: total cost ${d.limit ? `€${Math.round(d.limit).toLocaleString("en-GB")}` : "—"}`,
      ],
    });
  }

  // The rounds.
  const rounds = [...new Set(steps.map((s) => s.round))].sort((a, x) => a - x);
  let argsSent = 0;
  let argsVerified = 0;
  for (const r of rounds) {
    for (const s of steps.filter((x) => x.round === r)) {
      const name = short(supplierName(run.case_id, s.supplierId));
      const price = priceOf(s.offer.terms);
      if (r > 0) {
        for (const line of s.inside.slice(0, 3)) {
          push(
            { node: "office", round: r, stage: "round", dur: supplierShare / 4, log: `${name} inside: ${line.from} → ${line.to}: ${line.text}`, state: [`${line.from} → ${line.to}: ${line.text}`] },
            supplierShare / 4,
          );
        }
        push({
          node: "sales",
          from: "office",
          round: r,
          stage: "round",
          dur: supplierShare / 4,
          log: `${name}: ${STATUS_LABEL[s.offer.status] ?? s.offer.status}${price !== null ? ` at ${eur(price)}` : ""}`,
          state: [`${STATUS_LABEL[s.offer.status] ?? s.offer.status}${price !== null ? ` ${eur(price)}` : ""}`, ...s.reasons.slice(0, 2)],
          tone: s.offer.status === "walked_away" ? "bad" : s.offer.status === "agreed" ? "good" : undefined,
        }, supplierShare / 4);
        if (s.verdicts.length) {
          const ok = s.verdicts.filter((v) => v.result === "verified").length;
          argsVerified += ok;
          push({
            node: "arena",
            from: "sales",
            round: r,
            stage: "round",
            dur: 0.01,
            log: `Arena checks our ${s.verdicts.length} argument${s.verdicts.length > 1 ? "s" : ""}: ${s.verdicts.map((v) => `${CLAIM_LABEL[v.claim.type] ?? v.claim.type} ${v.result}`).join(", ")}`,
            state: s.verdicts.map((v) => `${v.result === "verified" ? "✓" : v.result === "contradicted" ? "✗" : "–"} ${CLAIM_LABEL[v.claim.type] ?? v.claim.type}: ${v.claim.refs.join(", ")} (${v.result})`),
            tone: ok === s.verdicts.length ? "good" : "warn",
          });
        }
      }
      const d = s.decision;
      const accepted = s.reply?.type === "accept";
      if (d || s.reply) {
        const ms = d ? d.seconds * 1000 : 0;
        const llm = d && d.source !== "engine";
        push({
          node: llm ? "llm" : "policy",
          from: "arena",
          round: r,
          stage: "round",
          dur: Math.max(0.001, ms / 1000),
          log: !d
            ? `${name}: our agent (no decision log) ${accepted ? "accepts" : "replies"}`
            : accepted
              ? `Policy: accept ${name}${d.why ? `: ${d.why}` : ""} (${ms.toFixed(0)} ms)`
              : `${llm ? "Engine error, LLM fallback writes the move" : "Policy"}: counter ${name} at ${eur(d.price)} (${ms.toFixed(0)} ms of the 60 s)`,
          state: d
            ? [
                accepted ? `Accept ${s.offer.offer_id}` : `Counter at ${eur(d.price)}`,
                d.their_price_on_our_terms ? `Their price on our terms ${eur(d.their_price_on_our_terms)}` : "",
                d.ceiling ? `Ceiling ${eur(d.ceiling)} · anchor ${eur(d.anchor)}` : "",
                d.why ?? "",
                d.error ? `Engine error: ${d.error}` : "",
                d.final_push ? "Pushed after a final offer" : "",
                `${ms.toFixed(1)} ms`,
              ].filter(Boolean)
            : ["No decision log for this agent"],
          tone: accepted ? "good" : llm || d?.final_push ? "warn" : undefined,
        });
        push({ node: "clock", round: r, stage: "round", dur: 0, log: `60 s rule: ${ms.toFixed(0)} ms used`, state: [`Last move: ${ms.toFixed(1)} ms of 60,000 ms`, "A late move counts as a timeout; three in a row end the thread"] }, 0);
        if (s.reply?.type === "message") {
          const claims = s.reply.interpreted?.claims ?? [];
          argsSent += claims.length;
          push({
            node: "writer",
            from: llm ? "llm" : "policy",
            round: r,
            stage: "round",
            dur: 0.001,
            log: `Writer: e-mail to ${name} with ${s.reply.term_sheets?.length ?? 0} term sheet${(s.reply.term_sheets?.length ?? 0) === 1 ? "" : "s"}${claims.length ? ` and ${claims.length} argument${claims.length > 1 ? "s" : ""}` : ""}`,
            state: [
              `Subject: ${s.reply.subject ?? ""}`,
              ...claims.map((cl) => `${CLAIM_LABEL[cl.type] ?? cl.type}: ${cl.refs.join(", ")}`),
              `${s.reply.term_sheets?.length ?? 0} term sheets (binding); the text does not bind`,
            ],
          });
          push({ node: "arena", from: "writer", round: r, stage: "round", dur: 0.01, log: `Arena delivers our e-mail to ${name}`, state: ["Message accepted: valid term sheets, at most 3 arguments checked"] });
        } else if (accepted) {
          push({ node: "arena", from: "policy", round: r, stage: "round", dur: 0.01, log: `Arena: deal signed with ${name} (${s.reply?.offer_id ?? ""})`, state: [`Accepted ${s.reply?.offer_id ?? ""}`], tone: "good" });
        } else if (s.reply?.type === "timeout") {
          push({ node: "clock", round: r, stage: "round", dur: 0, log: `Timeout on ${name}: no move within 60 s`, state: ["Timeout: our last offer repeated"], tone: "bad" });
        }
      }
    }
  }

  const res = run.result;
  push({
    node: "score",
    from: "arena",
    round: rounds.at(-1) ?? 0,
    stage: "close",
    dur: 0.01,
    log: res.deal
      ? `Deal: total cost €${Math.round(res.c_deal ?? 0).toLocaleString("en-GB")} · score ${Math.round((res.score ?? 0) * 100)}`
      : `No deal (${(run.end_reason ?? "").replace("_", " ")}) · score ${Math.round((res.score ?? 0) * 100)}`,
    state: [
      res.deal ? `Total cost €${Math.round(res.c_deal ?? 0).toLocaleString("en-GB")}` : "No deal",
      `Opening €${Math.round(res.c_open ?? 0).toLocaleString("en-GB")} · best €${Math.round(res.c_best ?? 0).toLocaleString("en-GB")}`,
      `Score ${Math.round((res.score ?? 0) * 100)} = (opening − deal) ÷ (opening − best)`,
    ],
    tone: res.deal ? "good" : "bad",
  });

  return {
    id: run.session_id,
    label: `${run.case_id.replace("case:", "")} · ${versionOf(run)} · score ${Math.round((res.score ?? 0) * 100)}`,
    caseId: run.case_id,
    title: c.title,
    suppliers: sups.map((id) => supplierName(run.case_id, id)),
    seconds: total,
    ourMs,
    decisions: run.decisions.length,
    llmMoves: run.decisions.filter((d) => d.source !== "engine").length,
    rounds: Math.max(0, ...rounds),
    argsSent,
    argsVerified,
    score: res.score ?? 0,
    deal: !!res.deal,
    frames,
  };
}
