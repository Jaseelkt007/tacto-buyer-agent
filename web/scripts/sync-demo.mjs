// Snapshot the data for the demo page: how our buyer agent (procudeal) negotiates, end to end.
//
//   cd web && npm run sync:demo
//
// Reads the benchmark runs scripts/bench.py saved (runs/<case>/<stamp>_<agent>_<session>.json: the
// arena's trace, the supplier's back-office chatter and our engine's decision log per move) from the
// local runs/ folder (RUNS_DIR=<dir> reads another one), the case files sync-inbox already wrote to
// src/data/inbox.json, and ../data (the package `arena data` unpacked). It writes src/data/demo/:
//   showcase.json   3-4 complete sessions, each as one merged chronological timeline
//   stats.json      aggregates over every procudeal run, plus the naive / kit-llm baselines
//   suppliers.json  the supplier universe: master breakdowns, the 46 detailed suppliers, dossier flags
// It never calls the arena: no key, no quota.

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA, REPO, WEB, rows } from "./lib/package.mjs";

const OUT = path.join(WEB, "src", "data", "demo");
const DIR = process.env.RUNS_DIR ? path.resolve(WEB, process.env.RUNS_DIR) : path.join(REPO, "runs");
const AGENT = "procudeal";

// The signals our agent's dossier reads from letters and news. Mirrors
// starter-kit/arena_kit/agents/procudeal/dossier.py at 5cab21a (engine v1.6c); keep them in step.
const OWNER_RATE = { group: 0.05, private: 0.07, family: 0.075, founder: 0.1 };
const DEFAULT_RATE = 0.075;
const CASH_PREMIUM = 0.05;
const SIGNS = {
  cash_need:
    /overdue invoices|pay (?:our )?invoices|cash discount|liquidity|payment within \d+|pay(?:ing)? faster|faster payment|cash flow|skonto/gi,
  wants_work: /new customers|free capacity|order intake|short[- ]time work|utili[sz]ation (?:is )?low/gi,
  capacity_full: /capacity utili[sz]ation|cannot confirm your (?:full )?forecast|fully booked|at capacity/gi,
};
const SIGN_NOTES = { cash_need: "asks for faster payment / cash", wants_work: "looks for work", capacity_full: "capacity full" };

// ---------------------------------------------------------------- helpers

const by = (list, key) => {
  const m = new Map();
  for (const r of list) {
    const k = typeof key === "function" ? key(r) : r[key];
    m.set(k, [...(m.get(k) ?? []), r]);
  }
  return m;
};
const count = (list, f) => {
  const out = {};
  for (const x of list) {
    const k = String(f(x));
    out[k] = (out[k] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
};
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const last = (xs) => xs[xs.length - 1];
// Floats to 4 decimals on output (costs keep their cents, scores 4 places).
const round = (_k, v) => (typeof v === "number" && !Number.isInteger(v) ? Math.round(v * 1e4) / 1e4 : v);
const eur = (x) => (x == null ? "?" : `€${Number(x).toFixed(2)}`);
const versionKey = (note) => (note.match(/v(\d+)\.(\d+)(\w*)/) ?? []).slice(1).map((x, i) => (i < 2 ? x.padStart(3, "0") : x)).join(".");

async function loadRuns() {
  const out = [];
  for (const c of (await readdir(DIR)).sort()) {
    if (c.startsWith(".")) continue;
    for (const f of (await readdir(path.join(DIR, c)).catch(() => [])).sort()) {
      if (!f.endsWith(".json")) continue;
      const text = await readFile(path.join(DIR, c, f), "utf8");
      // Python's json writes Infinity / NaN (e.g. no ceiling when a case has no alternative).
      const d = JSON.parse(text.replace(/(?<=[:[,]\s*)-?(?:Infinity|NaN)(?=\s*[,\]}])/g, "null"));
      out.push({ file: `runs/${c}/${f}`, ...d });
    }
  }
  return out.sort((a, b) => a.case_id.localeCompare(b.case_id) || a.when.localeCompare(b.when));
}

// ---------------------------------------------------------------- inputs

const runs = await loadRuns();
const ours = runs.filter((r) => r.agent === AGENT);
const inbox = JSON.parse(await readFile(path.join(WEB, "src", "data", "inbox.json"), "utf8").catch(() => '{"cases":[]}'));
const caseBy = new Map(inbox.cases.map((c) => [c.case_id, c]));

const [suppliers, intel, contracts, clauses, scorecards, news, documents, shouldCost, sourcing, invoices] = await Promise.all(
  ["suppliers", "supplier_intel", "contracts", "contract_clauses", "scorecards", "news", "documents", "should_cost", "sourcing", "invoices"].map(rows),
);
const version = JSON.parse(await readFile(path.join(DATA, "datapackage.json"), "utf8")).version ?? null;
const supBy = new Map(suppliers.map((s) => [s.id, s]));

function supplierName(id, run) {
  const s = supBy.get(id);
  if (s) return { name: s.name, country: s.country };
  const c = caseBy.get(run?.case_id)?.suppliers?.find((x) => x.id === id);
  if (c) return { name: c.name, country: c.country ?? null };
  const b = run?.backoffice?.find((x) => x.supplier_id === id);
  return { name: b?.supplier ?? id, country: null };
}

// ---------------------------------------------------------------- one session as a timeline

/** Our decisions[] matched to the buyer moves of the arena trace: per supplier, in order. */
function joinDecisions(run) {
  const trace = run.session?.result?.trace ?? [];
  const queues = by(run.decisions ?? [], "supplier_id");
  const action = { message: "send", accept: "accept", walk_away: "walk_away" };
  const joined = new Map(); // trace index -> decision
  const problems = [];
  trace.forEach((t, i) => {
    if (t.actor !== "buyer" || !(t.move.type in action)) return; // timeouts are the arena's, not ours
    let sid = t.move.supplier_id;
    if (!sid) sid = [...queues.keys()].find((k) => queues.get(k)?.[0]?.action === action[t.move.type]); // walk_away has none
    const d = queues.get(sid)?.shift();
    if (!d) return problems.push(`trace[${i}] ${t.move.type} to ${sid}: no decision`);
    if (d.action !== action[t.move.type]) problems.push(`trace[${i}]: ${t.move.type} vs decision ${d.action}`);
    if (t.move.type === "message") {
      const sent = JSON.stringify((t.move.term_sheets ?? []).map((s) => s.terms));
      if (sent !== JSON.stringify(d.our_sheets)) problems.push(`trace[${i}]: sheets differ from decision round ${d.round}`);
    }
    if (t.move.type === "accept" && t.move.offer_id !== d.their_offer) problems.push(`trace[${i}]: accepted ${t.move.offer_id}, decision saw ${d.their_offer}`);
    joined.set(i, { ...d, supplier_id: d.supplier_id ?? sid });
  });
  for (const [sid, q] of queues) for (const d of q) problems.push(`decision round ${d.round} to ${sid} has no trace move`);
  return { joined, problems };
}

/** Why the session ended, in one plain sentence, and a category for the stats. */
function stopReason(run, joined) {
  const s = run.session ?? {};
  const r = run.result ?? {};
  const trace = s.result?.trace ?? [];
  const decisions = [...joined.values()];
  const lastBuyer = [...trace].reverse().find((t) => t.actor === "buyer" && t.move.type !== "timeout");
  const name = (id) => supplierName(id, run).name;
  const rounds = s.rounds;
  const limit = caseBy.get(run.case_id)?.round_limit ?? null;

  if (s.end_reason === "accepted" || lastBuyer?.move.type === "accept") {
    const d = [...decisions].reverse().find((x) => x.action === "accept");
    const price = r.terms?.unit_price ?? d?.their_terms?.unit_price;
    return {
      category: "accepted",
      who: "buyer",
      why: `We accepted ${name(r.supplier_id ?? d?.supplier_id)}'s ${d?.their_status ?? ""} offer ${r.offer_id ?? d?.their_offer} at ${eur(price)} per unit${d?.why ? ` because it passed our accept check (${d.why})` : ""}.`.replace("  ", " "),
    };
  }
  if (lastBuyer?.move.type === "walk_away") {
    const d = [...decisions].reverse().find((x) => x.action === "walk_away");
    return {
      category: "buyer_walked",
      who: "buyer",
      why: `We walked away after ${name(d?.supplier_id)}'s ${d?.their_status ?? "last"} offer (${eur(d?.their_terms?.unit_price)} per unit): ${d?.why ?? "no offer passed the accept check"}, so the case closes without a deal and scores our alternative.`,
    };
  }
  const walked = trace.filter((t) => t.actor !== "buyer" && t.move.status === "walked_away");
  if (walked.length) {
    const sid = last(walked).actor;
    const d = [...decisions].reverse().find((x) => x.supplier_id === sid);
    const pushed = d?.final_push;
    return {
      category: pushed ? "supplier_walked_after_final_push" : "supplier_walked",
      who: "supplier",
      why: pushed
        ? `${name(sid)} withdrew after we answered its final offer (${eur(d.their_price ?? d.their_terms?.unit_price)}) with a lower counter (${eur(d.price)}): no deal, so the case scores our alternative.`
        : `${name(sid)} withdrew from the negotiation in round ${last(walked).round}: no deal, so the case scores our alternative.`,
    };
  }
  if (s.end_reason === "timeout") return { category: "timeout", who: "arena", why: "The arena ended the session on timeouts: our moves came too late." };
  if (limit && rounds >= limit) return { category: "round_limit", who: "arena", why: `The round limit (${limit}) ran out before anyone closed: no deal.` };
  return { category: s.end_reason ?? "unknown", who: "arena", why: `The session ended (${s.end_reason}) without a deal.` };
}

function timeline(run) {
  const trace = run.session?.result?.trace ?? [];
  const { joined, problems } = joinDecisions(run);
  const bo = by(run.backoffice ?? [], (b) => `${b.round}|${b.supplier_id}`);
  const events = [];
  const push = (e) => events.push({ t_index: events.length, ...e });
  // Claims of our last e-mail per supplier, waiting for the supplier's reply to carry the results.
  const pending = new Map();

  trace.forEach((t, i) => {
    const m = t.move;
    if (t.actor === "buyer") {
      const d = joined.get(i) ?? null;
      const sid = m.supplier_id ?? d?.supplier_id ?? null;
      if (m.type === "message") {
        const reply = trace.slice(i + 1).find((x) => x.actor === sid);
        const results = reply?.move.claim_results ?? [];
        const claims = (m.interpreted?.claims ?? []).map((c, k) => ({ ...c, result: results.find((x) => x.index === k)?.result ?? null }));
        push({
          round: t.round, supplier_id: sid, kind: "buyer_email", subject: m.subject, text: m.body, refs: m.refs ?? [],
          term_sheets: (m.term_sheets ?? []).map((s) => s.terms), claims, supplier_reasons: [], decision: d, seconds: d?.seconds ?? null,
        });
        if (claims.length) pending.set(sid, { round: t.round, claims });
      } else if (m.type === "accept") {
        push({ round: t.round, supplier_id: sid, kind: "buyer_accept", text: d?.why ?? null, term_sheet_id: m.offer_id, term_sheets: [], claims: [], supplier_reasons: [], decision: d, seconds: d?.seconds ?? null });
      } else if (m.type === "walk_away") {
        push({ round: t.round, supplier_id: sid, kind: "buyer_walk", text: d?.why ?? null, term_sheets: [], claims: [], supplier_reasons: [], decision: d, seconds: d?.seconds ?? null });
      } else {
        // The arena logs a missed 60 s window as a timeout move: our last offer stands again.
        push({ round: t.round, supplier_id: sid, kind: "buyer_timeout", text: "No e-mail from us in this round (the arena counts a timeout; our last offer stands).", term_sheets: [], claims: [], supplier_reasons: [], decision: null, seconds: null });
      }
      return;
    }
    const sid = t.actor;
    const p = pending.get(sid);
    if (p && (m.claim_results ?? []).length) {
      push({
        round: t.round, supplier_id: sid, kind: "claim_check",
        text: p.claims.map((c) => `${c.type} (${c.refs.join(", ")}): ${c.result ?? "not checked"}`).join("\n"),
        term_sheets: [], claims: p.claims, supplier_reasons: [], decision: null, seconds: null,
      });
    }
    pending.delete(sid);
    const key = `${t.round}|${sid}`;
    for (const b of bo.get(key) ?? []) {
      push({ round: b.round, supplier_id: sid, kind: "backoffice", from: b.from, to: b.to, text: b.text, term_sheets: [], claims: [], supplier_reasons: [], decision: null, seconds: null });
    }
    bo.delete(key);
    push({
      round: t.round, supplier_id: sid, kind: "supplier_email", status: m.status, offer_id: m.offer_id, text: m.text,
      term_sheets: [{ term_sheet_id: m.offer_id, terms: m.terms }, ...(m.alternatives ?? []).map((a) => ({ term_sheet_id: a.offer_id, terms: a.terms }))],
      missing_fields: m.missing_fields ?? [], signals: m.signals ?? {}, claims: m.claims ?? [], claim_results: m.claim_results ?? [],
      supplier_reasons: t.reasons ?? [], decision: null, seconds: null,
    });
  });
  // Back-office lines with no matching supplier e-mail (e.g. its last thoughts): at the end.
  for (const list of bo.values()) {
    for (const b of list) push({ round: b.round, supplier_id: b.supplier_id, kind: "backoffice", from: b.from, to: b.to, text: b.text, term_sheets: [], claims: [], supplier_reasons: [], decision: null, seconds: null });
  }
  const stop = stopReason(run, joined);
  const r = run.result ?? {};
  push({
    round: trace.length ? last(trace).round : null, supplier_id: r.supplier_id ?? null, kind: "end", text: stop.why,
    term_sheets: r.terms ? [r.terms] : [], claims: [], supplier_reasons: [], decision: null, seconds: run.seconds ?? null,
    end_reason: run.session?.end_reason ?? null, deal: !!r.deal, score: r.score ?? null,
  });
  return { events, stop, problems, joined };
}

function showcase(run, why) {
  const s = run.session ?? {};
  const r = run.result ?? {};
  const c = caseBy.get(run.case_id);
  const { events, stop, problems } = timeline(run);
  return {
    pick: why,
    meta: {
      case_id: run.case_id, title: c?.title ?? null, type: c?.type ?? null, set: s.set ?? c?.set ?? null, file: run.file,
      note: run.note, commit: run.commit, when: run.when, seconds: run.seconds, session_id: run.session_id,
      score: r.score ?? null, c_open: r.c_open ?? null, c_deal: r.c_deal ?? null, c_best: r.c_best ?? null, c_alt: r.c_alt ?? null,
      deal: !!r.deal, supplier_id: r.supplier_id ?? null, offer_id: r.offer_id ?? null, terms: r.terms ?? null,
      end_reason: s.end_reason ?? null, rounds: s.rounds ?? null, round_limit: c?.round_limit ?? null, replay_url: s.replay_url ?? null,
      must_haves_ok: r.must_haves_ok ?? null, cost_breakdown: r.cost_breakdown ?? null,
      briefing: c?.briefing ?? null, negotiable: c?.negotiable ?? null, fixed_terms: c?.fixed_terms ?? null, term_options: c?.term_options ?? null,
      must_haves: c?.buyer?.must_haves ?? null, category_goal: c?.buyer?.category_goal ?? null, alternative: c?.buyer?.alternative ?? null,
      parts: c?.parts ?? null, trigger: c?.trigger ? { doc_id: c.trigger.doc_id, title: c.trigger.title, date: c.trigger.date, body: c.trigger.body } : null,
      threads: s.threads ?? null,
    },
    suppliers: Object.entries(s.opening ?? {}).map(([id, o]) => ({
      id, ...supplierName(id, run),
      opening: { offer_id: o.offer_id, status: o.status, terms: o.terms, alternatives: o.alternatives ?? [], missing_fields: o.missing_fields ?? [], signals: o.signals ?? {}, text: o.text },
      thread: s.threads?.[id] ?? null,
    })),
    timeline: events,
    stop: { who: stop.who, why: stop.why, category: stop.category },
    join_problems: problems,
  };
}

// ---------------------------------------------------------------- 1. showcase

const latest = (pred) => [...ours].reverse().find(pred);
const picks = [];
const add = (run, why) => run && !picks.some((p) => p.run.file === run.file) && picks.push({ run, why });

add(latest((r) => r.case_id === "case:P05" && Object.keys(r.session?.opening ?? {}).length > 1),
  "RFQ with three suppliers in parallel threads: our engine argues with verified index data, cites the leading rival quote and runs a reverse auction, then accepts the cheapest total cost.");
add(latest((r) => r.case_id === "case:P01" && r.result?.deal),
  "Single supplier price increase: verified facts and a payment-for-price trade bring the +9.5 % back close to the best possible cost in three rounds.");
{
  const pushed = (r) => r.session?.end_reason === "no_deal" && (r.decisions ?? []).some((d) => d.final_push);
  const run = latest((r) => r.case_id === "case:P04" && pushed(r)) ?? latest(pushed) ?? latest((r) => !r.result?.deal);
  const next = run && ours.find((r) => r.case_id === run.case_id && r.when > run.when && r.result?.deal);
  add(run, `A lesson: we countered below the supplier's final offer and it withdrew - no deal, score ${(run?.result?.score ?? 0).toFixed(2)}.` +
    (next ? ` The next engine (${next.note}) stopped pushing past final_offer and the same case scored ${next.result.score.toFixed(2)}.` : ""));
}
{
  const fell = (r) => (r.decisions ?? []).some((d) => d.source === "kit-llm" && d.error);
  const run = latest((r) => fell(r) && r.session?.end_reason === "walked_away") ?? latest(fell);
  const next = run && ours.find((r) => r.case_id === run.case_id && r.when > run.when && r.result?.deal);
  const err = run?.decisions.find((d) => d.source === "kit-llm" && d.error);
  add(run, `Robustness: the engine hit ${err?.error} in round ${err?.round}, so the kit's LLM agent wrote that move instead (coded fallback). ` +
    `Then the engine walked away at the final offer because nothing passed its accept check; with the alternative dearer than the opening quote that scored ${(run?.result?.score ?? 0).toFixed(2)}.` +
    (next ? ` The next engine (${next.note}) closed the same case at ${next.result.score.toFixed(2)}.` : ""));
}

const show = picks.map((p) => showcase(p.run, p.why));
for (const s of show) {
  if (s.join_problems.length) console.warn(`join problems in ${s.meta.file}:\n  ${s.join_problems.join("\n  ")}`);
}

// ---------------------------------------------------------------- 2. stats

const claimTypes = {};
const runRows = runs.map((run) => {
  const s = run.session ?? {};
  const r = run.result ?? {};
  const decs = run.decisions ?? [];
  const trace = s.result?.trace ?? [];
  const secs = decs.map((d) => d.seconds).filter((x) => typeof x === "number");
  const lastBuyer = [...trace].reverse().find((t) => t.actor === "buyer" && t.move.type !== "timeout");
  const { joined, problems } = joinDecisions(run);
  const stop = stopReason(run, joined);
  if (run.agent === AGENT) {
    trace.forEach((t, i) => {
      if (t.actor !== "buyer" || t.move.type !== "message") return;
      const reply = trace.slice(i + 1).find((x) => x.actor === t.move.supplier_id);
      (t.move.interpreted?.claims ?? []).forEach((c, k) => {
        const res = reply?.move.claim_results?.find((x) => x.index === k)?.result ?? "no_reply";
        const e = (claimTypes[c.type] ??= { total: 0 });
        e.total++;
        e[res] = (e[res] ?? 0) + 1;
      });
    });
  }
  return {
    case_id: run.case_id, file: run.file, agent: run.agent, note: run.note, commit: run.commit, when: run.when, seconds: run.seconds,
    score: r.score ?? null, deal: !!r.deal, c_open: r.c_open ?? null, c_deal: r.c_deal ?? null, c_best: r.c_best ?? null, c_alt: r.c_alt ?? null,
    end_reason: s.end_reason ?? null, rounds: s.rounds ?? null, n_suppliers: Object.keys(s.opening ?? {}).length,
    n_moves: decs.length, engine_moves: decs.filter((d) => d.source === "engine").length, kit_llm_moves: decs.filter((d) => d.source === "kit-llm").length,
    timeouts: trace.filter((t) => t.actor === "buyer" && t.move.type === "timeout").length,
    avg_move_seconds: mean(secs), max_move_seconds: secs.length ? Math.max(...secs) : null,
    final_action: lastBuyer?.move.type ?? null, stop: stop.category, stop_why: stop.why,
    errors: [...new Set(decs.filter((d) => d.error).map((d) => String(d.error)))],
    asks: count(decs.flatMap((d) => d.asks ?? []), (x) => x), traits: count(decs.flatMap((d) => d.traits ?? []), (x) => x),
    replay_url: s.replay_url ?? null, join_ok: run.agent !== AGENT || problems.length === 0,
  };
});
const ourRows = runRows.filter((r) => r.agent === AGENT);
const baseRows = runRows.filter((r) => r.agent !== AGENT);

const byVersion = [...by(ourRows, "note")].map(([note, list]) => ({
  note, n: list.length, mean_score: mean(list.map((r) => r.score ?? 0)), deals: list.filter((r) => r.deal).length,
  cases: [...new Set(list.map((r) => r.case_id))].sort(), mean_rounds: mean(list.map((r) => r.rounds ?? 0)),
  kit_llm_moves: list.reduce((a, r) => a + r.kit_llm_moves, 0), first_when: list[0].when,
})).sort((a, b) => a.first_when.localeCompare(b.first_when) || versionKey(a.note).localeCompare(versionKey(b.note)));

const byCase = [...by(ourRows, "case_id")].map(([case_id, list]) => {
  const best = list.reduce((a, b) => ((b.score ?? 0) > (a.score ?? 0) ? b : a));
  const lt = last(list);
  const base = (agent) => baseRows.filter((r) => r.case_id === case_id && r.agent === agent).map((r) => r.score ?? 0);
  return {
    case_id, title: caseBy.get(case_id)?.title ?? null, type: caseBy.get(case_id)?.type ?? null, n_runs: list.length,
    best_score: best.score, best_note: best.note, best_file: best.file,
    latest_score: lt.score, latest_note: lt.note, latest_rounds: lt.rounds, latest_stop: lt.stop, latest_file: lt.file,
    rounds: list.map((r) => r.rounds), scores: list.map((r) => ({ note: r.note, score: r.score })),
    naive: base("naive")[0] ?? null, kit_llm: base("llm")[0] ?? null,
  };
});
const latestPerCase = byCase.map((c) => c.latest_score ?? 0);

const kitLlmRuns = ourRows.filter((r) => r.kit_llm_moves).map((r) => ({
  file: r.file, case_id: r.case_id, note: r.note, kit_llm_moves: r.kit_llm_moves, engine_moves: r.engine_moves,
  cause: r.errors.length ? r.errors.join("; ") : r.note === "phase0 wrapper" ? "phase0 wrapper: every move came from the kit's LLM agent by design" : "no error recorded",
}));
const allDecs = ours.flatMap((r) => r.decisions ?? []);

const stats = {
  synced_at: new Date().toISOString(),
  source: path.relative(REPO, DIR) + "/",
  agent: AGENT,
  totals: {
    runs: runRows.length, procudeal_runs: ourRows.length, baseline_runs: baseRows.length,
    cases: byCase.length, deals: ourRows.filter((r) => r.deal).length,
    mean_score_all: mean(ourRows.map((r) => r.score ?? 0)),
    mean_score_latest_per_case: mean(latestPerCase),
    latest_version: last(byVersion)?.note ?? null,
    join_ok_runs: ourRows.filter((r) => r.join_ok).length,
  },
  by_version: byVersion,
  by_case: byCase,
  end_reasons: count(ourRows, (r) => r.end_reason),
  stop_categories: count(ourRows, (r) => r.stop),
  final_actions: count(ourRows, (r) => r.final_action),
  rounds_histogram: Object.fromEntries(Object.entries(count(ourRows, (r) => r.rounds)).sort((a, b) => Number(a[0]) - Number(b[0]))),
  moves: {
    total: allDecs.length,
    engine: allDecs.filter((d) => d.source === "engine").length,
    kit_llm: allDecs.filter((d) => d.source === "kit-llm").length,
    actions: count(allDecs, (d) => d.action),
    timeouts: ourRows.reduce((a, r) => a + r.timeouts, 0),
    errors: count(allDecs.filter((d) => d.error), (d) => d.error),
    kit_llm_runs: kitLlmRuns,
    avg_seconds: mean(allDecs.map((d) => d.seconds).filter((x) => typeof x === "number")),
    max_seconds: Math.max(...allDecs.map((d) => d.seconds).filter((x) => typeof x === "number")),
    // How long a decision takes, by who made it; the first engine move of a run also builds the dossiers.
    seconds_by_source: (() => {
      const secs = (ds) => ds.map((d) => d.seconds).filter((x) => typeof x === "number");
      const engine = secs(allDecs.filter((d) => d.source === "engine"));
      const llm = secs(allDecs.filter((d) => d.source === "kit-llm"));
      const first = secs(ours.map((r) => (r.decisions ?? [])[0]).filter((d) => d && d.source === "engine"));
      return {
        engine_median: median(engine), engine_max: engine.length ? Math.max(...engine) : null,
        engine_first_move_median: median(first),
        kit_llm_median: median(llm), kit_llm_max: llm.length ? Math.max(...llm) : null,
      };
    })(),
  },
  claims: {
    // What the arena made of each argument we wrote (one per sentence, max 3 checked per message).
    by_type: Object.fromEntries(Object.entries(claimTypes).sort((a, b) => b[1].total - a[1].total)),
    results: count(Object.entries(claimTypes).flatMap(([, v]) => Object.entries(v).filter(([k]) => k !== "total").flatMap(([k, n]) => Array(n).fill(k))), (x) => x),
    // The engine's own labels for the arguments it chose (decisions[].claims).
    engine_labels: count(allDecs.flatMap((d) => d.claims ?? []), (x) => x),
  },
  supplier_reading: {
    // What our signals reader detected in the supplier's replies (decisions[].asks / traits).
    asks: count(allDecs.flatMap((d) => d.asks ?? []), (x) => x),
    traits: count(allDecs.flatMap((d) => d.traits ?? []), (x) => x),
    runs_with_asks: ourRows.filter((r) => Object.keys(r.asks).length).length,
  },
  baselines: baseRows.map((r) => ({ case_id: r.case_id, agent: r.agent, note: r.note, score: r.score, deal: r.deal, rounds: r.rounds, end_reason: r.end_reason, file: r.file })),
  runs: ourRows,
};

// ---------------------------------------------------------------- 3. suppliers

const intelBy = new Map(intel.map((r) => [r.supplier_id, r]));
const docsBy = by(documents, "supplier_id");
const newsBy = by(news, "supplier_id");
const scBy = by(scorecards, "supplier_id");
const costBy = by(shouldCost.filter((r) => r.supplier_id), "supplier_id");
const genericCostParts = new Set(shouldCost.filter((r) => !r.supplier_id).map((r) => r.part_id));
const sourcingBy = by(sourcing, "supplier_id");
const clausesBy = by(clauses, "contract_id");
const contractBy = new Map(contracts.map((r) => [r.id, r]));
const invBy = by(invoices, "supplier_id");
const num = (x) => (x === "" || x == null ? null : Number(x));

// Which cases each supplier appears in (case files and the openings of the runs we played).
const inCases = new Map();
const note = (id, c) => inCases.set(id, [...new Set([...(inCases.get(id) ?? []), c])].sort());
for (const c of inbox.cases) for (const s of c.suppliers ?? []) note(s.id, c.case_id);
for (const r of runs) for (const id of Object.keys(r.session?.opening ?? {})) note(id, r.case_id);

const detailed = [];
for (const s of suppliers.filter((x) => x.detail === "full")) {
  const docs = (docsBy.get(s.id) ?? []).sort((a, b) => a.date.localeCompare(b.date));
  const items = newsBy.get(s.id) ?? [];
  // Same text the dossier scans: each document's subject + its file, each news headline + body.
  const texts = [];
  for (const d of docs) {
    const body = d.file ? await readFile(path.join(DATA, d.file), "utf8").catch(() => null) : null;
    texts.push({ id: d.id, text: body == null ? d.subject ?? "" : `${d.subject}\n${body}` });
  }
  for (const n of items) texts.push({ id: n.id, text: `${n.headline}\n${n.body ?? ""}` });
  const flags = {};
  for (const [k, re] of Object.entries(SIGNS)) {
    const hits = texts.map((t) => ({ id: t.id, matches: [...new Set([...t.text.matchAll(re)].map((m) => m[0]))] })).filter((h) => h.matches.length);
    flags[k] = { hit: hits.length > 0, evidence: hits };
  }
  const info = intelBy.get(s.id);
  const ownerRate = OWNER_RATE[info?.owner_type] ?? DEFAULT_RATE;
  const contract = s.contract_id ? contractBy.get(s.contract_id) : null;
  const inv = invBy.get(s.id) ?? [];
  const paid = inv.filter((x) => x.paid_date && x.due_date);
  const sc = (scBy.get(s.id) ?? []).sort((a, b) => a.quarter.localeCompare(b.quarter));
  const lsc = last(sc);
  const parts = (sourcingBy.get(s.id) ?? []).map((r) => r.part_id);
  detailed.push({
    id: s.id, name: s.name, country: s.country, category: s.category, abc_class: s.abc_class || null, blocked: s.blocked === "true",
    cases: inCases.get(s.id) ?? [],
    n_documents: docs.length, document_kinds: count(docs, (d) => d.kind), n_news: items.length,
    intel: info
      ? { owner_type: info.owner_type || null, legal_form: info.legal_form || null, staff: num(info.staff), turnover_eur: num(info.turnover_eur), turnover_band: info.turnover_band || null,
          equity_ratio_pct: num(info.equity_ratio_pct), credit_index: num(info.credit_index), credit_index_12m_ago: num(info.credit_index_12m_ago), vda63_grade: info.vda63_grade || null }
      : null,
    should_cost_rows: (costBy.get(s.id) ?? []).length,
    should_cost_generic_parts: parts.filter((p) => genericCostParts.has(p)).length,
    n_parts: parts.length,
    scorecard_rows: sc.length,
    latest_scorecard: lsc ? { quarter: lsc.quarter, score: num(lsc.score), otd_pct: num(lsc.otd_pct), ppm: num(lsc.ppm), class: lsc.class, colour: lsc.colour } : null,
    contract: contract ? { id: contract.id, type: contract.type, valid_to: contract.valid_to, payment_days: num(contract.payment_days), notice_days: num(contract.notice_days), price_basis: contract.price_basis } : null,
    contract_clauses: contract ? (clausesBy.get(contract.id) ?? []).length : 0,
    index_clauses: contract ? (clausesBy.get(contract.id) ?? []).filter((c) => c.series).length : 0,
    invoices: inv.length,
    late_paid_share: paid.length ? paid.filter((x) => x.paid_date > x.due_date).length / paid.length : null,
    payment_days: num(s.payment_days), skonto_pct: num(s.skonto_pct), skonto_days: num(s.skonto_days),
    dossier: {
      owner_rate: ownerRate,
      cash_premium: flags.cash_need.hit ? CASH_PREMIUM : 0,
      interest_rate: ownerRate + (flags.cash_need.hit ? CASH_PREMIUM : 0),
      cash_need: flags.cash_need.hit, wants_work: flags.wants_work.hit, capacity_full: flags.capacity_full.hit,
      notes: Object.keys(SIGN_NOTES).filter((k) => flags[k].hit).map((k) => SIGN_NOTES[k]),
      evidence: Object.fromEntries(Object.entries(flags).map(([k, v]) => [k, v.evidence])),
    },
  });
}

const supplierOut = {
  synced_at: new Date().toISOString(),
  data_version: version,
  total: suppliers.length,
  detailed_count: detailed.length,
  breakdown: {
    country: count(suppliers, (s) => s.country),
    category: count(suppliers, (s) => s.category || "none"),
    abc_class: count(suppliers, (s) => s.abc_class || "none"),
    blocked: count(suppliers, (s) => s.blocked === "true"),
    has_contract: count(suppliers, (s) => !!s.contract_id),
    detail: count(suppliers, (s) => s.detail || "none"),
  },
  dossier_rules: {
    owner_rate: OWNER_RATE, default_rate: DEFAULT_RATE, cash_premium: CASH_PREMIUM,
    signs: Object.fromEntries(Object.entries(SIGNS).map(([k, re]) => [k, re.source])),
    source: "starter-kit/arena_kit/agents/procudeal/dossier.py @ 5cab21a",
  },
  notes: ["sup:71999 is the old record of sup:70210 (renamed 2024), data/KNOWN_ISSUES.md #5."],
  in_cases: Object.fromEntries([...inCases].sort()),
  detailed,
  all: suppliers.map((s) => ({
    id: s.id, name: s.name, country: s.country, category: s.category || null, abc_class: s.abc_class || null,
    blocked: s.blocked === "true", detailed: s.detail === "full", ...(s.id === "sup:71999" ? { alias_of: "sup:70210" } : {}),
  })),
};

// ---------------------------------------------------------------- write

await mkdir(OUT, { recursive: true });
const write = async (name, obj) => {
  const text = JSON.stringify(obj, round) + "\n";
  await writeFile(path.join(OUT, name), text);
  return `${name} ${(text.length / 1024).toFixed(0)} KB`;
};
const showOut = { synced_at: new Date().toISOString(), source: path.relative(REPO, DIR) + "/", sessions: show };
console.log(
  [await write("showcase.json", showOut), await write("stats.json", stats), await write("suppliers.json", supplierOut)].join(", "),
);
for (const s of show) console.log(`  ${s.meta.case_id} ${s.meta.note} score ${s.meta.score?.toFixed(3)} rounds ${s.meta.rounds} ${s.stop.category}: ${s.timeline.length} events`);
console.log(`${ourRows.length} ${AGENT} runs (${ourRows.length - stats.totals.join_ok_runs} with join problems), ${baseRows.length} baselines, ${detailed.length}/${suppliers.length} detailed suppliers`);
