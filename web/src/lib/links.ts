import owners from "@/data/links.json";

const owner = owners as Record<string, string>;
const page = (sup: string, anchor?: string) => `/suppliers/${sup.replace("sup:", "")}${anchor ? `#${anchor}` : ""}`;

/** Where a data ID is explained in the app, or null when no page covers it yet. */
export function hrefFor(id: string): string | null {
  if (id.startsWith("sup:")) return page(id);
  if (id.startsWith("sc:")) return page(`sup:${id.slice(3).split("@")[0]}`, "scorecards");
  const base = id.split("#")[0];
  if (owner[base]) return page(owner[base], base);
  return null;
}
