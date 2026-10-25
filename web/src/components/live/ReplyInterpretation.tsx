import { BotIcon } from "@/components/icons";
import { replyInterpreterNode } from "@/lib/architecture";

export function ReplyInterpretationNode({
  inspected,
  onInspect,
}: {
  inspected: boolean;
  onInspect: () => void;
}) {
  return (
    <button
      type="button"
      data-stage={replyInterpreterNode.id}
      className={`monitor-node monitor-model-node ${inspected ? "is-inspected" : ""}`}
      aria-label={`Inspect ${replyInterpreterNode.title}`}
      aria-pressed={inspected}
      onClick={onInspect}
    >
      <span className="monitor-node-top">
        <span className="monitor-node-icon"><BotIcon /></span>
        <span className="monitor-node-tag">ADVISORY LLM</span>
        <span className="monitor-node-plus">+</span>
      </span>
      <strong>{replyInterpreterNode.title}</strong>
      <span className="monitor-node-description">{replyInterpreterNode.description}</span>
      <span className="monitor-model-name">{replyInterpreterNode.model}</span>
    </button>
  );
}

export function ReplyInterpretationInspector() {
  return (
    <div className="monitor-detail monitor-feedback-detail">
      <div className="monitor-eyebrow">SUPPLIER FEEDBACK · ADVISORY LLM</div>
      <h3>Reply interpretation</h3>
      <p>
        {replyInterpreterNode.model} reads the latest supplier reply and earlier
        public exchanges before the next policy decision.
      </p>
      <ol className="monitor-feedback-steps">
        <li><strong>Read the supplier thread</strong><p>Current offers, earlier buyer offers, supplier replies and claim feedback from the same thread.</p></li>
        <li><strong>Extract a structured reading</strong><p>Conditions, preferences, withdrawal statements, conflicts and unclear language, linked to a package and source quotation.</p></li>
        <li><strong>Validate the references</strong><p>Code checks the schema, package scope, exact quotation and annotated fields. Provenance does not prove an interpretation is correct.</p></li>
        <li><strong>Return context to the policy</strong><p>The decision engine receives advisory observations and records their relation to its proposed terms. Code still controls prices, offers, acceptance and walk-away.</p></li>
      </ol>
      <div className="monitor-callout">
        Both advisory models are enabled in the current agent. The original
        v1.9 replay shown here used neither model; its scores are unchanged.
      </div>
      <h4>Bounded on every round</h4>
      <p>
        Each supplier read has an eight-second deadline within the overall
        decision budget. Invalid, failed or late readings are unavailable; the
        policy continues. Final or agreed replies and arena feedback skip model
        interpretation.
      </p>
      <h4>History comes from the messages</h4>
      <p>
        The context is rebuilt from the public message prefix. It excludes
        future replies, scores, hidden supplier economics and prior model
        interpretations. The decision reviewer separately checks the prepared
        response against those earlier exchanges before dispatch.
      </p>
    </div>
  );
}
