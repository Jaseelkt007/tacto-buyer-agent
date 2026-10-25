import snapshot from "@/data/v19.json";

export const v19 = snapshot;
export type V19Session = (typeof snapshot.sessions)[number];
export type V19Dossier = V19Session["dossiers"][number];
export type V19Message = V19Session["messages"][number];
export type V19Decision = NonNullable<V19Message["decision"]>;
export type V19Benchmark = typeof snapshot.benchmark;

type EventBase = {
  title: string;
  summary: string;
  round: number;
  supplierId: string;
};

export type ReplayEvent = EventBase &
  (
    | { kind: "records" }
    | { kind: "dossier"; dossier: V19Dossier }
    | { kind: "claims"; claims: string[]; refs: string[] }
    | { kind: "economics" | "policy"; decision: V19Decision }
    | { kind: "writer" | "supplier"; message: V19Message }
    | { kind: "outcome" }
  );

export type Stage = ReplayEvent["kind"];
export type Replay = { session: V19Session; events: ReplayEvent[] };
export type Scenario = { id: string; label: string };

export const scenarios: Scenario[] = v19.sessions.map((s) => ({
  id: s.id,
  label: `${s.case_id} · ${s.title}`,
}));

export function buildReplay(session: V19Session): Replay {
  const events: ReplayEvent[] = [
    {
      kind: "records",
      title: "Start with the case and company records",
      summary: `${session.dossiers.length} supplier${session.dossiers.length === 1 ? "" : "s"}, a ${session.goal.replaceAll("_", " ")} goal and ${session.negotiable.length} negotiable terms.`,
      round: 0,
      supplierId: session.dossiers[0]?.supplier_id ?? "",
    },
  ];
  const prepared = new Set<string>();
  for (const message of session.messages) {
    const base = { round: message.round, supplierId: message.supplier_id };
    const dossier = session.dossiers.find(
      (d) => d.supplier_id === message.supplier_id,
    );
    const name =
      dossier?.name.split(" ").slice(0, 2).join(" ") ?? message.supplier_id;
    if (message.actor === "supplier") {
      events.push({
        ...base,
        kind: "supplier",
        message,
        title: `${name}: ${message.round === 0 ? "opening quote" : message.status.replaceAll("_", " ")}`,
        summary: message.checks.length
          ? `The supplier replies. The arena returns ${message.checks.length} checks on the previous buyer arguments.`
          : "The supplier's recorded email and structured offer enter the buyer's thread.",
      });
      continue;
    }
    const decision = message.decision;
    if (!decision) continue;
    if (!prepared.has(message.supplier_id) && dossier) {
      events.push({
        ...base,
        kind: "dossier",
        dossier,
        title: "Build the supplier dossier in Python",
        summary:
          "SQL reads the supplier's facts. Fixed text patterns identify cash, capacity and hedging signals. No research model is called.",
      });
      prepared.add(message.supplier_id);
    }
    if (decision.claims.length)
      events.push({
        ...base,
        kind: "claims",
        claims: decision.claims,
        refs: message.refs,
        title: "Choose arguments backed by source records",
        summary:
          "Code computes claim figures and attaches record IDs. These are the arguments selected for this recorded move.",
      });
    events.push({
      ...base,
      kind: "economics",
      decision,
      title: "Evaluate the cost of the whole package",
      summary:
        "Payment, delivery, quality and supplier health count alongside the unit price. The numbers shown come from the saved decision.",
    });
    events.push({
      ...base,
      kind: "policy",
      decision,
      title:
        decision.action === "accept"
          ? "The offer passes the acceptance check"
          : "Choose the next move within the price limits",
      summary:
        decision.why ||
        (decision.trade
          ? `The engine offers a term trade: ${decision.trade}.`
          : "The policy sets the price and terms using its anchor, concession rules and walk-away limit."),
    });
    if (message.status === "message")
      events.push({
        ...base,
        kind: "writer",
        message,
        title: "Send the offer in a fixed email template",
        summary:
          "The template inserts the selected arguments and term sheets. The buyer's email is copied from the saved arena trace.",
      });
  }
  events.push({
    kind: "outcome",
    title: "A valid deal, recorded by the arena",
    summary:
      "The buyer accepts the supplier's offer. All case must-haves pass; the arena records the final total cost and score.",
    round: session.result.rounds,
    supplierId: session.result.supplier_id,
  });
  return { session, events };
}
