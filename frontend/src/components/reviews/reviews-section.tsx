"use client";

import { BadgeCheck, Star } from "lucide-react";
import { useState } from "react";
import { ReportButton } from "@/components/community/report-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Rating } from "@/components/ui/rating";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReviewList } from "@/lib/community";
import { formatDate } from "@/lib/format";
import { useApi } from "@/lib/use-api";

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className={n <= value ? "size-4 fill-amber-400 text-amber-400" : "size-4 text-line-strong"} />
      ))}
    </span>
  );
}

/**
 * Public reviews of a professional. Everything shown comes from the server:
 * the average and count are computed from counted reviews, and the "Verified
 * booking" label is derived server-side from a completed booking.
 */
export function ReviewsSection({ slug, rating, reviewCount }: { slug: string; rating: number | null; reviewCount: number }) {
  const [page, setPage] = useState(1);
  const { state, reload } = useApi<ReviewList>(`/workers/${slug}/reviews?page=${page}&pageSize=5`);
  return (
    <section aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="text-h2 font-extrabold">Reviews</h2>
      <div className="mt-3">
        <Rating value={rating} reviewCount={reviewCount} />
      </div>
      {state.status === "loading" || state.status === "unauthenticated" ? (
        <div aria-busy="true" aria-label="Loading reviews" className="mt-4 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : state.status === "error" ? (
        <div className="mt-4"><ErrorState title="Reviews could not be loaded" action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState></div>
      ) : state.data.reviews.length === 0 ? (
        <p className="mt-3 rounded-card border border-dashed border-line-strong bg-surface p-4 text-sm text-ink-muted">
          No reviews yet. Customers can review a job once it is completed.
        </p>
      ) : (
        <>
          <Breakdown list={state.data} />
          <ul className="mt-5 divide-y divide-line rounded-card border border-line">
            {state.data.reviews.map((r) => (
              <li key={r.id} className="p-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <Stars value={r.rating} />
                  <span className="text-sm font-semibold">{r.author.displayName}</span>
                  {r.verifiedBooking && (
                    <Badge tone="success"><BadgeCheck className="size-3.5" aria-hidden /> Verified booking</Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-ink-subtle">
                  {r.service} · {formatDate(r.createdAt)}{r.edited ? " · edited" : ""}
                </p>
                {r.comment && <p className="mt-2 max-w-prose whitespace-pre-line break-words text-ink-muted">{r.comment}</p>}
                <div className="mt-2 flex justify-end"><ReportButton type="REVIEW" id={r.id} label="Report review" /></div>
              </li>
            ))}
          </ul>
          {state.data.totalPages > 1 && (
            <nav aria-label="Review pages" className="mt-4 flex items-center justify-center gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-sm text-ink-muted">Page {state.data.page} of {state.data.totalPages}</span>
              <Button variant="secondary" size="sm" disabled={page >= state.data.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

function Breakdown({ list }: { list: ReviewList }) {
  const { distribution, reviewCount } = list.summary;
  if (reviewCount === 0) return null;
  return (
    <dl className="mt-4 max-w-sm space-y-1.5 text-sm" aria-label="Rating breakdown">
      {([5, 4, 3, 2, 1] as const).map((n) => {
        const count = distribution[String(n) as keyof typeof distribution];
        return (
          <div key={n} className="flex items-center gap-2">
            <dt className="w-14 text-ink-muted">{n} {n === 1 ? "star" : "stars"}</dt>
            <dd className="flex flex-1 items-center gap-2">
              <span aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-surface-strong">
                <span className="block h-full bg-amber-400" style={{ width: `${(count / reviewCount) * 100}%` }} />
              </span>
              <span className="w-6 text-right tabular-nums text-ink-subtle">{count}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
