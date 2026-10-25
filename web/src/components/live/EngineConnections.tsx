import { useEffect, useId, useState, type RefObject } from "react";
import type { Stage } from "@/lib/v19";
import {
  INTERPRETER_NODE,
  REVIEWER_NODE,
  type MapNode,
} from "@/lib/architecture";

type Box = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  x: number;
  y: number;
};
type Layout = { width: number; height: number; nodes: Map<MapNode, Box> };
type Connection = {
  from: MapNode;
  to: MapNode;
  direction: "down" | "across" | "context" | "history" | "reply" | "up";
  kind: "policy" | "advisory" | "feedback";
};

const STAGES: MapNode[] = [
  "records",
  "dossier",
  "policy",
  "writer",
  "supplier",
  REVIEWER_NODE,
  INTERPRETER_NODE,
];
const CONNECTIONS: Connection[] = [
  { from: "dossier", to: "policy", direction: "down", kind: "policy" },
  { from: "records", to: "policy", direction: "context", kind: "policy" },
  { from: "policy", to: "writer", direction: "across", kind: "policy" },
  { from: "writer", to: REVIEWER_NODE, direction: "across", kind: "advisory" },
  { from: REVIEWER_NODE, to: "supplier", direction: "down", kind: "advisory" },
  { from: "supplier", to: REVIEWER_NODE, direction: "history", kind: "feedback" },
  { from: "supplier", to: INTERPRETER_NODE, direction: "reply", kind: "feedback" },
  { from: INTERPRETER_NODE, to: "policy", direction: "up", kind: "feedback" },
];

function pathFor(from: Box, to: Box, connection: Connection) {
  if (connection.direction === "history") {
    const outside = Math.max(from.right, to.right) + 12;
    return `M ${from.right + 2} ${from.y} H ${outside} V ${to.y} H ${to.right + 4}`;
  }
  if (connection.direction === "reply") {
    return `M ${from.left - 2} ${from.y} H ${to.right + 5}`;
  }
  if (connection.direction === "up") {
    return `M ${from.x} ${from.top - 2} V ${to.bottom + 5}`;
  }
  if (connection.direction === "context") {
    const middle = (from.bottom + to.top) / 2;
    return `M ${from.x} ${from.bottom + 2} V ${middle} H ${to.x} V ${to.top - 5}`;
  }
  if (connection.direction === "down") {
    const middle = (from.bottom + to.top) / 2;
    return `M ${from.x} ${from.bottom + 2} V ${middle} H ${to.x} V ${to.top - 5}`;
  }
  const middle = (from.right + to.left) / 2 - 4;
  return `M ${from.right + 2} ${from.y} H ${middle} V ${to.y} H ${to.left - 5}`;
}

/** Connections follow rendered cards, including when their text or the viewport changes size. */
export function EngineConnections({
  containerRef,
  active,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  active: Stage | undefined;
}) {
  const [layout, setLayout] = useState<Layout | null>(null);
  const markerId = useId();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const wide = window.matchMedia("(min-width: 641px)");
    let frame = 0;
    const measure = () => {
      if (!wide.matches) {
        setLayout(null);
        return;
      }
      const bounds = container.getBoundingClientRect();
      const nodes = new Map<MapNode, Box>();
      for (const stage of STAGES) {
        const node = container.querySelector<HTMLElement>(
          `[data-stage="${stage}"]`,
        );
        if (!node) continue;
        const rect = node.getBoundingClientRect();
        const left = rect.left - bounds.left;
        const top = rect.top - bounds.top;
        nodes.set(stage, {
          left,
          top,
          right: left + rect.width,
          bottom: top + rect.height,
          x: left + rect.width / 2,
          y: top + rect.height / 2,
        });
      }
      setLayout(
        bounds.width > 0 && bounds.height > 0
          ? { width: bounds.width, height: bounds.height, nodes }
          : null,
      );
    };
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    container
      .querySelectorAll("[data-stage]")
      .forEach((node) => observer.observe(node));
    wide.addEventListener("change", schedule);
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      wide.removeEventListener("change", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [containerRef]);

  if (!layout) return null;
  return (
    <svg
      className="monitor-connections"
      aria-hidden="true"
      focusable="false"
      width={layout.width}
      height={layout.height}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "visible",
        zIndex: 0,
      }}
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 6 6"
          refX="5"
          refY="3"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path
            d="M0 0 6 3 0 6"
            fill="none"
            stroke="context-stroke"
            strokeWidth="1.2"
          />
        </marker>
      </defs>
      {CONNECTIONS.map((connection) => {
        const from = layout.nodes.get(connection.from);
        const to = layout.nodes.get(connection.to);
        if (!from || !to) return null;
        return (
          <path
            key={`${connection.from}-${connection.to}`}
            data-connection={`${connection.from}-${connection.to}`}
            data-kind={connection.kind}
            d={pathFor(from, to, connection)}
            fill="none"
            stroke={
              connection.kind !== "policy"
                ? "var(--accent-ink)"
                : active === connection.to
                  ? "var(--accent)"
                  : "#b5bdc5"
            }
            strokeDasharray={connection.kind !== "policy" ? "4 4" : undefined}
            strokeWidth={connection.kind === "feedback" || active === connection.to ? 1.5 : 1.15}
            strokeLinejoin="round"
            strokeLinecap="round"
            markerEnd={`url(#${markerId})`}
          />
        );
      })}
    </svg>
  );
}
