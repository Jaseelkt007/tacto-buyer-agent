// Snapshot what our buyer agent sees when a case opens, for the inbox UI.
//
//   cd web && npm run sync
//
// Per hosted practice case and sandbox case: the case file (briefing, goal, need), the supplier's
// trigger letter from the data package, and each supplier's opening quote e-mail with its PDF -
// taken from the latest session we already played. It only reads: it never opens a session, so it
// uses no practice quota. The key comes from ../starter-kit/.env and never reaches the web app.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(WEB, "..");
const OUT_JSON = path.join(WEB, "src", "data", "inbox.json");
const OUT_FILES = path.join(WEB, "public", "inbox");

async function loadEnv() {
  const env = {};
  const text = await readFile(path.join(REPO, "starter-kit", ".env"), "utf8").catch(() => "");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
  return { url: process.env.ARENA_URL || env.ARENA_URL, key: process.env.ARENA_API_KEY || env.ARENA_API_KEY };
}

const { url: BASE, key: KEY } = await loadEnv();
if (!BASE || !KEY) {
  console.error("ARENA_URL / ARENA_API_KEY missing (starter-kit/.env)");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The arena allows 10 calls/s; stay well below.
async function api(p, { raw = false } = {}) {
  await sleep(150);
  const res = await fetch(BASE.replace(/\/$/, "") + p, { headers: { "X-API-Key": KEY } });
  if (!res.ok) throw new Error(`${res.status} ${p}: ${await res.text()}`);
  return raw ? Buffer.from(await res.arrayBuffer()) : res.json();
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
}

async function table(name) {
  const rows = parseCsv(await readFile(path.join(REPO, "data", "data", `${name}.csv`), "utf8"));
  return Object.fromEntries(rows.map((r) => [r.id, r]));
}

// data/correspondence/<id>.md: "# Title", then "kind - date - sender", then the body.
async function letter(docId) {
  if (!docId) return null;
  const file = path.join(REPO, "data", "correspondence", `${docId.replace(/^doc:/, "")}.md`);
  const text = await readFile(file, "utf8").catch(() => null);
  if (!text) return null;
  const lines = text.split("\n");
  const title = (lines.find((l) => l.startsWith("# ")) || "").slice(2).trim();
  const metaIdx = lines.findIndex((l) => / - \d{4}-\d{2}-\d{2} - /.test(l));
  const [kind, date, ...from] = metaIdx >= 0 ? lines[metaIdx].split(" - ") : [];
  const body = lines.slice(metaIdx + 1).join("\n").trim();
  return { doc_id: docId, title, kind: kind?.trim(), date: date?.trim(), from: from.join(" - ").trim(), body };
}

const suppliers = await table("suppliers");
const parts = await table("parts");

const cases = [];
for (const set of ["practice", "sandbox"]) {
  for (const c of await api(`/v1/cases?set=${set}`)) if (set === "sandbox" || c.hosted) cases.push({ ...c, set });
}

const sessions = [];
for (const set of ["practice", "sandbox"]) sessions.push(...(await api(`/v1/sessions?set=${set}`)));
const latest = {};
for (const s of sessions) {
  const cur = latest[s.case_id];
  if (!cur || s.created_at > cur.created_at) latest[s.case_id] = s;
}

await mkdir(OUT_FILES, { recursive: true });
const out = [];
for (const c of cases) {
  const session = latest[c.case_id];
  const quotes = [];
  if (session) {
    const state = await api(`/v1/sessions/${session.session_id}`);
    for (const sid of c.suppliers) {
      const thread = await api(`/v1/sessions/${session.session_id}/threads/${encodeURIComponent(sid)}`);
      const first = thread.messages.find((m) => m.from !== "buyer");
      if (!first) continue;
      const attachments = [];
      for (const a of first.attachments || []) {
        const dir = path.join(OUT_FILES, c.case_id.replace(":", "-"));
        await mkdir(dir, { recursive: true });
        const bytes = await api(`/v1/sessions/${session.session_id}/attachments/${encodeURIComponent(a.attachment_id)}`, {
          raw: true,
        });
        await writeFile(path.join(dir, a.name), bytes);
        attachments.push({ name: a.name, type: a.type, size: bytes.length, href: `/inbox/${path.basename(dir)}/${a.name}` });
      }
      const opening = state.opening?.[sid] || {};
      quotes.push({
        message_id: first.message_id,
        supplier_id: sid,
        from: first.from,
        from_name: first.from_name,
        to: first.to,
        subject: first.subject,
        body: first.body,
        received_at: session.created_at,
        attachments,
        term_sheets: first.term_sheets || [],
        alternatives: opening.alternatives || [],
        missing_fields: first.missing_fields || [],
        signals: first.signals || {},
        status: first.status,
        claims: opening.claims || [],
      });
    }
  }
  out.push({
    case_id: c.case_id,
    set: c.set,
    type: c.type,
    title: c.title,
    briefing: c.briefing,
    trigger: await letter(c.trigger_doc),
    parts: c.parts.map((p) => ({ id: p, description: parts[p]?.description ?? null })),
    suppliers: c.suppliers.map((s) => ({
      id: s,
      name: suppliers[s]?.name ?? quotes.find((q) => q.supplier_id === s)?.from_name?.split(", ").pop() ?? s,
      country: suppliers[s]?.country ?? null,
    })),
    negotiable: c.negotiable,
    fixed_terms: c.fixed_terms,
    term_options: c.term_options,
    round_limit: c.round_limit,
    refs: c.refs,
    buyer: c.buyer,
    session_id: session?.session_id ?? null,
    quotes,
  });
  console.log(`${c.case_id}  ${session ? `${quotes.length} quote(s) from ${session.session_id}` : "not played yet"}`);
}

await mkdir(path.dirname(OUT_JSON), { recursive: true });
await writeFile(OUT_JSON, JSON.stringify({ synced_at: new Date().toISOString(), cases: out }, null, 1));
console.log(`wrote ${path.relative(WEB, OUT_JSON)} (${out.length} cases)`);
