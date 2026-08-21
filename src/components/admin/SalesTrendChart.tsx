import type { SalesTrendPoint } from "@/server/services/analytics";

export function SalesTrendChart({
  points,
  currencyCode,
}: {
  points: SalesTrendPoint[];
  currencyCode: string;
}) {
  const width = 640;
  const height = 200;
  const padding = 32;

  const max = Math.max(1, ...points.map((p) => p.grossSales));
  const stepX = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = padding + i * stepX;
    const y = height - padding - (p.grossSales / max) * (height - padding * 2);
    return { x, y, point: p };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1]?.x ?? padding},${height - padding} L${padding},${height - padding} Z`;

  const total = points.reduce((sum, p) => sum + p.grossSales, 0);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-text-muted">
        Total: {currencyCode} {total.toFixed(2)} over {points.length} days
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Sales trend chart">
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="var(--color-border-default, #e2e2e2)"
          strokeWidth={1}
        />
        {coords.length > 0 ? (
          <>
            <path d={areaPath} fill="rgb(250 204 21 / 0.15)" stroke="none" />
            <path d={linePath} fill="none" stroke="#eab308" strokeWidth={2} />
          </>
        ) : null}
        {coords.length > 0 ? (
          <>
            <text x={padding} y={height - 8} fontSize={10} fill="currentColor" opacity={0.6}>
              {coords[0].point.date}
            </text>
            <text
              x={width - padding}
              y={height - 8}
              fontSize={10}
              fill="currentColor"
              opacity={0.6}
              textAnchor="end"
            >
              {coords[coords.length - 1].point.date}
            </text>
          </>
        ) : null}
      </svg>
    </div>
  );
}
