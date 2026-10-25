import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Column<T> = {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Right-align numbers and money. */
  align?: "right";
  /** Hide on narrow screens (the information should also be reachable in the row's detail page). */
  hideBelow?: "md" | "lg";
  className?: string;
};

/**
 * Accessible data table: a real <table> with a caption, column headers with scope, and horizontal
 * scrolling on narrow screens. `rowLabel` names each row's first cell for assistive technology.
 */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  busy,
}: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** True while a new page or filter result is loading: dims the rows and announces busy. */
  busy?: boolean;
}) {
  const hide = (h?: "md" | "lg") => (h === "md" ? "hidden md:table-cell" : h === "lg" ? "hidden lg:table-cell" : "");
  return (
    <div className={cn("overflow-x-auto rounded-card border border-line bg-canvas shadow-card", busy && "opacity-60 transition-opacity")} aria-busy={busy || undefined}>
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-surface text-xs tracking-wide text-ink-subtle uppercase">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("px-4 py-3 font-bold", c.align === "right" && "text-right", hide(c.hideBelow), c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="align-top hover:bg-brand-50/40">
              {columns.map((c, i) =>
                i === 0 ? (
                  <th key={c.key} scope="row" className={cn("px-4 py-3 font-semibold", hide(c.hideBelow), c.className)}>
                    {c.cell(row)}
                  </th>
                ) : (
                  <td key={c.key} className={cn("px-4 py-3", c.align === "right" && "text-right tabular-nums", hide(c.hideBelow), c.className)}>
                    {c.cell(row)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
