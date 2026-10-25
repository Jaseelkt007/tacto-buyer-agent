import snapshot from "@/data/reviewer.json";
import type { Stage } from "@/lib/v19";

export const reviewer = snapshot;
export const REVIEWER_NODE = "reviewer";
export type MapNode = Stage | typeof REVIEWER_NODE;
export type ReviewExampleId = keyof typeof snapshot.examples;
export type ReviewExample = (typeof snapshot.examples)[ReviewExampleId];

export const reviewerNode = {
  id: REVIEWER_NODE,
  title: "Decision review model",
  tag: "OFFLINE REVIEW",
  description:
    "Review a proposed action against the evidence and earlier exchanges.",
};

export const reviewerConnections: {
  from: Stage;
  to: typeof REVIEWER_NODE;
  direction: "feedback" | "across";
}[] = [
  { from: "policy", to: REVIEWER_NODE, direction: "across" },
  { from: "supplier", to: REVIEWER_NODE, direction: "feedback" },
];

export const reviewExamples: { id: ReviewExampleId; label: string }[] = [
  { id: "counter", label: "Counteroffer" },
  { id: "accept", label: "Acceptance" },
  { id: "unsupported", label: "Unsupported" },
];

type ReviewFinding =
  | { kind: "finding"; title: string; detail: string }
  | { kind: "no-issue"; title: string; detail: string }
  | { kind: "unavailable"; title: string; detail: string };

export function reviewFinding(example: ReviewExample): ReviewFinding {
  const result = example.result;
  if (!result.available)
    return {
      kind: "unavailable",
      title: "Unavailable observation",
      detail:
        "The evidence check did not support the initial flag. This is not an approval or a retained finding.",
    };
  if (result.verdict === "NO_ISSUE")
    return {
      kind: "no-issue",
      title: "No supported issue found",
      detail:
        "The saved review returned NO_ISSUE. This is an observation, not a guarantee that the action is optimal.",
    };
  return {
    kind: "finding",
    title: `${result.verdict === "CONSTRAINT_CONFLICT" ? "Constraint conflict" : "Reconsider"}: ${result.field?.replaceAll("_", " ")}`,
    detail:
      "The reviewer selected a source for this finding. A quoted preference or package difference does not establish a mandatory violation or a better deal.",
  };
}
