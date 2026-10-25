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
  description: "Read the reply. Return validated context to the policy.",
};
