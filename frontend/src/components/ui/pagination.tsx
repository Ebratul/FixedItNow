import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

/** Window of page numbers around the current page, with ellipses. */
export function pageWindow(page: number, totalPages: number): (number | "…")[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

const item =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-control px-3 text-sm font-semibold transition-colors";

/** Link-based pagination (works without JavaScript and is shareable). */
export function Pagination({
  page,
  totalPages,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  hrefFor: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={cn(item, "text-ink-muted hover:bg-surface-strong")}>
          <ChevronLeft className="size-4" aria-hidden /> Previous
        </Link>
      ) : null}
      <ul className="flex items-center gap-1">
        {pageWindow(page, totalPages).map((p, i) =>
          p === "…" ? (
            <li key={`gap-${i}`} aria-hidden className="px-1 text-ink-subtle">…</li>
          ) : (
            <li key={p}>
              <Link
                href={hrefFor(p)}
                aria-label={`Page ${p}`}
                aria-current={p === page ? "page" : undefined}
                className={cn(item, p === page ? "bg-brand-700 text-white" : "text-ink-muted hover:bg-surface-strong")}
              >
                {p}
              </Link>
            </li>
          ),
        )}
      </ul>
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} rel="next" className={cn(item, "text-ink-muted hover:bg-surface-strong")}>
          Next <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : null}
    </nav>
  );
}
