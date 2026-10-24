import owners from "@/data/links.json";
import demandParts from "@/data/demand-links.json";
import qnContracts from "@/data/qn-links.json";

const owner = owners as Record<string, string>;
const qnContract = qnContracts as Record<string, string>;
const demandPart = demandParts as Record<string, string>;
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
  // ctr:<no> or ctr:<no>#<clause>: the contract page, at that clause.
  if (id.startsWith("ctr:")) {
    const [no, clause] = id.slice(4).split("#");
    return `/contracts/${no}${clause ? `#clause-${clause}` : ""}`;
  }
  if (id.startsWith("qn:") && qnContract[id]) return `/contracts/${qnContract[id]}#${id}`;
  // fc:, rfq:, quote: open the part's Demand & Sourcing page at that row.
  if (demandPart[id]) return `/demand/${demandPart[id].replace("part:", "")}#${id}`;
  if (owner[id]) return page(owner[id], id);
  return null;
}
