import type { BookingReview } from "./community";
import type { PaymentView } from "./payment-types";

export type BookingStatus =
  | "REQUESTED" | "QUOTED" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETION_PENDING"
  | "COMPLETED" | "CANCELLED" | "DECLINED" | "EXPIRED" | "DISPUTED";

export type ViewerRole = "CUSTOMER" | "WORKER";

export type BookingSummary = {
  id: string;
  status: BookingStatus;
  category: { slug: string; name: string };
  counterpartyName: string;
  serviceArea: string;
  startAt: string;
  endAt: string;
  agreedAmountBdt: number | null;
  pricingModel: "FIXED" | "HOURLY" | "QUOTE";
  /** Set once the professional reported arriving (self-reported; no location is verified). */
  arrivedAt: string | null;
  createdAt: string;
};

export type BookingList = {
  bookings: BookingSummary[];
  role: "customer" | "worker";
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type Quote = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";
  laborBdt: number;
  materialsBdt: number;
  otherBdt: number;
  totalBdt: number;
  currency: string;
  description: string;
  terms: string | null;
  estimatedDurationMinutes: number | null;
  expiresAt: string;
  createdAt: string;
  decidedAt: string | null;
  actions: string[];
};

export type RescheduleRequest = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";
  newStartAt: string;
  newEndAt: string;
  previousStartAt: string;
  previousEndAt: string;
  reason: string | null;
  requestedByRole: ViewerRole;
  expiresAt: string;
  createdAt: string;
  decidedAt: string | null;
  actions: string[];
};

export type DisputeSummary = {
  id: string;
  status: "OPEN" | "UNDER_REVIEW" | "WAITING_FOR_INFORMATION" | "RESOLVED" | "REJECTED" | "CLOSED";
  category: string;
  openedByRole: "CUSTOMER" | "WORKER";
  resolution: string | null;
  outcome: string | null;
  resolvedAt: string | null;
  createdAt: string;
};

export type BookingEvent = {
  id: string;
  type: string;
  actorRole: "CUSTOMER" | "WORKER" | "ADMIN" | "SYSTEM";
  fromStatus: BookingStatus | null;
  toStatus: BookingStatus | null;
  reason: string | null;
  createdAt: string;
};

export type BookingDetail = {
  booking: {
    id: string;
    status: BookingStatus;
    viewerRole: ViewerRole;
    category: { slug: string; name: string };
    description: string;
    serviceArea: string;
    serviceAddress: string | null;
    startAt: string;
    endAt: string;
    durationMinutes: number;
    timezone: string;
    worker: { displayName: string; slug: string | null };
    customer?: { name: string };
    pricing: { model: "FIXED" | "HOURLY" | "QUOTE"; unitPriceBdt: number | null; agreedAmountBdt: number | null; currency: string };
    confirmedAt: string | null;
    /** When "I have arrived" / "Start job" become available (30 minutes before the appointment). */
    startWindowOpensAt: string;
    /** The professional's own report that they arrived. Not verified by GPS or any location check. */
    arrivedAt: string | null;
    startedAt: string | null;
    completionRequestedAt: string | null;
    completedAt: string | null;
    cancellation: { at: string; reason: string | null; by: string | null } | null;
    createdAt: string;
  };
  actions: string[];
  quotes: Quote[];
  rescheduleRequests: RescheduleRequest[];
  dispute: DisputeSummary | null;
  events: BookingEvent[];
  /** Whether the booking's private chat is open, read-only, or not available (yet). */
  chat: ChatAvailability;
  /** Customer: full summary. Professional: only whether a verified payment exists. */
  payment: BookingPayment;
  /** Customer: can they review, and their own review. Professional: a visible review only. */
  review: BookingReview;
};

export type ChatAvailability = { state: "NOT_OPEN" | "OPEN" | "READ_ONLY"; reason: string | null };

export type ChatMessage = {
  id: string;
  senderRole: ViewerRole;
  mine: boolean;
  body: string;
  createdAt: string;
  /** Only on the sender's own messages: lets the client match its pending copy. */
  clientMessageId?: string;
};

export type ChatThread = {
  chat: ChatAvailability;
  counterparty: { displayName: string; role: ViewerRole; slug: string | null };
  messages: ChatMessage[];
  hasMore: boolean;
};

export type BookingPayment =
  | { state: "UNPAID" | "PAID" | "REFUNDED" }
  | {
      state: "UNPAID" | "IN_PROGRESS" | "PAID" | "PARTIALLY_REFUNDED" | "REFUNDED" | "UNDER_REVIEW";
      canPay: boolean;
      amountBdt: number | null;
      currency: string;
      activeReference: string | null;
      payments: PaymentView[];
    };

export type DisputeDetail = {
  dispute: DisputeSummary & {
    description: string;
    messages: { id: string; authorRole: string; body: string; createdAt: string }[];
  };
};

export type AvailabilityDay = { date: string; slots: string[] };
export type PublicAvailability = {
  timezone: string;
  durationMinutes: number;
  acceptingBookings: boolean;
  days: AvailabilityDay[];
};

export type MyAvailability = {
  timezone: string;
  rules: { id: string; weekday: number; startMinute: number; endMinute: number }[];
  timeOff: { id: string; startAt: string; endAt: string; note: string | null }[];
};
