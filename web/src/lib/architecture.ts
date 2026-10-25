import type { Stage } from "@/lib/v19";

export const REVIEWER_NODE = "reviewer";
export const INTERPRETER_NODE = "interpreter";
export type MapNode = Stage | typeof REVIEWER_NODE | typeof INTERPRETER_NODE;

export const replyInterpreterNode = {
  id: INTERPRETER_NODE,
  title: "Reply interpretation",
  model: "gpt-6.1-sol",
  description: "Read conditions, preferences and source quotations.",
};
