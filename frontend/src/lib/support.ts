import type { BadgeTone } from "@/components/ui/badge";
import { ApiError } from "@/lib/api";

export const TICKET_CATEGORIES = ["GENERAL", "BOOKING", "PAYMENT", "ACCOUNT", "WORKER_COMPLAINT", "CUSTOMER_COMPLAINT", "SAFETY", "OTHER"] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];
export const TICKET_STATUSES = ["OPEN", "IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

/** Plain words for the person who raised the request. */
export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  GENERAL: "General question",
  BOOKING: "A booking",
  PAYMENT: "A payment",
  ACCOUNT: "My account",
  WORKER_COMPLAINT: "Complaint about a professional",
  CUSTOMER_COMPLAINT: "Complaint about a customer",
  SAFETY: "Safety concern",
  OTHER: "Other",
};
export const COMPLAINT_CATEGORIES: readonly TicketCategory[] = ["WORKER_COMPLAINT", "CUSTOMER_COMPLAINT"];

/** What the requester sees. */
export const USER_STATUS: Record<TicketStatus, { label: string; tone: BadgeTone }> = {
  OPEN: { label: "Received", tone: "warning" },
  IN_PROGRESS: { label: "Being looked at", tone: "brand" },
  WAITING_FOR_USER: { label: "Waiting for your reply", tone: "warning" },
  RESOLVED: { label: "Resolved", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
};

/** What staff see. */
export const STAFF_STATUS: Record<TicketStatus, { label: string; tone: BadgeTone }> = {
  OPEN: { label: "Open", tone: "warning" },
  IN_PROGRESS: { label: "In progress", tone: "brand" },
  WAITING_FOR_USER: { label: "Waiting for user", tone: "neutral" },
  RESOLVED: { label: "Resolved", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
};

export const PRIORITY: Record<TicketPriority, { label: string; tone: BadgeTone }> = {
  LOW: { label: "Low", tone: "neutral" },
  NORMAL: { label: "Normal", tone: "neutral" },
  HIGH: { label: "High", tone: "warning" },
  URGENT: { label: "Urgent", tone: "danger" },
};

export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 140;
export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 4000;

// ---- user-facing API shapes (backend/src/support/support.service.ts)
export type OwnTicket = {
  id: string;
  number: number;
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  bookingId: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
};
export type OwnTicketMessage = { id: string; authorRole: string; body: string; createdAt: string; fromStaff: boolean };
export type OwnTicketList = { tickets: OwnTicket[]; page: number; pageSize: number; total: number; totalPages: number };
export type OwnTicketDetail = { ticket: OwnTicket & { messages: OwnTicketMessage[] } };

// ---- admin API shapes (backend/src/admin/support/admin-support.service.ts)
export type AdminTicketRow = {
  id: string;
  number: number;
  category: TicketCategory;
  priority: TicketPriority;
  subject: string;
  status: TicketStatus;
  bookingId: string | null;
  createdAt: string;
  lastMessageAt: string;
  requester: { id: string; name: string };
  assignee: { id: string; name: string } | null;
  messageCount: number;
};
export type AdminTicketList = {
  tickets: AdminTicketRow[];
  statusCounts: Partial<Record<TicketStatus, number>>;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export type AdminTicketMessage = { id: string; from: "staff" | "requester"; author: string; body: string; internal: boolean; createdAt: string };
export type AdminTicket = Omit<AdminTicketRow, "messageCount"> & {
  resolution: string | null;
  resolvedAt: string | null;
  updatedAt: string;
  isOwn: boolean;
  allowedNext: TicketStatus[];
  booking: { id: string; status: string; service: string; customer: { id: string; name: string }; worker: { id: string; displayName: string | null } } | null;
  messages: AdminTicketMessage[];
};
export type AdminTicketDetail = { ticket: AdminTicket };

/** Server error codes that the generic client message would hide (a 403 is always "no permission"). */
const CODE_MESSAGES: Record<string, string> = {
  OWN_TICKET: "You cannot handle a request you raised yourself. Another member of staff needs to answer it.",
  TICKET_CLOSED: "This ticket is closed, so it cannot be answered or changed.",
  INVALID_TRANSITION: "That status change is not allowed from the ticket's current status.",
  RESOLUTION_REQUIRED: "Write the resolution the requester will see before marking the ticket resolved.",
  NO_CHANGE: "Nothing changed: the ticket already has these values.",
  STALE_TICKET: "This ticket just changed. Refresh and try again.",
  INVALID_ASSIGNEE: "Tickets can only be assigned to active staff who can handle support.",
};

export function ticketErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code && CODE_MESSAGES[error.code]) return CODE_MESSAGES[error.code]!;
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
