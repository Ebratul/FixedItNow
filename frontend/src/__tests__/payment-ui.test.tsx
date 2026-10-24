import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingDetail } from "@/lib/booking-types";
import type { PaymentDetail, PaymentView, ProviderInfo } from "@/lib/payment-types";

let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/payments/FIN1",
  useSearchParams: () => new URLSearchParams(search),
}));
const api = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => api(...a),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string, public fieldErrors: Record<string, string> = {}, public code?: string) { super(message); }
  },
}));
vi.mock("@/lib/use-api", () => ({
  useMe: () => ({ state: { status: "ready", data: { user: { name: "T" }, worker: { started: false }, customer: { onboarded: true } } }, reload: vi.fn() }),
  useApi: vi.fn(),
}));

import { Checkout } from "@/components/payments/checkout";
import { Detail, PaymentDetailView } from "@/components/payments/payment-detail";
import { describePayment, isSafeCheckoutUrl } from "@/lib/payment-status";

const payment = (over: Partial<PaymentDetail["payment"]> = {}): PaymentDetail => ({
  payment: {
    reference: "FIN1", bookingId: "b1", provider: "BKASH", mode: "live", status: "SUCCEEDED", amountBdt: 500, currency: "BDT",
    refundedAmountBdt: 0, refundableAmountBdt: 0, needsAttention: false, bookingIneligible: false, providerTransactionId: "TRX1",
    createdAt: "2026-11-01T06:00:00Z", succeededAt: "2026-11-01T06:01:00Z", refunds: [], events: [],
    booking: { id: "b1", status: "CONFIRMED", serviceName: "Electrical Services", workerName: "Rahim Uddin" },
    ...over,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  search = "";
});

describe("payment wording comes from the server's status only", () => {
  it("says 'verified' only for a status the server reports as verified", () => {
    const headline = (status: PaymentView["status"]) =>
      describePayment({ status, provider: "BKASH", needsAttention: false, bookingIneligible: false, refundedAmountBdt: 0 }).headline;
    expect(headline("SUCCEEDED")).toBe("Payment has been verified");
    for (const status of ["PENDING", "INITIATED", "PROCESSING", "FAILED", "CANCELLED", "EXPIRED", "REQUIRES_REVIEW"] as const) {
      expect(headline(status), status).not.toBe("Payment has been verified");
    }
    expect(headline("PROCESSING")).toBe("Payment is being verified");
    expect(headline("INITIATED")).toBe("Payment status is still pending");
  });

  it("never shows success because the URL says so", async () => {
    search = "status=success&returned=1";
    api.mockResolvedValue(payment({ status: "INITIATED", succeededAt: null, providerTransactionId: null }));
    render(<PaymentDetailView reference="FIN1" />);
    expect(await screen.findByText("Payment status is still pending")).toBeInTheDocument();
    expect(screen.queryByText("Payment has been verified")).not.toBeInTheDocument();
    expect(screen.getByText("Checking with the payment provider…")).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith("/payments/FIN1"); // the authoritative status is asked of the server
  });

  it("shows the verified state and receipt number once the server says SUCCEEDED", async () => {
    api.mockResolvedValue(payment());
    render(<PaymentDetailView reference="FIN1" />);
    expect(await screen.findByText("Payment has been verified")).toBeInTheDocument();
    expect(screen.getByText("TRX1")).toBeInTheDocument();
    expect(screen.queryByText(/Test payment/)).not.toBeInTheDocument();
  });

  it("labels sandbox payments as test payments", () => {
    render(<Detail data={payment({ mode: "sandbox" })} reload={vi.fn()} returned={false} />);
    expect(screen.getByText("Test payment")).toBeInTheDocument();
  });

  it("explains a failed attempt without claiming money moved, and offers a retry", () => {
    render(<Detail data={payment({ status: "FAILED", succeededAt: null, providerTransactionId: null })} reload={vi.fn()} returned />);
    expect(screen.getByText("Payment could not be completed")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try paying again" })).toHaveAttribute("href", "/bookings/b1/pay");
    expect(screen.queryByText("Payment has been verified")).not.toBeInTheDocument();
  });

  it("does not claim a late payment reactivated a cancelled booking", () => {
    render(<Detail data={payment({ bookingIneligible: true, needsAttention: true, refundableAmountBdt: 500, booking: { id: "b1", status: "CANCELLED", serviceName: "E", workerName: "R" } })} reload={vi.fn()} returned={false} />);
    expect(screen.getByText(/no longer active/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send refund request" })).toBeInTheDocument();
  });
});

describe("refunds in the UI", () => {
  const cancelled = (over: Partial<PaymentDetail["payment"]> = {}) => payment({ refundableAmountBdt: 500, booking: { id: "b1", status: "CANCELLED", serviceName: "E", workerName: "R" }, ...over });

  it("only offers a refund request for a cancelled booking", () => {
    const { unmount } = render(<Detail data={payment({ refundableAmountBdt: 500 })} reload={vi.fn()} returned={false} />);
    expect(screen.queryByRole("button", { name: "Send refund request" })).not.toBeInTheDocument();
    expect(screen.getByText(/once the booking is cancelled/)).toBeInTheDocument();
    unmount();
    render(<Detail data={cancelled()} reload={vi.fn()} returned={false} />);
    expect(screen.getByRole("button", { name: "Send refund request" })).toBeInTheDocument();
  });

  it("validates, then sends only a reason and optional amount with an idempotency key", async () => {
    api.mockResolvedValue({});
    const reload = vi.fn();
    render(<Detail data={cancelled()} reload={reload} returned={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Send refund request" }));
    expect(await screen.findByText(/at least 10 characters/)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/Why are you asking/), { target: { value: "I cancelled this booking." } });
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "900" } });
    fireEvent.click(screen.getByRole("button", { name: "Send refund request" }));
    expect(await screen.findByText(/from ৳1 to ৳500/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: "200" } });
    fireEvent.click(screen.getByRole("button", { name: "Send refund request" }));
    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(api).toHaveBeenCalledWith("/payments/FIN1/refunds", {
      method: "POST",
      body: { reason: "I cancelled this booking.", amountBdt: 200 },
      headers: { "Idempotency-Key": expect.stringMatching(/^[0-9a-f-]{36}$/) },
    });
  });

  it("never describes an approved or accepted refund as money returned", () => {
    const refunds = (["REQUESTED", "APPROVED", "PROCESSING", "SUCCEEDED"] as const).map((status, i) => ({
      id: `r${i}`, status, requestedAmountBdt: 500, approvedAmountBdt: status === "REQUESTED" ? null : 500, reason: "cancelled", decisionNote: null,
      createdAt: "2026-11-02T06:00:00Z", decidedAt: null, completedAt: null,
    }));
    render(<Detail data={payment({ refunds, refundableAmountBdt: 0 })} reload={vi.fn()} returned={false} />);
    expect(screen.getByText("Approved, not refunded yet")).toBeInTheDocument();
    expect(screen.getAllByText("Refunded")).toHaveLength(1); // only the provider-confirmed one
    expect(screen.getByText(/has not been sent back yet/)).toBeInTheDocument();
  });
});

describe("checkout", () => {
  const detail = (over: Partial<BookingDetail["payment"]> = {}, booking: Partial<BookingDetail["booking"]> = {}): BookingDetail => ({
    booking: {
      id: "b1", status: "CONFIRMED", viewerRole: "CUSTOMER", category: { slug: "electrical", name: "Electrical Services" }, description: "x",
      serviceArea: "Dhaka", serviceAddress: "House 12", startAt: "2026-11-04T04:00:00.000Z", endAt: "2026-11-04T05:00:00.000Z", durationMinutes: 60,
      timezone: "Asia/Dhaka", worker: { displayName: "Rahim Uddin", slug: null },
      pricing: { model: "FIXED", unitPriceBdt: 500, agreedAmountBdt: 500, currency: "BDT" },
      confirmedAt: null, completedAt: null, cancellation: null, createdAt: "2026-11-01T06:00:00.000Z", ...booking,
    },
    actions: [], quotes: [], rescheduleRequests: [], dispute: null, events: [],
    payment: { state: "UNPAID", canPay: true, amountBdt: 500, currency: "BDT", activeReference: null, payments: [], ...over } as BookingDetail["payment"],
  });
  const both: ProviderInfo[] = [
    { provider: "BKASH", label: "bKash", available: true, mode: "sandbox", minAmountBdt: 1, maxAmountBdt: 500000 },
    { provider: "SSLCOMMERZ", label: "SSLCOMMERZ", available: false, mode: null, minAmountBdt: null, maxAmountBdt: null },
  ];
  const assign = vi.fn();
  beforeEach(() => {
    Object.defineProperty(window, "location", { value: { assign }, writable: true });
  });

  it("shows only providers that are actually available, and never a button that cannot work", () => {
    render(<Checkout detail={detail()} providers={both} />);
    expect(screen.getByRole("button", { name: /Pay ৳500 with bKash/ })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /SSLCOMMERZ/ })).not.toBeInTheDocument();
    expect(screen.getByText("Not available right now.")).toBeInTheDocument();
    expect(screen.getByText(/Test mode/)).toBeInTheDocument();
  });

  it("with nothing configured it says so and offers no pay button", () => {
    render(<Checkout detail={detail()} providers={both.map((p) => ({ ...p, available: false }))} />);
    expect(screen.getByText("Online payment is not available yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pay/ })).not.toBeInTheDocument();
  });

  it("sends only the provider choice (never an amount) with an idempotency key, then follows the provider URL", async () => {
    api.mockResolvedValue({ payment: payment().payment, checkoutUrl: "https://sandbox.bka.sh/checkout/TR1" });
    render(<Checkout detail={detail()} providers={both} />);
    fireEvent.click(screen.getByRole("button", { name: /Pay ৳500 with bKash/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://sandbox.bka.sh/checkout/TR1"));
    expect(api).toHaveBeenCalledWith("/bookings/b1/payments", { method: "POST", body: { provider: "BKASH" }, headers: { "Idempotency-Key": expect.any(String) } });
  });

  it("refuses to follow a non-https or credentialed URL", async () => {
    for (const bad of ["http://sandbox.bka.sh/x", "javascript:alert(1)", "https://user:pw@sandbox.bka.sh/x", null]) {
      assign.mockClear();
      api.mockResolvedValue({ payment: payment().payment, checkoutUrl: bad });
      const { unmount } = render(<Checkout detail={detail()} providers={both} />);
      fireEvent.click(screen.getByRole("button", { name: /Pay ৳500 with bKash/ }));
      await screen.findByText("That attempt has already finished");
      expect(assign).not.toHaveBeenCalled();
      unmount();
    }
    expect(isSafeCheckoutUrl("https://sandbox.bka.sh/x")).toBe(true);
    expect(isSafeCheckoutUrl("//evil.example.com")).toBe(false);
  });

  it("shows the server's message when initiation fails and allows a fresh attempt", async () => {
    const { ApiError } = await import("@/lib/api");
    api.mockRejectedValueOnce(new ApiError(502, "We couldn't start the payment with bKash. Nothing was charged. Please try again in a moment."));
    api.mockResolvedValueOnce({ payment: payment().payment, checkoutUrl: "https://sandbox.bka.sh/checkout/TR2" });
    render(<Checkout detail={detail()} providers={both} />);
    fireEvent.click(screen.getByRole("button", { name: /Pay ৳500 with bKash/ }));
    expect(await screen.findByText(/Nothing was charged/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Pay ৳500 with bKash/ }));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    const keys = api.mock.calls.map((c) => (c[1] as { headers: Record<string, string> }).headers["Idempotency-Key"]);
    expect(keys[0]).not.toBe(keys[1]); // a failed attempt is never replayed
  });

  it("does not let you start a second payment while one is in progress or already verified", () => {
    const inProgress = detail({ state: "IN_PROGRESS", canPay: false, activeReference: "FIN1", payments: [payment({ status: "PROCESSING" }).payment] });
    const { unmount } = render(<Checkout detail={inProgress} providers={both} />);
    expect(screen.getByText("A payment is already in progress")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pay/ })).not.toBeInTheDocument();
    unmount();
    render(<Checkout detail={detail({ state: "PAID", canPay: false, payments: [payment().payment] })} providers={both} />);
    expect(screen.getByText("This booking is already paid")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pay/ })).not.toBeInTheDocument();
  });

  it("is not a page for the professional", () => {
    render(<Checkout detail={{ ...detail(), payment: { state: "UNPAID" }, booking: { ...detail().booking, viewerRole: "WORKER" } }} providers={both} />);
    expect(screen.getByText("Only the customer pays")).toBeInTheDocument();
  });
});
