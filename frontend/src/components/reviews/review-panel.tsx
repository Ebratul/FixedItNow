"use client";

import { Star } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TextArea } from "@/components/ui/text-area";
import { api, ApiError } from "@/lib/api";
import type { BookingReview, OwnReview } from "@/lib/community";
import { formatDate } from "@/lib/format";
import { StarInput } from "./star-input";

type Own = Extract<BookingReview, { canReview: boolean }>;
const isOwn = (data: BookingReview): data is Own => "canReview" in data;

/**
 * Review section of a booking. What is offered comes from the server's
 * `canReview` / `canEdit` / `canWithdraw` flags; the server re-checks everything
 * when the form is submitted (eligibility is never decided here).
 */
export function ReviewPanel({
  bookingId,
  workerName,
  data,
  onChanged,
}: {
  bookingId: string;
  workerName: string;
  data: BookingReview;
  onChanged: (next: BookingReview) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [withdraw, setWithdraw] = useState(false);
  const [notice, setNotice] = useState<string>();

  if (!isOwn(data)) {
    // The professional: sees a review only while it is public.
    if (!data.review) return null;
    return (
      <section aria-labelledby="review-heading">
        <h2 id="review-heading" className="text-h2 font-extrabold">Customer review</h2>
        <Card className="mt-4 p-5">
          <StarsLine value={data.review.rating} />
          {data.review.comment && <p className="mt-2 whitespace-pre-line break-words text-ink-muted">{data.review.comment}</p>}
          <p className="mt-2 text-xs text-ink-subtle">{formatDate(data.review.createdAt)}</p>
        </Card>
      </section>
    );
  }

  const { review, canReview } = data;
  if (!review && !canReview) return null;

  const set = (next: OwnReview | null, message?: string) => {
    onChanged({ ...data, canReview: next === null, review: next });
    setNotice(message);
    setEditing(false);
  };

  return (
    <section aria-labelledby="review-heading">
      <h2 id="review-heading" className="text-h2 font-extrabold">Your review</h2>
      <div className="mt-4 space-y-3">
        {notice && <Alert tone="success">{notice}</Alert>}
        {!review ? (
          <ReviewForm
            bookingId={bookingId}
            intro={`How was the job with ${workerName}? You can review because your payment was verified. Your review is public and shows a “Verified booking” label.`}
            onSaved={(r) => set(r, "Thank you. Your review is now public on their profile.")}
          />
        ) : editing ? (
          <ReviewForm bookingId={bookingId} existing={review} onCancel={() => setEditing(false)} onSaved={(r) => set(r, "Review updated.")} />
        ) : (
          <Card className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <StarsLine value={review.rating} />
              {review.status === "HIDDEN" && <Badge tone="warning">Removed by moderators</Badge>}
              {review.status === "DELETED" && <Badge>Withdrawn</Badge>}
            </div>
            {review.comment && <p className="mt-2 whitespace-pre-line break-words text-ink-muted">{review.comment}</p>}
            <p className="mt-2 text-xs text-ink-subtle">
              {formatDate(review.createdAt)}{review.editedAt ? " · edited" : ""}
              {review.canEdit && ` · you can edit until ${formatDate(review.editableUntil)}`}
            </p>
            {review.status === "HIDDEN" && (
              <p className="mt-2 text-sm text-ink-muted">A moderator removed this review from public view. It no longer counts toward the rating and cannot be edited.</p>
            )}
            {review.status === "DELETED" && <p className="mt-2 text-sm text-ink-muted">You withdrew this review. It is no longer public.</p>}
            {(review.canEdit || review.canWithdraw) && (
              <div className="mt-4 flex flex-wrap gap-3">
                {review.canEdit && <Button variant="secondary" size="sm" onClick={() => { setNotice(undefined); setEditing(true); }}>Edit review</Button>}
                {review.canWithdraw && <Button variant="ghost" size="sm" onClick={() => setWithdraw(true)}>Withdraw review</Button>}
              </div>
            )}
          </Card>
        )}
      </div>
      <ConfirmDialog
        open={withdraw}
        title="Withdraw your review?"
        confirmLabel="Withdraw review"
        tone="danger"
        onClose={() => setWithdraw(false)}
        onConfirm={async () => {
          const res = await api<{ review: OwnReview }>(`/bookings/${bookingId}/review`, { method: "DELETE" });
          onChanged({ ...data, canReview: false, review: res.review });
          setNotice("Your review was withdrawn.");
        }}
      >
        It will disappear from the professional&apos;s profile and no longer count toward their rating. You cannot post another review for this booking.
      </ConfirmDialog>
    </section>
  );
}

function StarsLine({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className={n <= value ? "size-5 fill-amber-400 text-amber-400" : "size-5 text-line-strong"} />
      ))}
    </span>
  );
}

function ReviewForm({
  bookingId,
  existing,
  intro,
  onSaved,
  onCancel,
}: {
  bookingId: string;
  existing?: OwnReview;
  intro?: string;
  onSaved: (review: OwnReview) => void;
  onCancel?: () => void;
}) {
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (rating < 1) {
      setErrors({ rating: "Choose a rating from 1 to 5." });
      return;
    }
    setPending(true);
    setErrors({});
    setFormError(undefined);
    try {
      const res = await api<{ review: OwnReview }>(`/bookings/${bookingId}/review`, {
        method: existing ? "PUT" : "POST",
        body: { rating, comment },
      });
      onSaved(res.review);
    } catch (e) {
      if (e instanceof ApiError) {
        setErrors(e.fieldErrors);
        setFormError(Object.keys(e.fieldErrors).length ? undefined : e.message);
      } else setFormError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="space-y-4" noValidate>
        {intro && <p className="text-sm text-ink-muted">{intro}</p>}
        <StarInput value={rating} onChange={setRating} disabled={pending} error={errors.rating} />
        <TextArea
          id="review-comment"
          label="Your review (optional)"
          hint="Plain text, up to 1000 characters. Please keep it about the job."
          value={comment}
          maxLength={1000}
          onChange={(e) => setComment(e.target.value)}
          error={errors.comment}
          disabled={pending}
          className="min-h-28"
        />
        {formError && <Alert tone="error">{formError}</Alert>}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={pending}>{existing ? "Save changes" : "Post review"}</Button>
          {onCancel && <Button variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>}
        </div>
      </form>
    </Card>
  );
}
