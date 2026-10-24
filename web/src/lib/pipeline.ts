/** One step of a pipeline replay: which part works, which part handed it data, and what it found. */
export type PipeFrame = {
  /** Seconds since the replay's start. */
  t: number;
  dur: number;
  node: string;
  from?: string;
  round: number;
  stage: string;
  /** Status line text; the player derives one from `stage` and `round` when absent. */
  label?: string;
  log: string;
  state?: string[];
  tone?: "good" | "bad" | "warn";
};
