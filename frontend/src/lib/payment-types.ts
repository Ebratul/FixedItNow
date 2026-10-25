export type PaymentStatus =
  | "PENDING" | "INITIATED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | "EXPIRED"
  | "REQUIRES_REVIEW" | "PARTIALLY_REFUNDED" | "REFUNDED";

export type ProviderId = "BKASH";

export type RefundStatus = "REQUESTED" | "APPROVED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "REJECTED";

export type RefundView = {
  id: string;
  status: RefundStatus;
  requestedAmountBdt: number;
  approvedAmountBdt: number | null;
  reason: string;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  completedAt: string | null;
};

/** What the backend tells a customer about one payment attempt. No secrets, no provider ids. */
export type PaymentView = {
  reference: string;
  bookingId: string;
  provider: ProviderId;
  mode: "sandbox" | "live";
  status: PaymentStatus;
  amountBdt: number;
  currency: string;
  refundedAmountBdt: number;
  refundableAmountBdt: number;
  needsAttention: boolean;
  bookingIneligible: boolean;
  providerTransactionId: string | null;
  createdAt: string;
  succeededAt: string | null;
  refunds?: RefundView[];
  events?: { type: string; toStatus: PaymentStatus | null; createdAt: string }[];
};

export type PaymentDetail = {
  payment: PaymentView & { booking: { id: string; status: string; serviceName: string; workerName: string } };
};

export type PaymentList = {
  payments: (PaymentView & { booking: { serviceName: string; workerName: string } })[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type ProviderInfo = {
  provider: ProviderId;
  label: string;
  available: boolean;
  mode: "sandbox" | "live" | null;
  minAmountBdt: number | null;
  maxAmountBdt: number | null;
};
