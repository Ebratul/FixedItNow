import { formatBdt } from "@/lib/format";

export type DailyPoint = { day: string; collected: number; refunded: number };

/**
 * Daily collected payments as a plain SVG bar chart (one series, brand colour). Each bar has a <title>
 * tooltip; the same numbers are available as a table under the chart for screen readers and exact values.
 */
export function DailyChart({ daily }: { daily: DailyPoint[] }) {
  const max = Math.max(0, ...daily.map((d) => d.collected));
  const total = daily.reduce((n, d) => n + d.collected, 0);
  const W = 1000;
  const H = 200;
  const step = daily.length > 0 ? W / daily.length : W;
  const barWidth = Math.max(1, step * 0.7);
  const summary = `Bar chart of daily collected payments from ${daily[0]?.day ?? "-"} to ${daily[daily.length - 1]?.day ?? "-"}. Total ${formatBdt(total)}; highest day ${formatBdt(max)}.`;

  return (
    <div className="space-y-3">
      {max === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-surface p-6 text-center text-ink-muted">No payments were collected on any day in this range.</p>
      ) : (
        <figure>
          <div className="flex gap-2">
            <div className="flex w-16 shrink-0 flex-col justify-between text-right text-xs text-ink-subtle tabular-nums" aria-hidden>
              <span>{formatBdt(max)}</span>
              <span>{formatBdt(Math.round(max / 2))}</span>
              <span>৳0</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={summary} className="h-52 min-w-0 flex-1 rounded-control bg-surface">
              <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="stroke-line" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="stroke-line-strong" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              {daily.map((d, i) => {
                const h = (d.collected / max) * (H - 4);
                return (
                  <rect key={d.day} x={i * step + (step - barWidth) / 2} y={H - h} width={barWidth} height={h} className="fill-brand-600">
                    <title>{`${d.day}: ${formatBdt(d.collected)} collected${d.refunded ? `, ${formatBdt(d.refunded)} refunded` : ""}`}</title>
                  </rect>
                );
              })}
            </svg>
          </div>
          <figcaption className="mt-1 flex justify-between pl-[4.5rem] text-xs text-ink-subtle" aria-hidden>
            <span>{daily[0]?.day}</span>
            <span>{daily[daily.length - 1]?.day}</span>
          </figcaption>
        </figure>
      )}
      <details className="rounded-card border border-line bg-canvas">
        <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-semibold text-brand-700">Show the daily figures as a table</summary>
        <div className="max-h-96 overflow-auto">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Daily collected and refunded amounts (Bangladesh time)</caption>
            <thead className="sticky top-0 bg-surface text-xs tracking-wide text-ink-subtle uppercase">
              <tr>
                <th scope="col" className="px-4 py-2">Day</th>
                <th scope="col" className="px-4 py-2 text-right">Collected</th>
                <th scope="col" className="px-4 py-2 text-right">Refunded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {daily.map((d) => (
                <tr key={d.day}>
                  <th scope="row" className="px-4 py-2 font-medium">{d.day}</th>
                  <td className="px-4 py-2 text-right tabular-nums">{formatBdt(d.collected)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatBdt(d.refunded)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
