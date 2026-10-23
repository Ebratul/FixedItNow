import { Star } from "lucide-react";

/**
 * Rating display. Renders nothing misleading when there are no reviews: callers
 * must pass real aggregates (FR-SVC-07); with zero reviews it shows "No reviews yet".
 */
export function Rating({
  value,
  reviewCount,
}: {
  value: number | null;
  reviewCount: number;
}) {
  if (value === null || reviewCount === 0) {
    return <span className="text-sm text-ink-subtle">No reviews yet</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
      <span className="font-semibold text-ink">{value.toFixed(1)}</span>
      <span className="text-ink-subtle">({reviewCount})</span>
      <span className="sr-only">
        {value.toFixed(1)} out of 5 from {reviewCount} reviews
      </span>
    </span>
  );
}
