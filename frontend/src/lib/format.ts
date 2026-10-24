import type { BookingStatus } from "./booking-types";

/** All appointment times are shown in Bangladesh time, never the browser's zone. */
export const TZ = "Asia/Dhaka";

const date = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric" });
const time = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });
const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
});
const keyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const formatDate = (iso: string | Date) => date.format(new Date(iso));
export const formatTime = (iso: string | Date) => time.format(new Date(iso));
export const formatDateTime = (iso: string | Date) => dateTime.format(new Date(iso));

/** "Tue, 3 Nov 2026 · 10:00 AM – 11:00 AM" */
export function formatRange(startIso: string, endIso: string) {
  return `${formatDate(startIso)} · ${formatTime(startIso)} – ${formatTime(endIso)}`;
}

/** YYYY-MM-DD of an instant in Dhaka. */
export const dhakaDateKey = (d: Date = new Date()) => keyFormat.format(d);

/** "2026-11-05T10:00" typed in a datetime-local box, read as Dhaka time. */
export const dhakaLocalToIso = (local: string) => new Date(`${local}:00+06:00`).toISOString();

export const formatBdt = (amount: number) => `৳${amount.toLocaleString("en-BD")}`;

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h ? `${h} hr` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

export const STATUS_LABELS: Record<BookingStatus, { label: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" }> = {
  REQUESTED: { label: "Awaiting response", tone: "warning" },
  QUOTED: { label: "Quote sent", tone: "brand" },
  CONFIRMED: { label: "Confirmed", tone: "success" },
  IN_PROGRESS: { label: "In progress", tone: "brand" },
  COMPLETION_PENDING: { label: "Awaiting confirmation", tone: "warning" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  DECLINED: { label: "Declined", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  DISPUTED: { label: "In dispute", tone: "danger" },
};

export const EVENT_LABELS: Record<string, string> = {
  "booking.requested": "Request sent",
  "booking.accepted": "Accepted and confirmed",
  "booking.declined": "Declined",
  "booking.cancelled": "Cancelled",
  "booking.started": "Job started",
  "booking.completion_requested": "Marked finished by the professional",
  "booking.completed": "Completion confirmed",
  "booking.expired": "Request expired",
  "quote.sent": "Quote sent",
  "quote.revised": "Quote revised",
  "quote.accepted": "Quote accepted and booking confirmed",
  "quote.rejected": "Quote rejected",
  "quote.withdrawn": "Quote withdrawn",
  "quote.expired": "Quote expired",
  "reschedule.requested": "Reschedule requested",
  "reschedule.accepted": "Reschedule accepted",
  "reschedule.rejected": "Reschedule declined",
  "reschedule.withdrawn": "Reschedule withdrawn",
  "payment.verified": "Customer's payment verified",
  "dispute.opened": "Dispute opened",
  "dispute.under_review": "Dispute under review",
  "dispute.withdrawn": "Dispute withdrawn",
  "dispute.resolved_completed": "Dispute resolved: marked completed",
  "dispute.resolved_cancelled": "Dispute resolved: cancelled",
  "dispute.restored": "Dispute closed: booking restored",
};
