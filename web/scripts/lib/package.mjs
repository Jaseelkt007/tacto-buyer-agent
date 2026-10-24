// Readers for the data package in ../data (CSV tables and the correspondence texts).

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const REPO = path.resolve(WEB, "..");
export const DATA = path.join(REPO, "data");

export function parseCsv(text) {
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

/** All rows of data/data/<name>.csv, as strings. */
export async function rows(name) {
  return parseCsv(await readFile(path.join(DATA, "data", `${name}.csv`), "utf8"));
}

/** Rows keyed by their `id` column. */
export async function table(name) {
  return Object.fromEntries((await rows(name)).map((r) => [r.id, r]));
}

// data/correspondence/<id>.md: "# Title", then "kind - date - sender", then the body.
export async function letter(docId) {
  if (!docId) return null;
  const file = path.join(DATA, "correspondence", `${docId.replace(/^doc:/, "")}.md`);
  const text = await readFile(file, "utf8").catch(() => null);
  if (!text) return null;
  const lines = text.split("\n");
  const title = (lines.find((l) => l.startsWith("# ")) || "").slice(2).trim();
  const metaIdx = lines.findIndex((l) => / - \d{4}-\d{2}-\d{2} - /.test(l));
  const [kind, date, ...from] = metaIdx >= 0 ? lines[metaIdx].split(" - ") : [];
  const body = lines.slice(metaIdx + 1).join("\n").trim();
  return { doc_id: docId, title, kind: kind?.trim(), date: date?.trim(), from: from.join(" - ").trim(), body };
}

/** Empty CSV cells become null, numeric ones numbers. */
export function typed(row, numeric) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v === "" || v === undefined ? null : numeric.includes(k) ? Number(v) : v;
  }
  return out;
}
