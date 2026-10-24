const eur = (v: number) => v.toLocaleString("en-GB", { style: "currency", currency: "EUR" });

const PARTS = [
  { key: "material", label: "Material", color: "var(--cost-1)" },
  { key: "conversion", label: "Conversion", color: "var(--cost-2)" },
  { key: "overhead", label: "Overhead", color: "var(--cost-3)" },
] as const;

export function CostLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--ink-2)]">
      {PARTS.map((p) => (
        <span key={p.key} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />
          {p.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-[var(--ink-2)]" />
        Margin (price above full cost)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-0.5 bg-[var(--ink)]" />
        Current price
      </span>
    </div>
  );
}

/** Full cost split into material / conversion / overhead, and where today's price sits against it.
 * Shared scale (`max`) so bars of one part compare. */
export function CostStack({
  material,
  conversion,
  overhead,
  price,
  max,
}: {
  material: number;
  conversion: number;
  overhead: number;
  price: number | null;
  max: number;
}) {
  const vals = { material, conversion, overhead };
  const full = material + conversion + overhead;
  const pct = (v: number) => `${(v / max) * 100}%`;
  const below = price !== null && price < full;
  return (
    <div className="space-y-1">
      <div className="relative h-6">
        <div className="absolute inset-y-0 left-0 flex gap-[2px]" style={{ width: pct(full) }}>
          {PARTS.map((p) => (
            <div
              key={p.key}
              className="h-full first:rounded-l last:rounded-r"
              style={{ width: `${(vals[p.key] / full) * 100}%`, background: p.color }}
              title={`${p.label} ${eur(vals[p.key])}`}
            />
          ))}
        </div>
        {price !== null && price > full && (
          <div
            className="absolute inset-y-0 rounded-r border border-l-0 border-dashed border-[var(--ink-2)]"
            style={{ left: `calc(${pct(full)} + 2px)`, width: `calc(${pct(price - full)} - 2px)` }}
            title={`Margin ${eur(price - full)}`}
          />
        )}
        {price !== null && (
          <div className="absolute -top-1 -bottom-1 w-0.5 bg-[var(--ink)]" style={{ left: pct(price) }} title={`Price ${eur(price)}`} />
        )}
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 text-[11.5px] tabular-nums text-[var(--ink-2)]">
        <span>
          {PARTS.map((p, i) => (
            <span key={p.key}>
              {i > 0 && " + "}
              {eur(vals[p.key])}
            </span>
          ))}{" "}
          = <span className="font-semibold text-[var(--ink)]">{eur(full)}</span>
        </span>
        {price !== null && (
          <span className={below ? "font-semibold text-[var(--bad)]" : ""}>
            price {eur(price)} · {below ? `${eur(full - price)} below full cost` : `margin ${eur(price - full)}`}
          </span>
        )}
      </div>
    </div>
  );
}

/** Tiny line of an index's recent months; the shaded points mark a claim window. */
export function Sparkline({
  values,
  mark,
  width = 120,
  height = 28,
}: {
  values: [string, number][];
  mark?: { from: string; to: string } | null;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const vs = values.map((v) => v[1]);
  const lo = Math.min(...vs);
  const hi = Math.max(...vs);
  const x = (i: number) => 2 + (i / (values.length - 1)) * (width - 4);
  const y = (v: number) => 3 + (1 - (v - lo) / (hi - lo || 1)) * (height - 6);
  const iFrom = mark ? values.findIndex((v) => v[0] === mark.from) : -1;
  const iTo = mark ? values.findIndex((v) => v[0] === mark.to) : -1;
  return (
    <svg width={width} height={height} className="block" aria-hidden>
      {iFrom >= 0 && iTo >= 0 && (
        <rect x={x(iFrom)} y={0} width={x(iTo) - x(iFrom)} height={height} fill="var(--accent-wash)" />
      )}
      <path d={values.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v[1])}`).join("")} fill="none" stroke="var(--s-ours)" strokeWidth={1.5} />
      <circle cx={x(values.length - 1)} cy={y(vs.at(-1)!)} r={2.5} fill="var(--s-ours)" />
    </svg>
  );
}
