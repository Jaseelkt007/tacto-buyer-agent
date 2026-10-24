import owners from "@/data/links.json";

const owner = owners as Record<string, string>;
const page = (sup: string, anchor?: string) => `/suppliers/${sup.replace("sup:", "")}${anchor ? `#${anchor}` : ""}`;

/** Where a data ID is explained in the app, or null when no page covers it yet. */
export function hrefFor(id: string): string | null {
  if (id.startsWith("sup:")) return page(id);
  if (id.startsWith("sc:")) return page(`sup:${id.slice(3).split("@")[0]}`, "scorecards");
  if (id.startsWith("part:")) return `/parts/${id.slice(5)}`;
  // cost:<part> or cost:<part>-<supplier>: a should-cost row of that part.
  if (id.startsWith("cost:")) return `/parts/${id.slice(5).split("-")[0]}#${id}`;
  // idx:<series>@<month>: the series page, with that month selected in the claim checker.
  if (id.startsWith("idx:")) return `/market/${id.slice(4).split("@")[0]}#${id}`;
  const base = id.split("#")[0];
  if (owner[base]) return page(owner[base], base);
  return null;
}
