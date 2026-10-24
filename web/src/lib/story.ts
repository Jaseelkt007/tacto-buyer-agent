// A run told as a story: the chapters of one negotiation, from the case opening to the score, with
// the data each chapter needs to draw itself. Built on the server from the snapshots; the result is
// plain data the client player steps through.

import type { PricePathProps } from "@/components/negotiation/PricePath";
import { contractData } from "./contracts";
import { caseCoverage, findDemand } from "./demand";
import { findPart, latestAsk, partData } from "./parts";
import { buildSteps, caseFile, CLAIM_LABEL, COST_LABEL, runsData, STATUS_LABEL, supplierName, versionOf, type Run, type Step } from "./runs";
import { OWNER_LABEL, supplierData } from "./suppliers";

export type Link = { label: string; href: string };

type Base = { title: string; short: string; lead: string; links: Link[] };

export type Verdict = { type: string; refs: string[]; asserted: string; result: string };

export type StoryStep = Base &
  (
    | {
        kind: "open";
        facts: [string, string][];
        mustHaves: string[];
        negotiable: string[];
        trigger: { doc_id: string; title: string; from: string; excerpt: string } | null;
        ask: { pct: number | null; price: number | null; from: string | null; notice: number | null } | null;
      }
    | {
        kind: "supplier";
        cards: {
          id: string;
          name: string;
          owner: string;
          rate: number;
          signals: { kind: string; id: string; matches: string[] }[];
          contract: { id: string; notice: number | null; otd: number | null; lateShare: number | null; lateDays: number | null } | null;
          scorecard: { id: string; colour: string; score: number } | null;
        }[];
      }
    | {
        kind: "cost";
        part: { id: string; description: string; unit: string };
        rows: { name: string; price: number | null; full: number; material: number; conversion: number; overhead: number; margin: number | null; source: string }[];
        drivers: { series: string; name: string; weight: number; change: number | null; fall: { from: string; to: string; pct: number } | null; values: [string, number][] }[];
        implied: number | null;
        share: number;
        asked: number | null;
      }
    | {
        kind: "demand";
        part: { id: string; uom: string };
        forecast: number | null;
        calledOff: number | null;
        change: number | null;
        fcId: string | null;
        past: { month: string; qty: number }[];
        future: { month: string; qty: number }[];
        coverage: { volume: number; months: number; premium: number; uncovered: number }[] | null;
        rivals: { id: string; supplier: string; price: number }[];
        sources: { name: string; status: string; quota: number }[];
      }
    | {
        kind: "plan";
        plans: {
          name: string;
          opening: number | null;
          theirOnOurs: number | null;
          anchor: number | null;
          ceiling: number | null;
          offer: number | null;
          sheets: number;
          claims: string[];
          source: string;
          ms: number;
        }[];
      }
    | {
        kind: "round";
        round: number;
        moves: {
          supplierId: string;
          name: string;
          status: string;
          price: number | null;
          prev: number | null;
          reasons: string[];
          inside: { from: string; to: string; text: string }[];
          verdicts: Verdict[];
          decision: { action: string; price: number | null; why: string | null; claims: string[]; ms: number; source: string; finalPush: boolean } | null;
          sent: Verdict[];
        }[];
        paths: PricePathProps[];
      }
    | {
        kind: "close";
        deal: boolean;
        endReason: string | null;
        score: number;
        cOpen: number | null;
        cDeal: number | null;
        cBest: number | null;
        cAlt: number | null;
        terms: { label: string; eur: number }[];
        price: number | null;
      }
  );

const priceOf = (t: Record<string, unknown>) => (typeof t.unit_price === "number" ? (t.unit_price as number) : null);
const asserted = (a: Record<string, number | string>) =>
  Object.entries(a)
    .map(([k, v]) => `${k.replace(/_/g, " ")} ${typeof v === "number" ? v.toLocaleString("en-GB") : v}`)
    .join(", ");
const pct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)} %`;
const eur = (v: number) => v.toLocaleString("en-GB", { style: "currency", currency: "EUR" });

/** Price path of one thread up to a round: supplier offers to `upto`, our offers to `upto + 1`. */
export function pathUpTo(run: Run, steps: Step[], sup: string, upto: number): PricePathProps {
  const mine = steps.filter((s) => s.supplierId === sup && s.round <= upto);
  const ds = run.decisions.filter((d) => d.supplier_id === sup && d.round <= upto);
  const last = mine.at(-1);
  const finished = upto >= Math.max(...steps.map((s) => s.round));
  const deal = finished && run.result.deal && run.result.supplier_id === sup;
  return {
    title: supplierName(run.case_id, sup),
    supplier: mine.filter((s) => priceOf(s.offer.terms) !== null).map((s) => ({ round: s.round, price: priceOf(s.offer.terms)!, label: STATUS_LABEL[s.offer.status] ?? s.offer.status })),
    ours: run.trace.flatMap((t) => {
      const m = t.move as { type?: string; supplier_id?: string; term_sheets?: { terms: Record<string, unknown> }[] };
      const p = m.term_sheets?.[0]?.terms.unit_price;
      return t.actor === "buyer" && m.type === "message" && m.supplier_id === sup && typeof p === "number" && t.round <= upto + 1
        ? [{ round: t.round, price: p, label: "Our offer" }]
        : [];
    }),
    ceiling: ds.findLast((d) => d.ceiling)?.ceiling ?? null,
    anchor: ds.find((d) => d.anchor)?.anchor ?? null,
    end: !last
      ? null
      : deal
        ? { round: last.round, price: (run.result.terms?.unit_price as number) ?? null, kind: "deal" }
        : last.offer.status === "walked_away"
          ? { round: last.round, price: null, kind: "walked" }
          : { round: last.round, price: null, kind: "open" },
  };
}

export function buildStory(run: Run): StoryStep[] {
  const c = caseFile(run.case_id);
  if (!c) return [];
  const steps = buildSteps(run);
  const sups = c.suppliers.map((s) => s.id);
  const partId = c.parts[0]?.id ?? "";
  const partNo = partId.replace("part:", "");
  const part = findPart(partId);
  const b = c.buyer;
  const out: StoryStep[] = [];
  const replay = { label: "Full replay", href: `/negotiations/${run.session_id}` };

  // 1. The case opens.
  const ask = part ? latestAsk(part) : null;
  out.push({
    kind: "open",
    title: "The case opens",
    short: "Case opens",
    lead: c.trigger
      ? `${c.trigger.from} sends “${c.trigger.title}”. The agent gets the case file and every supplier's opening quote.`
      : `The agent gets the case file and every supplier's opening quote.`,
    facts: [
      ["Goal", b.category_goal ?? "—"],
      ["Need", b.need_per_year ? `${b.need_per_year.toLocaleString("en-GB")} a year for ${b.horizon_years} ${b.horizon_years === 1 ? "year" : "years"}` : "—"],
      ["Price today", b.current_unit_price != null ? eur(b.current_unit_price) : "—"],
      ["If no deal", b.alternative ? `${b.alternative.kind.replace(/_/g, " ")}${b.alternative.ref ? ` (${b.alternative.ref})` : ""}` : "—"],
      ["Suppliers", c.suppliers.map((s) => s.name).join(", ")],
    ],
    mustHaves: (b.must_haves ?? []).map((m) => `${m.field.replace(/_/g, " ")} ${m.op} ${m.value}`),
    negotiable: c.negotiable,
    trigger: c.trigger ? { doc_id: c.trigger.doc_id, title: c.trigger.title, from: c.trigger.from, excerpt: c.trigger.body.replace(/\s+/g, " ").slice(0, 260) } : null,
    ask: ask ? { pct: ask.asked_pct, price: ask.asked_price, from: ask.effective_date, notice: ask.notice_days } : null,
    links: [{ label: "Read it in Mail", href: `/mail#${c.case_id}/${c.trigger ? "trigger" : "case"}` }],
  });

  // 2. The agent reads the suppliers (its dossier).
  const cards = sups.flatMap((id) => {
    const d = supplierData.details[id];
    if (!d) return [];
    const ctr = contractData.contracts.find((x) => x.supplier_id === id);
    const sc = d.scorecards.at(-1);
    return [
      {
        id,
        name: supplierName(run.case_id, id),
        owner: OWNER_LABEL[d.intel?.owner_type ?? ""] ?? "owner unknown",
        rate: d.signals.interest_rate,
        signals: (["cash", "work", "full"] as const).flatMap((k) => d.signals.evidence[k].map((e) => ({ kind: k, id: e.id, matches: e.matches }))),
        contract: ctr
          ? { id: ctr.id, notice: ctr.price_notice_days, otd: ctr.delivery.otd_requested_12m, lateShare: ctr.payment.late_share_12m, lateDays: ctr.payment.avg_days_late_12m }
          : null,
        scorecard: sc ? { id: sc.id, colour: sc.colour, score: sc.score } : null,
      },
    ];
  });
  if (cards.length) {
    const cash = cards.filter((x) => x.signals.some((s) => s.kind === "cash"));
    out.push({
      kind: "supplier",
      title: "The agent reads who it is dealing with",
      short: "Supplier",
      lead: cash.length
        ? `${cash.map((x) => x.name).join(", ")} ${cash.length > 1 ? "need" : "needs"} cash: money is worth more to ${cash.length > 1 ? "them" : "it"} than to us (8 %), so faster payment can buy a lower price.`
        : "Owner type sets what money is worth to each supplier; its letters and news show what it wants.",
      cards,
      links: [
        ...cards.map((x) => ({ label: `Supplier: ${x.name.split(" ").slice(0, 2).join(" ")}`, href: `/suppliers/${x.id.replace("sup:", "")}` })),
        ...cards.filter((x) => x.contract).slice(0, 1).map((x) => ({ label: "Contract", href: `/contracts/${x.contract!.id.replace("ctr:", "")}` })),
      ],
    });
  }

  // 3. Cost and market.
  if (part) {
    const rows = part.suppliers
      .filter((s) => sups.includes(s.supplier_id) && s.full_cost)
      .map((s) => {
        const row = part.should_cost.find((x) => x.id === s.full_cost!.source)!;
        const k = s.full_cost!.unit_cost / row.unit_cost;
        return {
          name: s.name,
          price: s.current_price,
          full: s.full_cost!.unit_cost,
          material: row.material_eur * k,
          conversion: row.conversion_eur * k,
          overhead: row.overhead_eur * k,
          margin: s.margin_pct,
          source: s.full_cost!.source,
        };
      });
    const fall = part.drivers.filter((d) => d.best_fall).sort((a, x) => a.best_fall!.pct - x.best_fall!.pct)[0];
    out.push({
      kind: "cost",
      title: "The agent checks what the part should cost",
      short: "Cost & market",
      lead:
        part.implied_change_12m_pct !== null
          ? `The market moved the part's cost ${pct(part.implied_change_12m_pct)} in 12 months${ask?.asked_pct != null ? `, against ${pct(ask.asked_pct)} asked` : ""}.${fall ? ` One index fell ${pct(fall.best_fall!.pct)}: an argument the arena will verify.` : ""}`
          : "Should-cost and the part's cost drivers tell the agent where the price should be.",
      part: { id: partId, description: part.description, unit: part.price_unit === 1 ? `per ${part.uom}` : `per ${part.price_unit} ${part.uom}` },
      rows,
      drivers: part.drivers.map((d) => ({
        series: d.series_id,
        name: d.name.replace(/^Producer prices DE: /, ""),
        weight: d.weight,
        change: d.change_12m?.pct ?? null,
        fall: d.best_fall ? { from: d.best_fall.from, to: d.best_fall.to, pct: d.best_fall.pct } : null,
        values: partData.series[d.series_id]?.values ?? [],
      })),
      implied: part.implied_change_12m_pct,
      share: part.index_share,
      asked: ask?.asked_pct ?? null,
      links: [
        { label: "Parts & Cost", href: `/parts/${partNo}` },
        ...(fall ? [{ label: `Market: ${fall.series_id}`, href: `/market/${fall.series_id}#${fall.best_fall!.from}..${fall.best_fall!.to}` }] : [{ label: "Market", href: "/market" }]),
      ],
    });
  }

  // 4. Demand and alternatives.
  const dm = findDemand(partId);
  if (dm) {
    const cov = caseCoverage(partId).find((x) => x.case_id === run.case_id);
    const rivals = dm.rfqs[0]?.quotes.filter((q) => !sups.includes(q.supplier_id) || sups.length > 1).map((q) => ({ id: q.id, supplier: q.supplier, price: q.unit_price })) ?? [];
    const worst = cov && cov.cells.length > 1 ? [...cov.cells].sort((a, x) => x.premium - a.premium)[0] : null;
    out.push({
      kind: "demand",
      title: "The agent checks how much we need, and the alternatives",
      short: "Demand",
      lead: `${dm.latest ? `We need ${dm.latest.qty_next_12m.toLocaleString("en-GB")} ${dm.uom} a year (${pct(dm.latest.change_pct ?? 0)} on last year).` : ""}${
        worst && worst.premium > 0 ? ` A deal that covers less would cost up to ${eur(worst.premium)} extra: the coverage trap.` : ""
      }${dm.sources.length === 1 ? " There is only one source." : ""}`,
      part: { id: partId, uom: dm.uom },
      forecast: dm.latest?.qty_next_12m ?? null,
      calledOff: dm.latest?.called_off_12m ?? null,
      change: dm.latest?.change_pct ?? null,
      fcId: dm.latest?.citable ? dm.latest.id : null,
      past: dm.calloff_history.slice(-12),
      future: dm.forecast_lines,
      coverage: cov && cov.cells.length > 1 ? cov.cells.map((x) => ({ volume: x.volume, months: x.months, premium: x.premium, uncovered: x.uncovered })) : null,
      rivals,
      sources: dm.sources.map((s) => ({ name: s.supplier, status: s.status, quota: s.quota_pct })),
      links: [{ label: "Demand & Sourcing", href: `/demand/${partNo}${cov ? "#coverage" : ""}` }],
    });
  }

  // 5. The plan: the engine's first decision per supplier.
  const first = sups
    .map((id) => {
      const st = steps.find((s) => s.supplierId === id && s.round === 0);
      const d = st?.decision;
      return {
        name: supplierName(run.case_id, id),
        opening: st ? priceOf(st.offer.terms) : null,
        theirOnOurs: d?.their_price_on_our_terms ?? null,
        anchor: d?.anchor ?? null,
        ceiling: d?.ceiling ?? null,
        offer: d?.price ?? null,
        sheets: d?.our_sheets.length ?? 0,
        claims: (d?.claims ?? []).map((k) => CLAIM_LABEL[k] ?? k),
        source: d?.source ?? "none",
        ms: Math.round((d?.seconds ?? 0) * 1000),
      };
    })
    .filter((p) => p.opening !== null);
  if (first.length) {
    const p = first[0];
    out.push({
      kind: "plan",
      title: "The agent plans its opening",
      short: "Plan",
      lead:
        p.anchor !== null && p.ceiling !== null
          ? `Code, not a language model, sets the numbers: anchor ${eur(p.anchor)}, ceiling ${eur(p.ceiling)} (the highest price that still beats walking away), arguments picked from the data.`
          : run.decisions.length
            ? "The engine sets the opening numbers."
            : `This agent (${run.agent}) keeps no decision log; its moves are in the rounds.`,
      plans: first,
      links: [replay],
    });
  }

  // 6. Each round.
  const rounds = [...new Set(steps.map((s) => s.round))].sort((a, x) => a - x);
  for (const r of rounds) {
    const at = steps.filter((s) => s.round === r);
    const moves = at.map((s) => {
      const prevStep = steps.filter((x) => x.supplierId === s.supplierId && x.round < r).at(-1);
      const d = s.decision;
      const sent = (s.reply?.interpreted?.claims ?? []).map((cl) => ({ type: CLAIM_LABEL[cl.type] ?? cl.type, refs: cl.refs, asserted: asserted(cl.asserted), result: "sent" }));
      return {
        supplierId: s.supplierId,
        name: supplierName(run.case_id, s.supplierId),
        status: r === 0 && s.offer.status === "open" ? "Opening quote" : (STATUS_LABEL[s.offer.status] ?? s.offer.status),
        price: priceOf(s.offer.terms),
        prev: prevStep ? priceOf(prevStep.offer.terms) : null,
        reasons: s.reasons,
        inside: s.inside.map((x) => ({ from: x.from, to: x.to, text: x.text })),
        verdicts: s.verdicts.map((v) => ({ type: CLAIM_LABEL[v.claim.type] ?? v.claim.type, refs: v.claim.refs, asserted: asserted(v.claim.asserted), result: v.result })),
        decision: d
          ? {
              action: s.reply?.type === "accept" ? "accept" : d.action,
              price: d.price ?? null,
              why: d.why ?? null,
              claims: (d.claims ?? []).map((k) => CLAIM_LABEL[k] ?? k),
              ms: Math.round(d.seconds * 1000),
              source: d.source,
              finalPush: !!d.final_push,
            }
          : s.reply?.type === "accept"
            ? { action: "accept", price: null, why: null, claims: [], ms: 0, source: "none", finalPush: false }
            : null,
        sent,
      };
    });
    const verified = moves.reduce((n, m) => n + m.verdicts.filter((v) => v.result === "verified").length, 0);
    const walked = moves.filter((m) => m.status === "Walked away");
    const accepted = moves.find((m) => m.decision?.action === "accept");
    const lead =
      r === 0
        ? `${moves.length > 1 ? `${moves.length} suppliers open` : "The supplier opens"} at ${moves.map((m) => (m.price !== null ? eur(m.price) : "—")).join(", ")}.`
        : walked.length
          ? `${walked.map((m) => m.name).join(", ")} walked away.`
          : accepted
            ? `${accepted.name} moves to ${accepted.price !== null ? eur(accepted.price) : "—"} and our agent accepts.`
            : `${moves.map((m) => `${m.name.split(" ")[0]} ${m.prev !== null && m.price !== null ? `${eur(m.prev)} → ${eur(m.price)}` : m.price !== null ? eur(m.price) : "—"}`).join("; ")}.${verified ? ` ${verified} of our arguments verified.` : ""}`;
    out.push({
      kind: "round",
      title: r === 0 ? "Opening offers, and our first counter" : `Round ${r}`,
      short: r === 0 ? "Openings" : `Round ${r}`,
      lead,
      round: r,
      moves,
      paths: sups.filter((id) => steps.some((s) => s.supplierId === id)).map((id) => pathUpTo(run, steps, id, r)),
      links: [replay, { label: "Arguments ledger", href: "/arguments" }],
    });
  }

  // 7. Close.
  const res = run.result;
  out.push({
    kind: "close",
    title: res.deal ? "The deal, and the score" : "No deal, and the score",
    short: "Score",
    lead: res.deal
      ? `Total cost over the contract ${eur(res.c_deal ?? 0)}, between the opening offer ${eur(res.c_open ?? 0)} and the best possible ${eur(res.c_best ?? 0)}: score ${Math.round((res.score ?? 0) * 100)}.`
      : `The case ended without a deal (${(run.end_reason ?? "no deal").replace("_", " ")}), so it scores the alternative: ${Math.round((res.score ?? 0) * 100)}.`,
    deal: !!res.deal,
    endReason: run.end_reason,
    score: res.score ?? 0,
    cOpen: res.c_open ?? null,
    cDeal: res.c_deal ?? null,
    cBest: res.c_best ?? null,
    cAlt: res.c_alt ?? null,
    terms: res.cost_breakdown
      ? Object.entries(res.cost_breakdown)
          .filter(([, v]) => Math.abs(v) >= 1)
          .map(([k, v]) => ({ label: COST_LABEL[k] ?? k, eur: v }))
      : [],
    price: res.terms ? priceOf(res.terms) : null,
    links: [...(res.deal ? [{ label: "Deal anatomy", href: `/negotiations/${run.session_id}/anatomy` }] : []), replay],
  });
  return out;
}

export const storyTitle = (run: Run) => `${run.case_id.replace("case:", "")} · ${caseFile(run.case_id)?.title ?? ""} · ${versionOf(run)}`;

/** Runs for the picker: by case, newest first, labelled with version and score. */
export function storyRuns() {
  return [...runsData.runs]
    .sort((a, b) => a.case_id.localeCompare(b.case_id) || b.when.localeCompare(a.when))
    .map((r) => ({ id: r.session_id, label: `${storyTitle(r)} · score ${Math.round((r.result.score ?? 0) * 100)}` }));
}
