import snapshot from "@/data/reviewer.json";
import { REVIEWER_NODE } from "@/lib/architecture";

export const reviewer = snapshot;
export type ReviewExampleId = keyof typeof snapshot.examples;
export type ReviewExample = (typeof snapshot.examples)[ReviewExampleId];

export const reviewerNode = {
  id: REVIEWER_NODE,
  title: "LLM Decision model",
  description:
    "Check the prepared response for overlooked conditions or conflicts.",
};

export const reviewExamples: { id: ReviewExampleId; label: string }[] = [
  { id: "counter", label: "Counteroffer" },
  { id: "accept", label: "Acceptance" },
  { id: "unsupported", label: "Unsupported" },
];

export const reviewOutcomes = [
  { label: "NO ISSUE", description: "No supported issue found in the proposed action." },
  { label: "RECONSIDER", description: "A supported finding deserves another policy check." },
  { label: "UNAVAILABLE", description: "No usable review result; the policy action remains in place." },
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
