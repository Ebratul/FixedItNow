import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }), usePathname: () => "/admin", useSearchParams: () => new URLSearchParams() }));
const api = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => api(...a),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string, public fieldErrors: Record<string, string> = {}, public code?: string) { super(message); }
  },
}));
const data: Record<string, unknown> = {};
const errors: Record<string, string> = {};
const paths: string[] = [];
const refresh = vi.fn();
const reload = vi.fn();
vi.mock("@/lib/use-api", () => ({
  useApi: (path: string) => {
    paths.push(path);
    const key = Object.keys(data).filter((k) => path.startsWith(k)).sort((a, b) => b.length - a.length)[0];
    const err = Object.keys(errors).find((k) => path.startsWith(k));
    const state = err ? { status: "error", message: errors[err] } : key ? { status: "ready", data: data[key] } : { status: "loading" };
    return { state, reload, refresh, stale: false };
  },
}));
const downloadFile = vi.fn();
vi.mock("@/components/admin/kit", async (orig) => ({ ...(await orig<typeof import("@/components/admin/kit")>()), downloadFile: (...a: unknown[]) => downloadFile(...a) }));

import { ApiError } from "@/lib/api";
import { AdminProvider } from "@/components/admin/shell/admin-context";
import { BookingDetail } from "@/components/admin/ops/booking-detail";
import { BookingsList } from "@/components/admin/ops/bookings-list";
import { DisputeDetail } from "@/components/admin/ops/dispute-detail";
import { DisputesList } from "@/components/admin/ops/disputes-list";
import { FinanceView } from "@/components/admin/ops/finance-view";
import { PaymentDetail } from "@/components/admin/ops/payment-detail";
import { PaymentsView } from "@/components/admin/ops/payments-view";
import type { Me } from "@/lib/use-api";

const as = (permissions: string[]) => ({ user: { id: "a1", name: "Admin", email: "a@x.test", emailVerified: true, image: null }, isAdmin: true, admin: { role: { key: "ops", name: "Ops" }, permissions } }) as unknown as Me;
const view = (ui: React.ReactNode, permissions: string[] = []) => render(<AdminProvider me={as(permissions)}>{ui}</AdminProvider>);

const BID = "11111111-1111-4111-8111-111111111111";
const DID = "22222222-2222-4222-8222-222222222222";
const REF = "FIN0123456789ABCDEF01234567";
const page = { page: 1, pageSize: 20, total: 1, totalPages: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  api.mockReset();
  paths.length = 0;
  for (const k of Object.keys(data)) delete data[k];
  for (const k of Object.keys(errors)) delete errors[k];
});

const bookingRow = (over: object = {}) => ({
  id: BID, status: "DISPUTED", startAt: "2026-11-03T04:00:00Z", endAt: "2026-11-03T06:00:00Z", createdAt: "2026-11-01T04:00:00Z", serviceArea: "Dhanmondi",
  pricingModel: "FIXED", agreedAmountBdt: 1500, category: { name: "Electrical Services", slug: "electrical" }, customer: { id: "c1", name: "Asha Rahman" },
  worker: { id: "w1", displayName: "Karim Electric" }, dispute: { id: DID, status: "OPEN" }, paymentCount: 1, ...over,
});

describe("admin bookings list", () => {
  it("shows server rows, status tabs with their counts and links to the detail page", () => {
    data["/admin/bookings"] = { bookings: [bookingRow()], statusCounts: { DISPUTED: 3, COMPLETED: 5 }, ...page };
    view(<BookingsList />, ["bookings.read"]);
    expect(screen.getByRole("tab", { name: /All\s*8/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /In dispute\s*3/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Completed\s*5/ })).toBeInTheDocument();
    expect(screen.getByText("Asha Rahman")).toBeInTheDocument();
    expect(screen.getByText("৳1,500")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Electrical Services/ })).toHaveAttribute("href", `/admin/bookings/${BID}`);
  });

  it("filters by tab through the API and hides the category filter without catalog.read", () => {
    data["/admin/bookings"] = { bookings: [bookingRow()], statusCounts: { DISPUTED: 1 }, ...page };
    view(<BookingsList />, ["bookings.read"]);
    expect(screen.queryByLabelText("Category")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /In dispute/ }));
    expect(paths.at(-1)).toContain("status=DISPUTED");
    expect(paths.at(-1)).toContain("pageSize=20");
  });

  it("offers the category filter with catalog.read", () => {
    data["/admin/bookings"] = { bookings: [bookingRow()], statusCounts: {}, ...page };
    data["/admin/categories"] = { categories: [{ id: "cat1", name: "Plumbing", children: [{ id: "cat2", name: "Leaks" }] }] };
    view(<BookingsList />, ["bookings.read", "catalog.read"]);
    expect(screen.getByLabelText("Category")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Plumbing › Leaks" })).toBeInTheDocument();
  });

  it("validates the date range and does not show results for it", () => {
    data["/admin/bookings"] = { bookings: [bookingRow()], statusCounts: {}, ...page };
    view(<BookingsList />, ["bookings.read"]);
    fireEvent.change(screen.getByLabelText("Appointment from"), { target: { value: "2026-11-10" } });
    fireEvent.change(screen.getByLabelText("Appointment to"), { target: { value: "2026-11-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent("start date must be on or before");
    expect(paths.at(-1)).not.toContain("from=");
  });

  it("shows an empty state and an error state with retry", () => {
    data["/admin/bookings"] = { bookings: [], statusCounts: {}, ...page, total: 0, totalPages: 0 };
    const { unmount } = view(<BookingsList />, ["bookings.read"]);
    expect(screen.getByText("No bookings found")).toBeInTheDocument();
    unmount();
    errors["/admin/bookings"] = "Something went wrong on our side.";
    view(<BookingsList />, ["bookings.read"]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reload).toHaveBeenCalled();
  });
});

describe("admin booking detail", () => {
  it("renders the timeline, payments with links, the dispute link and explains the visible address", () => {
    data[`/admin/bookings/${BID}`] = {
      booking: {
        ...bookingRow(), description: "<b>Fan</b> is broken", serviceAddress: "House 5, Road 3", durationMinutes: 120, timezone: "Asia/Dhaka", unitPriceBdt: null, currency: "BDT",
        confirmedAt: null, startedAt: null, completionRequestedAt: null, completedAt: null, cancelledAt: null, cancellationReason: null, review: null,
        dispute: { id: DID, status: "OPEN", category: "QUALITY", createdAt: "2026-11-04T04:00:00Z" },
        quotes: [{ id: "q1", status: "ACCEPTED", totalBdt: 1500, createdAt: "2026-11-01T05:00:00Z", expiresAt: null }],
        payments: [{ reference: REF, provider: "BKASH", status: "SUCCEEDED", amountBdt: 1500, refundedAmountBdt: 0, createdAt: "2026-11-02T04:00:00Z" }],
        rescheduleRequests: [{ id: "r1", status: "REJECTED", newStartAt: "2026-11-05T04:00:00Z", createdAt: "2026-11-02T04:00:00Z" }],
        events: [{ id: "e1", type: "booking.requested", actorRole: "CUSTOMER", fromStatus: null, toStatus: "REQUESTED", reason: null, createdAt: "2026-11-01T04:00:00Z" }],
      },
    };
    view(<BookingDetail id={BID} />, ["bookings.read"]);
    expect(screen.getByText("Request sent")).toBeInTheDocument();
    expect(screen.getByText("House 5, Road 3")).toBeInTheDocument();
    expect(screen.getByText(/bookings\.read permission/)).toBeInTheDocument();
    expect(screen.getByText("<b>Fan</b> is broken")).toBeInTheDocument(); // plain text, not HTML
    expect(screen.getByRole("link", { name: REF })).toHaveAttribute("href", `/admin/payments/${REF}`);
    expect(screen.getByRole("link", { name: /open the dispute/ })).toHaveAttribute("href", `/admin/disputes/${DID}`);
    expect(screen.getByText("Proposed new start:", { exact: false })).toBeInTheDocument();
  });
});

describe("admin disputes", () => {
  it("lists disputes with a status filter", () => {
    data["/admin/disputes"] = { disputes: [{ id: DID, status: "OPEN", category: "QUALITY", openedByRole: "CUSTOMER", createdAt: "2026-11-04T04:00:00Z", assignedAdminId: null, booking: { id: BID, status: "DISPUTED", startAt: "2026-11-03T04:00:00Z", category: { name: "Electrical Services" } } }], ...page };
    view(<DisputesList />, ["disputes.read"]);
    expect(screen.getByRole("link", { name: /Quality/ })).toHaveAttribute("href", `/admin/disputes/${DID}`);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "UNDER_REVIEW" } });
    expect(paths.at(-1)).toContain("status=UNDER_REVIEW");
  });

  const detail = (status: string) => ({
    dispute: {
      id: DID, status, category: "QUALITY", description: "Not fixed", openedByRole: "CUSTOMER", previousBookingStatus: "COMPLETED", outcome: null, resolution: null, resolvedAt: null, assignedAdminId: null, createdAt: "2026-11-04T04:00:00Z",
      messages: [
        { id: "m1", authorRole: "CUSTOMER", body: "Still broken", internal: false, createdAt: "2026-11-04T05:00:00Z" },
        { id: "m2", authorRole: "ADMIN", body: "Checking with worker", internal: true, createdAt: "2026-11-04T06:00:00Z" },
      ],
    },
    booking: { id: BID, status: "DISPUTED", category: { name: "Electrical Services", slug: "e" }, description: null, serviceArea: "Dhanmondi", serviceAddress: "House 5", startAt: "2026-11-03T04:00:00Z", endAt: "2026-11-03T06:00:00Z", agreedAmountBdt: 1500, currency: "BDT", customerName: "Asha", workerName: "Karim" },
    quotes: [],
    events: [{ type: "dispute.opened", actorRole: "CUSTOMER", fromStatus: "COMPLETED", toStatus: "DISPUTED", reason: null, createdAt: "2026-11-04T04:00:00Z" }],
  });

  it("marks internal messages and offers only the actions valid for the status", () => {
    data[`/admin/disputes/${DID}`] = detail("OPEN");
    view(<DisputeDetail id={DID} />, ["disputes.read", "disputes.manage"]);
    expect(screen.getByText(/Internal note: not visible to the customer/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start review" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask for information" })).not.toBeInTheDocument();
  });

  it("offers decisions while under review, and nothing once closed", () => {
    data[`/admin/disputes/${DID}`] = detail("UNDER_REVIEW");
    const { unmount } = view(<DisputeDetail id={DID} />, ["disputes.read", "disputes.manage"]);
    for (const name of ["Ask for information", "Add message", "Resolve", "Reject"]) expect(screen.getByRole("button", { name })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start review" })).not.toBeInTheDocument();
    unmount();
    data[`/admin/disputes/${DID}`] = detail("RESOLVED");
    view(<DisputeDetail id={DID} />, ["disputes.read", "disputes.manage"]);
    expect(screen.queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument();
    expect(screen.getByText(/dispute is closed/)).toBeInTheDocument();
  });

  it("hides every action without disputes.manage", () => {
    data[`/admin/disputes/${DID}`] = detail("UNDER_REVIEW");
    view(<DisputeDetail id={DID} />, ["disputes.read"]);
    expect(screen.queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add message" })).not.toBeInTheDocument();
  });

  it("starts a review with an empty body", async () => {
    data[`/admin/disputes/${DID}`] = detail("OPEN");
    api.mockResolvedValue({});
    view(<DisputeDetail id={DID} />, ["disputes.read", "disputes.manage"]);
    fireEvent.click(screen.getByRole("button", { name: "Start review" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith(`/admin/disputes/${DID}/review`, { method: "POST", body: {} }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("adds an internal note", async () => {
    data[`/admin/disputes/${DID}`] = detail("UNDER_REVIEW");
    api.mockResolvedValue({});
    view(<DisputeDetail id={DID} />, ["disputes.read", "disputes.manage"]);
    fireEvent.click(screen.getByRole("button", { name: "Add message" }));
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Call the worker" } });
    fireEvent.click(screen.getByLabelText(/Internal note\./));
    fireEvent.click(screen.getByRole("button", { name: "Add internal note" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith(`/admin/disputes/${DID}/messages`, { method: "POST", body: { body: "Call the worker", internal: true } }));
  });

  it("validates the resolution, explains the outcome, confirms, then sends outcome and resolution", async () => {
    data[`/admin/disputes/${DID}`] = detail("UNDER_REVIEW");
    api.mockResolvedValue({});
    view(<DisputeDetail id={DID} />, ["disputes.read", "disputes.manage"]);
    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    expect(screen.getByText(/flagged for review; nothing is refunded automatically/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Cancel the booking/));
    const next = screen.getByRole("button", { name: "Continue" });
    expect(next).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Resolution/), { target: { value: "short" } });
    expect(screen.getByText("Use at least 10 characters.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Resolution/), { target: { value: "Worker did not show up." } });
    fireEvent.click(next);
    expect(api).not.toHaveBeenCalled();
    expect(screen.getByText("Resolve this dispute?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resolve dispute" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith(`/admin/disputes/${DID}/resolve`, { method: "POST", body: { outcome: "CANCEL_BOOKING", resolution: "Worker did not show up." } }));
  });

  it("keeps the confirmation open and shows the server message when resolving fails", async () => {
    data[`/admin/disputes/${DID}`] = detail("UNDER_REVIEW");
    api.mockRejectedValue(new ApiError(409, "This dispute just changed. Refresh and try again."));
    view(<DisputeDetail id={DID} />, ["disputes.read", "disputes.manage"]);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: "Not enough evidence." } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Reject dispute" }));
    expect(await screen.findByText("This dispute just changed. Refresh and try again.")).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith(`/admin/disputes/${DID}/reject`, { method: "POST", body: { resolution: "Not enough evidence." } });
  });
});

const payRow = (over: object = {}) => ({
  reference: REF, bookingId: BID, provider: "BKASH", mode: "sandbox", status: "REQUIRES_REVIEW", amountBdt: 1500, refundedAmountBdt: 0, needsAttention: true,
  createdAt: "2026-11-02T04:00:00Z", customer: { id: "c1", name: "Asha Rahman" }, reviewReason: "DUPLICATE_PAYMENT", ...over,
});
const refundRow = (status: string, over: object = {}) => ({
  id: "33333333-3333-4333-8333-333333333333", status, requestedAmountBdt: 1500, approvedAmountBdt: status === "REQUESTED" ? null : 1200, reason: "Duplicate payment", decisionNote: null,
  createdAt: "2026-11-03T04:00:00Z", requestedByRole: "CUSTOMER", failureCode: null, payment: { reference: REF, provider: "BKASH", amountBdt: 1500, refundedAmountBdt: 0, status: "SUCCEEDED" }, ...over,
});

describe("admin payments", () => {
  it("lists payments with formatBdt amounts, filters and validates the search length", () => {
    data["/admin/payments"] = { payments: [payRow()], ...page };
    view(<PaymentsView />, ["payments.read"]);
    expect(screen.getByRole("link", { name: REF })).toHaveAttribute("href", `/admin/payments/${REF}`);
    expect(screen.getByText("৳1,500")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Needs attention" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "NEEDS_ATTENTION" } });
    fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "BKASH" } });
    expect(paths.at(-1)).toContain("status=NEEDS_ATTENTION");
    expect(paths.at(-1)).toContain("provider=BKASH");
    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "FI" } });
    expect(screen.getByText("Type at least 3 characters to search.")).toBeInTheDocument();
  });

  it("shows refund actions by status and permission", () => {
    data["/admin/payments"] = { payments: [], ...page, total: 0, totalPages: 0 };
    data["/admin/refunds"] = { refunds: [refundRow("REQUESTED"), refundRow("APPROVED", { id: "44444444-4444-4444-8444-444444444444" }), refundRow("SUCCEEDED", { id: "55555555-5555-4555-8555-555555555555" })], ...page, total: 3 };
    view(<PaymentsView />, ["payments.read", "refunds.decide"]);
    fireEvent.click(screen.getByRole("tab", { name: "Refunds" }));
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Reject" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Send to payment provider" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Refunded (confirmed)")).toBeInTheDocument();
  });

  it("approves with confirm:true and the typed amount", async () => {
    data["/admin/refunds"] = { refunds: [refundRow("REQUESTED")], ...page };
    api.mockResolvedValue({ refund: { status: "APPROVED" } });
    view(<PaymentsView />, ["payments.read", "refunds.decide"]);
    fireEvent.click(screen.getByRole("tab", { name: "Refunds" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    fireEvent.change(screen.getByLabelText(/Amount to refund/), { target: { value: "2000" } });
    expect(screen.getByText(/Enter an amount from ৳1 to ৳1,500/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Amount to refund/), { target: { value: "1200" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve refund" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/refunds/33333333-3333-4333-8333-333333333333/approve", { method: "POST", body: { confirm: true, amountBdt: 1200 } }));
    expect(await screen.findByText(/No money has moved yet/)).toBeInTheDocument();
  });

  it("requires the payment reference before sending money, and then sends confirm:true", async () => {
    data["/admin/refunds"] = { refunds: [refundRow("APPROVED")], ...page };
    api.mockResolvedValue({ refund: { status: "PROCESSING" } });
    view(<PaymentsView />, ["payments.read", "refunds.process"]);
    fireEvent.click(screen.getByRole("tab", { name: "Refunds" }));
    fireEvent.click(screen.getByRole("button", { name: "Send to payment provider" }));
    expect(screen.getByText(/moves real money/)).toBeInTheDocument();
    expect(screen.getByText(/৳1,200 will be refunded to the customer through bKash/)).toBeInTheDocument();
    const go = screen.getByRole("button", { name: /Refund ৳1,200 now/ });
    expect(go).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: REF } });
    fireEvent.click(go);
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/refunds/33333333-3333-4333-8333-333333333333/process", { method: "POST", body: { confirm: true } }));
    // PROCESSING is never presented as done
    expect(await screen.findByText(/NOT complete until the provider confirms/)).toBeInTheDocument();
    expect(screen.queryByText(/now recorded as refunded/)).not.toBeInTheDocument();
  });

  it("shows the server's REFUNDS_NOT_SUPPORTED message as is and keeps the dialog open", async () => {
    data["/admin/refunds"] = { refunds: [refundRow("APPROVED")], ...page };
    const msg = "Automatic refunds are not enabled for this payment provider. The refund stays approved; it must be completed in the provider's merchant panel, and this system does not record unverified refunds.";
    api.mockRejectedValue(new ApiError(422, msg, {}, "REFUNDS_NOT_SUPPORTED"));
    view(<PaymentsView />, ["payments.read", "refunds.process"]);
    fireEvent.click(screen.getByRole("tab", { name: "Refunds" }));
    fireEvent.click(screen.getByRole("button", { name: "Send to payment provider" }));
    fireEvent.change(screen.getByLabelText(/Type/), { target: { value: REF } });
    fireEvent.click(screen.getByRole("button", { name: /Refund ৳1,200 now/ }));
    expect(await screen.findByText(msg)).toBeInTheDocument();
  });

  it("offers Re-check only for processing refunds with payments.reconcile", async () => {
    data["/admin/refunds"] = { refunds: [refundRow("PROCESSING")], ...page };
    api.mockResolvedValue({ refund: { status: "SUCCEEDED" } });
    const { unmount } = view(<PaymentsView />, ["payments.read", "refunds.decide"]);
    fireEvent.click(screen.getByRole("tab", { name: "Refunds" }));
    expect(screen.queryByRole("button", { name: "Re-check with provider" })).not.toBeInTheDocument();
    unmount();
    view(<PaymentsView />, ["payments.read", "payments.reconcile"]);
    fireEvent.click(screen.getByRole("tab", { name: "Refunds" }));
    fireEvent.click(screen.getByRole("button", { name: "Re-check with provider" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/refunds/33333333-3333-4333-8333-333333333333/reconcile", { method: "POST", body: {} }));
    expect(await screen.findByText(/provider confirmed the refund/)).toBeInTheDocument();
  });

  const paymentDetail = (over: object = {}) => ({
    payment: {
      ...payRow({ status: "SUCCEEDED", needsAttention: false, reviewReason: null }), currency: "BDT", refundableAmountBdt: 1500, bookingIneligible: false, providerTransactionId: "TRX1", succeededAt: "2026-11-02T04:05:00Z",
      failureCode: null, verificationAttempts: 2, lastVerifiedAt: "2026-11-02T04:06:00Z", booking: { id: BID, status: "COMPLETED", serviceName: "Electrical Services" },
      refunds: [], events: [{ type: "payment.succeeded", fromStatus: "INITIATED", toStatus: "SUCCEEDED", actorRole: "SYSTEM", metadata: { source: "<script>x</script>" }, createdAt: "2026-11-02T04:05:00Z" }], ...over,
    },
  });

  it("renders payment facts and event metadata as plain text", () => {
    data[`/admin/payments/${REF}`] = paymentDetail();
    view(<PaymentDetail reference={REF} />, ["payments.read"]);
    expect(screen.getByText("TRX1")).toBeInTheDocument();
    expect(screen.getByText(/source: <script>x<\/script>/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create refund" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Re-verify with provider" })).not.toBeInTheDocument();
  });

  it("re-verifies with an empty body and says the status comes from the provider", async () => {
    data[`/admin/payments/${REF}`] = paymentDetail();
    api.mockResolvedValue({ payment: { status: "SUCCEEDED" } });
    view(<PaymentDetail reference={REF} />, ["payments.read", "payments.reconcile"]);
    expect(screen.getByText(/always comes from the provider, never from this page/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Re-verify with provider" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith(`/admin/payments/${REF}/reconcile`, { method: "POST", body: {} }));
    expect(await screen.findByText(/Its answer: Succeeded/)).toBeInTheDocument();
  });

  it("creates a refund with an Idempotency-Key header and confirm:true", async () => {
    data[`/admin/payments/${REF}`] = paymentDetail();
    api.mockResolvedValue({ refund: { status: "APPROVED" } });
    view(<PaymentDetail reference={REF} />, ["payments.read", "refunds.decide"]);
    fireEvent.click(screen.getByRole("button", { name: "Create refund" }));
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "short" } });
    expect(screen.getByText("Use at least 10 characters.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Duplicate charge confirmed" } });
    const buttons = screen.getAllByRole("button", { name: "Create refund" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(api).toHaveBeenCalled());
    const [path, init] = api.mock.calls[0] as [string, { method: string; body: unknown; headers: Record<string, string> }];
    expect(path).toBe(`/admin/payments/${REF}/refunds`);
    expect(init.body).toEqual({ reason: "Duplicate charge confirmed", confirm: true });
    expect(init.headers["Idempotency-Key"]).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it("lists refunds on the payment with their API status", () => {
    data[`/admin/payments/${REF}`] = paymentDetail({ refunds: [{ id: "r1", status: "PROCESSING", requestedAmountBdt: 1500, approvedAmountBdt: 1500, reason: "Duplicate", decisionNote: null, createdAt: "2026-11-03T04:00:00Z", decidedAt: null, completedAt: null }] });
    view(<PaymentDetail reference={REF} />, ["payments.read"]);
    expect(screen.getByText("Processing at provider")).toBeInTheDocument();
    expect(screen.queryByText(/Refunded \(confirmed\)/)).not.toBeInTheDocument();
  });
});

describe("admin finance", () => {
  const summary = {
    range: { from: "2026-10-01T00:00:00Z", to: "2026-10-03T00:00:00Z" }, currency: "BDT",
    totals: { collectedBdt: 5000, refundedBdt: 500, netBdt: 4500, successfulPayments: 4 },
    byProvider: [{ provider: "BKASH", collectedBdt: 5000, payments: 4 }], byStatus: { SUCCEEDED: 4, FAILED: 1 },
    byCategory: [{ category: "Plumbing", collectedBdt: 5000, payments: 4 }], pendingRefunds: { count: 2, requestedBdt: 900 },
    daily: [{ day: "2026-10-01", collected: 3000, refunded: 0 }, { day: "2026-10-02", collected: 2000, refunded: 500 }],
  };
  const commission = {
    rateBps: 500, rateSource: "setting", configuredRateBps: 500, totals: { collectedBdt: 5000, refundedBdt: 500, netBdt: 4500, commissionBdt: 225 }, reportingOnly: true,
    note: "Reporting only: no fee is charged to customers or deducted from workers. Commission is net collected x rate for the period; refunds count on the day they were confirmed.",
  };

  it("shows tiles, breakdowns, an accessible chart with a data table and the verbatim note", () => {
    data["/admin/finance/summary"] = summary;
    data["/admin/finance/commission"] = commission;
    view(<FinanceView />, ["finance.reports"]);
    expect(screen.getAllByText("৳5,000", { selector: "dd" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Plumbing")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Total ৳5,000; highest day ৳3,000/ })).toBeInTheDocument();
    expect(screen.getByText("2026-10-01: ৳3,000 collected", { selector: "title" })).toBeInTheDocument();
    expect(screen.getByText("Show the daily figures as a table")).toBeInTheDocument();
    expect(screen.getByText(commission.note)).toBeInTheDocument();
    expect(screen.getByText("Reporting only: nothing is charged")).toBeInTheDocument();
    expect(screen.getAllByText("5%", { exact: false }).length).toBeGreaterThan(0);
    expect(paths.some((p) => p.startsWith("/admin/finance/summary?from=") && p.includes("&to="))).toBe(true);
  });

  it("re-queries with rateBps for a what-if rate and rejects out-of-range rates", async () => {
    data["/admin/finance/summary"] = summary;
    data["/admin/finance/commission"] = commission;
    view(<FinanceView />, ["finance.reports"]);
    fireEvent.change(screen.getByLabelText(/What-if rate/), { target: { value: "9000" } });
    expect(screen.getByText(/at most 5000 basis points/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/What-if rate/), { target: { value: "250" } });
    await waitFor(() => expect(paths.at(-1)).toContain("rateBps=250"));
  });

  it("refuses a range longer than 366 days and does not query it", () => {
    data["/admin/finance/summary"] = summary;
    data["/admin/finance/commission"] = commission;
    view(<FinanceView />, ["finance.reports"]);
    fireEvent.change(screen.getByLabelText("Report from"), { target: { value: "2020-01-01" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Fix the reporting period/)).toBeInTheDocument();
  });

  it("exports the CSV with the same query", async () => {
    data["/admin/finance/summary"] = summary;
    data["/admin/finance/commission"] = commission;
    downloadFile.mockResolvedValue(undefined);
    view(<FinanceView />, ["finance.reports"]);
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    await waitFor(() => expect(downloadFile).toHaveBeenCalled());
    const [path, name] = downloadFile.mock.calls[0];
    expect(path).toMatch(/^\/admin\/finance\/commission\/export\?from=.+&to=/);
    expect(name).toBe("commission-report.csv");
  });

  it("shows an export failure message", async () => {
    data["/admin/finance/summary"] = summary;
    data["/admin/finance/commission"] = commission;
    downloadFile.mockRejectedValue(new Error("Too many exports. Wait a minute and try again."));
    view(<FinanceView />, ["finance.reports"]);
    fireEvent.click(screen.getByRole("button", { name: /Export CSV/ }));
    expect(await screen.findByText("Too many exports. Wait a minute and try again.")).toBeInTheDocument();
  });

  it("explains an empty period instead of drawing an empty chart", () => {
    data["/admin/finance/summary"] = { ...summary, daily: [{ day: "2026-10-01", collected: 0, refunded: 0 }], byProvider: [], byCategory: [], totals: { collectedBdt: 0, refundedBdt: 0, netBdt: 0, successfulPayments: 0 } };
    data["/admin/finance/commission"] = commission;
    view(<FinanceView />, ["finance.reports"]);
    expect(screen.getByText(/No payments were collected on any day/)).toBeInTheDocument();
    expect(within(document.body).queryByRole("img")).not.toBeInTheDocument();
  });
});
