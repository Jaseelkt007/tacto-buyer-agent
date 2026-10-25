import type { Stage } from "@/lib/v19";

export const REVIEWER_NODE = "reviewer";
export const INTERPRETER_NODE = "interpreter";
export type DealStage = Extract<Stage, "records" | "dossier" | "policy" | "writer" | "supplier">;
export type MapNode = DealStage | typeof REVIEWER_NODE | typeof INTERPRETER_NODE;

export const dealStage: Record<Stage, DealStage> = {
  records: "records",
  dossier: "dossier",
  claims: "dossier",
  economics: "policy",
  policy: "policy",
  writer: "writer",
  supplier: "supplier",
  outcome: "policy",
};

export const replyInterpreterNode = {
  id: INTERPRETER_NODE,
  title: "LLM reply interpreter",
  model: "gpt-6.1-sol",
  description: "Extract supplier conditions and preferences, backed by exact quotes.",
};

export const feedbackRoutes = [
  {
    title: "Reply interpreter",
    path: "Supplier reply → Reply interpreter → Decision policy",
    description: "Extracts supplier conditions and preferences, backed by exact quotes, to inform the decision policy.",
  },
  {
    title: "Decision reviewer",
    path: "Supplier conversation → Decision reviewer ← Prepared response",
    description: "Checks the prepared response for overlooked conditions or conflicts and flags supported concerns without changing the offer.",
  },
];
