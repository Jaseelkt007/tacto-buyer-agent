// How the arena checks an index claim (brief/api.md, "Data you cite is checked"): two idx IDs of one
// series, at most 12 months apart, ending within the last 12 months of the data; the change is
// (later / earlier − 1) × 100 and a figure within ±0.5 percentage points is verified. Pure functions,
// usable on the server and in the browser.

export const DATA_MONTH = "2026-09"; // the data package is as of 2026-09-30
export const TOLERANCE_PP = 0.5;
export const MAX_GAP = 12;
export const MIN_INDEX_FALL = -0.5; // our agent cites falls of at least this much (claims.py)

export function monthsBetween(a: string, b: string) {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  return (by - ay) * 12 + (bm - am);
}

export function monthsBack(month: string, k: number) {
  let [y, m] = month.split("-").map(Number);
  m -= k;
  while (m <= 0) {
    m += 12;
    y -= 1;
  }
  return `${y}-${String(m).padStart(2, "0")}`;
}

export const idxId = (series: string, month: string) => `idx:${series}@${month}`;

export type WindowCheck = {
  from: string;
  to: string;
  change: number | null;
  gapOk: boolean;
  recentOk: boolean;
  /** "verified-able": the arena would accept this window. */
  valid: boolean;
  reason: string | null;
};

/** Change between two months of one series and whether the arena accepts the window. */
export function checkWindow(values: [string, number][], a: string, b: string): WindowCheck {
  const [from, to] = a <= b ? [a, b] : [b, a];
  const v1 = values.find((v) => v[0] === from)?.[1];
  const v2 = values.find((v) => v[0] === to)?.[1];
  const change = v1 && v2 !== undefined ? (v2 / v1 - 1) * 100 : null;
  const gap = monthsBetween(from, to);
  const gapOk = gap >= 1 && gap <= MAX_GAP;
  const recentOk = monthsBetween(to, DATA_MONTH) <= MAX_GAP - 1;
  const reason =
    change === null
      ? "no value for one of the months"
      : gap < 1
        ? "pick two different months"
        : !gapOk
          ? `${gap} months apart: the arena allows at most ${MAX_GAP} (else "irrelevant")`
          : !recentOk
            ? `ends ${to}: must end within the last 12 months of the data (${monthsBack(DATA_MONTH, 11)} or later), else "irrelevant"`
            : null;
  return { from, to, change, gapOk, recentOk, valid: reason === null, reason };
}

/** The arena's verdict on a figure for a valid window. */
export function verdict(check: WindowCheck, figure: number): "verified" | "contradicted" | "irrelevant" {
  if (!check.valid || check.change === null) return "irrelevant";
  return Math.abs(figure - check.change) <= TOLERANCE_PP ? "verified" : "contradicted";
}

/** Largest fall (or rise) over 1–12 months ending at the latest month: what our agent would cite. */
export function extremeWindow(values: [string, number][], kind: "fall" | "rise") {
  const last = values.at(-1);
  if (!last || monthsBetween(last[0], DATA_MONTH) > MAX_GAP - 1) return null;
  let best: { from: string; to: string; change: number } | null = null;
  for (let k = 1; k <= MAX_GAP; k++) {
    const prev = values.find((v) => v[0] === monthsBack(last[0], k));
    if (!prev || !prev[1]) continue;
    const change = (last[1] / prev[1] - 1) * 100;
    if (!best || (kind === "fall" ? change < best.change : change > best.change)) best = { from: prev[0], to: last[0], change };
  }
  return best;
}

export function change12m(values: [string, number][]) {
  const last = values.at(-1);
  if (!last) return null;
  const prev = values.find((v) => v[0] === monthsBack(last[0], 12));
  return prev ? { from: prev[0], to: last[0], change: (last[1] / prev[1] - 1) * 100 } : null;
}
