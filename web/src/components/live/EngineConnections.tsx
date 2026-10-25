import { useEffect, useId, useState, type RefObject } from "react";
import type { Stage } from "@/lib/v19";

type Box = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  x: number;
  y: number;
};
type Layout = { width: number; height: number; nodes: Map<Stage, Box> };
type Connection = {
  from: Stage;
  to: Stage;
  direction: "down" | "across";
  offset?: number;
};

const STAGES: Stage[] = [
  "records",
  "dossier",
  "claims",
  "economics",
  "policy",
  "writer",
  "supplier",
  "outcome",
];
const CONNECTIONS: Connection[] = [
  { from: "records", to: "dossier", direction: "down" },
  { from: "dossier", to: "claims", direction: "down" },
  { from: "claims", to: "economics", direction: "across" },
  { from: "economics", to: "policy", direction: "down" },
  { from: "policy", to: "writer", direction: "down" },
  { from: "writer", to: "supplier", direction: "across", offset: -3 },
  { from: "policy", to: "outcome", direction: "across", offset: 3 },
];

function pathFor(from: Box, to: Box, connection: Connection) {
  if (connection.direction === "down") {
    const middle = (from.bottom + to.top) / 2;
    return `M ${from.x} ${from.bottom + 2} V ${middle} H ${to.x} V ${to.top - 5}`;
  }
  const middle = (from.right + to.left) / 2 + (connection.offset ?? 0);
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
      const nodes = new Map<Stage, Box>();
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
            d={pathFor(from, to, connection)}
            fill="none"
            stroke={active === connection.to ? "var(--accent)" : "var(--line)"}
            strokeWidth={active === connection.to ? 1.5 : 1.15}
            strokeLinejoin="round"
            strokeLinecap="round"
            markerEnd={`url(#${markerId})`}
          />
        );
      })}
    </svg>
  );
}
