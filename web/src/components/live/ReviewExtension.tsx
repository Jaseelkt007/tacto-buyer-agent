import { useState } from "react";
import { ScaleIcon } from "@/components/icons";
import {
  reviewer,
  reviewerNode,
  reviewExamples,
  reviewFinding,
  type ReviewExample,
  type ReviewExampleId,
} from "@/lib/reviewer";

export function ReviewNode({
  inspected,
  onInspect,
}: {
  inspected: boolean;
  onInspect: () => void;
}) {
  return (
      <button
        type="button"
        data-stage={reviewerNode.id}
        className={`monitor-node monitor-model-node ${inspected ? "is-inspected" : ""}`}
        onClick={onInspect}
        aria-label={`Inspect ${reviewerNode.title}`}
        aria-pressed={inspected}
      >
        <span className="monitor-node-top">
          <span className="monitor-node-icon">
            <ScaleIcon />
          </span>
          <span className="monitor-node-tag">{reviewer.model}</span>
          <span className="monitor-node-plus">+</span>
        </span>
        <strong>{reviewerNode.title}</strong>
        <span className="monitor-node-description">
          {reviewerNode.description}
        </span>
      </button>
  );
}

function Terms({ rows }: { rows: ReviewExample["latest_terms"][number] }) {
  return (
    <dl className="monitor-review-terms">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ReviewInspector() {
  const [selected, setSelected] = useState<ReviewExampleId>("counter");
  const example = reviewer.examples[selected];
  const finding = reviewFinding(example);
  return (
    <div className="monitor-detail monitor-review-detail">
      <div className="monitor-eyebrow">SAVED REVIEW EXAMPLE</div>
      <h3>Decision review model</h3>
      <p>
        Saved decisions, checked against earlier public exchanges. Buyer actions
        stay unchanged.
      </p>
      <div
        className="monitor-review-examples"
        aria-label="Saved reviewer examples"
      >
        {reviewExamples.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-pressed={selected === item.id}
            onClick={() => setSelected(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="monitor-review-example-origin">
        Separate synthetic study · {example.case_id} · decision{" "}
        {example.decision_index + 1}
      </div>
      <div
        className={`monitor-review-finding is-${finding.kind}`}
        role="status"
      >
        <strong>{finding.title}</strong>
        <p>{finding.detail}</p>
        <small>
          {example.result.seconds.toFixed(3)}s · {example.result.calls} model
          call{example.result.calls === 1 ? "" : "s"} · original action
          unchanged
        </small>
      </div>
      <details className="monitor-review-how">
        <summary>How the decision review works</summary>
        <div className="monitor-review-boundary">
          <strong>Reviewing, without taking control.</strong>
          <p>
            Proposed accept, continue and walk-away actions are captured before
            sending. The current agent reviews the prepared response before
            dispatch; these saved examples were reviewed offline. Earlier public
            exchanges feed the reviewer. Its verdict does not change the buyer
            action.
          </p>
        </div>
        <div
          className="monitor-review-verdicts"
          aria-label="Possible reviewer verdicts"
        >
          <span>NO_ISSUE</span>
          <span>RECONSIDER</span>
          <span>CONSTRAINT_CONFLICT</span>
        </div>
        <p>
          {reviewer.model} chooses a verdict and field. A flagged action needs a
          second evidence-selection call.
        </p>
      </details>
      <div className="monitor-review-package">
        <h4>Proposed buyer action</h4>
        <p>
          {example.action === "accept"
            ? "Accept the standing offer"
            : "Continue with a counteroffer"}
        </p>
        {example.action_target && <code>{example.action_target}</code>}
        {example.draft_terms.map((rows, index) => (
          <Terms key={index} rows={rows} />
        ))}
      </div>
      <div className="monitor-review-package">
        <h4>Latest supplier quotation</h4>
        <code>{example.latest_source}</code>
        {example.latest_terms.map((rows, index) => (
          <Terms key={index} rows={rows} />
        ))}
      </div>
      <details
        className="monitor-review-ledger"
        open={selected === "counter"}
        key={selected}
      >
        <summary>
          Exchange feedback · {example.exchanges.length} earlier exchanges
        </summary>
        <p>
          Rebuilt from the public history available at this decision. Prior
          model judgments are not fed back.
        </p>
        {example.repeated_terms.map((term) => (
          <div className="monitor-review-repeat" key={term.field}>
            <strong>
              {term.field} · quoted {term.count} times
            </strong>
            <p>{term.value}</p>
            {term.sources.map((source) => (
              <code key={source}>{source}</code>
            ))}
          </div>
        ))}
        {example.draft_differences.map((difference) => (
          <div className="monitor-review-difference" key={difference.field}>
            <strong>{difference.field}: draft differs from the quote</strong>
            <p>Supplier: {difference.supplier}</p>
            <p>Buyer: {difference.draft}</p>
            <span>Violation {difference.violation}</span>
          </div>
        ))}
        <details className="monitor-review-exchanges">
          <summary>Read the earlier offer / reply pairs</summary>
          {example.exchanges.map((exchange) => (
            <div
              className="monitor-review-exchange"
              key={exchange.reply_source}
            >
              <code>{exchange.buyer_source} · buyer offer</code>
              {exchange.buyer_terms.map((rows, index) => (
                <Terms key={index} rows={rows} />
              ))}
              <code>
                {exchange.reply_source} · supplier {exchange.status}
              </code>
              {exchange.supplier_terms.map((rows, index) => (
                <Terms key={index} rows={rows} />
              ))}
            </div>
          ))}
        </details>
      </details>
      {example.result.evidence && example.result.evidence !== "NONE" && (
        <details className="monitor-review-source">
          <summary>Inspect the selected original source</summary>
          <code>{example.result.evidence}</code>
          <blockquote>{example.result.source_excerpt}</blockquote>
        </details>
      )}
      <details className="monitor-review-provenance">
        <summary>Saved assessment and provenance</summary>
        <dl className="monitor-facts">
          <dt>Initial assessment</dt>
          <dd>{example.result.assessment}</dd>
          <dt>Evidence outcome</dt>
          <dd>{example.result.error ?? example.result.evidence}</dd>
          <dt>Decision index</dt>
          <dd>{example.decision_index}</dd>
          <dt>Model</dt>
          <dd>{example.model}</dd>
        </dl>
        <p>Input packet SHA-256</p>
        <code>{example.provenance.packet_sha256}</code>
        <p>Packet with exchange feedback SHA-256</p>
        <code>{example.provenance.reviewed_packet_sha256}</code>
        <p>Capture</p>
        <code>{example.provenance.capture.path}</code>
        <p>Saved review</p>
        <code>{example.provenance.review.path}</code>
      </details>
      <details className="monitor-review-study">
        <summary>
          Latest hosted review check · {reviewer.summary.decisions} decisions
        </summary>
        <p>
          {reviewer.summary.no_issue} NO_ISSUE · {reviewer.summary.unsupported}{" "}
          unsupported observations · {reviewer.summary.retained_flags} retained
          findings · {reviewer.summary.changed_actions} changed buyer actions.
        </p>
        <p>
          The study reproduced the earlier v1.9 actions and scores. These counts
          measure reviewer observations, not a score improvement.
        </p>
      </details>
      <details className="monitor-review-study">
        <summary>Separate experiment: optional live package gate</summary>
        <p>
          The opt-in reconsideration adapter can append one code-priced supplier
          package to an eligible counteroffer. Its model chooses PROCEED or
          RECONSIDER; code validates the terms and cost.
        </p>
        <p>
          It is off by default and does not change accept, walk-away,
          first-proposal or final/agreed decisions. This adapter is separate
          from the offline reviewer shown here.
        </p>
      </details>
    </div>
  );
}
