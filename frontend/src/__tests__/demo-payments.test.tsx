import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingDetail } from "@/lib/booking-types";
import type { PaymentDetail, ProviderInfo } from "@/lib/payment-types";

const router = { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() };
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/payments/demo/FIN0123456789ABCDEF01234567",
  useSearchParams: () => new URLSearchParams(),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
const api = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => api(...a),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string, public fieldErrors: Record<string, string> = {}, public code?: string) { super(message); }
  },
}));
vi.mock("@/lib/use-api", () => ({
  useMe: () => ({ state: { status: "ready", data: { user: { name: "Demo Customer" }, worker: { started: false }, customer: { onboarded: true }, demo: { role: "customer" } } }, reload: vi.fn() }),
  useApi: vi.fn(),
}));

import DemoPaymentPage from "@/app/payments/demo/[reference]/page";
import { Checkout } from "@/components/payments/checkout";
import { DemoCheckoutView } from "@/components/payments/demo-checkout";
import { PaymentBadge } from "@/components/payments/payment-badge";
import { Detail } from "@/components/payments/payment-detail";
import { ApiError } from "@/lib/api";
import { describePayment, isSafeCheckoutUrl, PROVIDER_LABELS } from "@/lib/payment-status";

const REF = "FIN0123456789ABCDEF01234567";

const payment = (over: Partial<PaymentDetail["payment"]> = {}): PaymentDetail => ({
  payment: {
    reference: REF, bookingId: "b1", provider: "DEMO", mode: "simulated", status: "INITIATED", amountBdt: 500, currency: "BDT",
    refundedAmountBdt: 0, refundableAmountBdt: 0, needsAttention: false, bookingIneligible: false, providerTransactionId: null,
    createdAt: "2026-11-01T06:00:00Z", succeededAt: null, refunds: [], events: [],
    booking: { id: "b1", status: "CONFIRMED", serviceName: "Electrical Services", workerName: "Rahim Uddin" },
    ...over,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isSafeCheckoutUrl", () => {
  it("allows this app's own simulated checkout page, relative or with the page's origin", () => {
    expect(isSafeCheckoutUrl(`/payments/demo/${REF}`)).toBe(true);
    expect(isSafeCheckoutUrl(`${window.location.origin}/payments/demo/${REF}`)).toBe(true);
  });

  it("refuses off-origin, malformed and look-alike demo URLs", () => {
    expect(isSafeCheckoutUrl(`http://evil.example/payments/demo/${REF}`)).toBe(false);
    expect(isSafeCheckoutUrl(`http://localhost:9999/payments/demo/${REF}`)).toBe(false);
    expect(isSafeCheckoutUrl(`//evil.example/payments/demo/${REF}`)).toBe(false);
    expect(isSafeCheckoutUrl(`/payments/demo/${REF}?next=https://evil.example`)).toBe(false);
    expect(isSafeCheckoutUrl(`/payments/demo/${REF}/extra`)).toBe(false);
    expect(isSafeCheckoutUrl("/payments/demo/FIN1")).toBe(false);
    expect(isSafeCheckoutUrl("/payments/demo/../../admin")).toBe(false);
    expect(isSafeCheckoutUrl(`/payments/${REF}`)).toBe(false);
    expect(isSafeCheckoutUrl(`${window.location.origin}/admin`)).toBe(false);
    expect(isSafeCheckoutUrl(`${window.location.origin}/payments/demo/${REF}?x=1`)).toBe(false);
    expect(isSafeCheckoutUrl(`${window.location.origin.replace("//", "//user:pw@")}/payments/demo/${REF}`)).toBe(false);
    expect(isSafeCheckoutUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeCheckoutUrl(null)).toBe(false);
  });

  it("leaves real providers exactly as before", () => {
    expect(isSafeCheckoutUrl("https://sandbox.bka.sh/x")).toBe(true);
    expect(isSafeCheckoutUrl("http://sandbox.bka.sh/x")).toBe(false);
    expect(isSafeCheckoutUrl("https://user:pw@sandbox.bka.sh/x")).toBe(false);
  });
});

describe("payment wording for DEMO", () => {
  it("labels the provider and never uses provider wording or says money moved", () => {
    expect(PROVIDER_LABELS.DEMO).toBe("Simulated payment (demo)");
    const copy = (status: PaymentDetail["payment"]["status"]) =>
      describePayment({ status, provider: "DEMO", needsAttention: false, bookingIneligible: false, refundedAmountBdt: 0 });
    expect(copy("SUCCEEDED").message).toMatch(/No real money moved/);
    expect(copy("INITIATED").headline).toMatch(/Waiting for you to finish the simulated payment/);
    expect(copy("FAILED").message).toMatch(/no real money moved/);
    expect(copy("CANCELLED").message).toMatch(/no real money moved/);
    for (const status of ["SUCCEEDED", "INITIATED", "FAILED", "CANCELLED"] as const) expect(copy(status).message).not.toMatch(/bKash|provider confirmed/);
  });

  it("marks a demo payment as simulated in the badge and in the detail page", () => {
    render(<PaymentBadge payment={payment().payment} />);
    expect(screen.getByText("Simulated")).toBeInTheDocument();
    expect(render(<PaymentBadge payment={{ ...payment().payment, provider: "BKASH" }} />).container).not.toHaveTextContent("Simulated");
  });

  it("detail shows 'Simulated — no money moves', the method label, and a way back to the demo page while waiting", () => {
    render(<Detail data={payment()} reload={vi.fn()} returned={false} />);
    expect(screen.getByText("Simulated payment", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/Simulated — no money moves/)).toBeInTheDocument();
    expect(screen.getByText("Simulated payment (demo)", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the demo payment page" })).toHaveAttribute("href", `/payments/demo/${REF}`);
  });

  it("no demo link once the simulated payment has finished, and no note for real payments", () => {
    const { unmount } = render(<Detail data={payment({ status: "SUCCEEDED", succeededAt: "2026-11-01T06:01:00Z" })} reload={vi.fn()} returned />);
    expect(screen.queryByRole("link", { name: "Open the demo payment page" })).not.toBeInTheDocument();
    expect(screen.getByText("Simulated payment completed")).toBeInTheDocument();
    unmount();
    render(<Detail data={payment({ provider: "BKASH", mode: "live", status: "SUCCEEDED" })} reload={vi.fn()} returned />);
    expect(screen.queryByText(/Simulated — no money moves/)).not.toBeInTheDocument();
  });
});

describe("checkout with the demo provider", () => {
  const detail = (): BookingDetail => ({
    booking: {
      id: "b1", status: "CONFIRMED", viewerRole: "CUSTOMER", category: { slug: "electrical", name: "Electrical Services" }, description: "x",
      serviceArea: "Dhaka", serviceAddress: "House 12", startAt: "2026-11-04T04:00:00.000Z", endAt: "2026-11-04T05:00:00.000Z", durationMinutes: 60,
      timezone: "Asia/Dhaka", worker: { displayName: "Rahim Uddin", slug: null },
      pricing: { model: "FIXED", unitPriceBdt: 500, agreedAmountBdt: 500, currency: "BDT" },
      confirmedAt: null, startWindowOpensAt: "2026-11-04T03:30:00.000Z", arrivedAt: null, startedAt: null, completionRequestedAt: null, completedAt: null, cancellation: null, createdAt: "2026-11-01T06:00:00.000Z",
    },
    actions: [], quotes: [], rescheduleRequests: [], dispute: null, events: [], review: { canReview: false, review: null }, chat: { state: "NOT_OPEN", reason: null },
    payment: { state: "UNPAID", canPay: true, amountBdt: 500, currency: "BDT", activeReference: null, payments: [] } as BookingDetail["payment"],
  });
  const demo: ProviderInfo[] = [{ provider: "DEMO", label: "Simulated payment (demo)", available: true, mode: "simulated", minAmountBdt: 1, maxAmountBdt: 500000 }];
  const assign = vi.fn();
  beforeEach(() => {
    Object.defineProperty(window, "location", { value: { assign, origin: "http://localhost:3000" }, writable: true });
  });

  it("offers only the simulated method, labelled as such, and no bKash", () => {
    render(<Checkout detail={detail()} providers={demo} />);
    expect(screen.getByRole("button", { name: "Pay ৳500 with Simulated payment (demo)" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: /bKash/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Simulated — no money moves/)).toBeInTheDocument();
    expect(screen.getByText(/simulated payment page on this site/)).toBeInTheDocument();
    expect(screen.queryByText(/leave this site to pay on the provider/)).not.toBeInTheDocument();
  });

  it("posts {provider: 'DEMO'} and follows the same-origin demo URL", async () => {
    api.mockResolvedValue({ payment: payment().payment, checkoutUrl: `http://localhost:3000/payments/demo/${REF}` });
    render(<Checkout detail={detail()} providers={demo} />);
    fireEvent.click(screen.getByRole("button", { name: /Pay ৳500/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith(`http://localhost:3000/payments/demo/${REF}`));
    expect(api).toHaveBeenCalledWith("/bookings/b1/payments", { method: "POST", body: { provider: "DEMO" }, headers: { "Idempotency-Key": expect.any(String) } });
  });

  it("refuses a demo checkout URL on another origin", async () => {
    api.mockResolvedValue({ payment: payment().payment, checkoutUrl: `http://evil.example/payments/demo/${REF}` });
    render(<Checkout detail={detail()} providers={demo} />);
    fireEvent.click(screen.getByRole("button", { name: /Pay ৳500/ }));
    await screen.findByText(/could not open the payment page safely/);
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("simulated payment page", () => {
  const outcomeCalls = () => api.mock.calls.filter((c) => String(c[0]).endsWith("/demo-outcome"));

  it("states clearly that it is simulated and shows the amount and booking from the server", async () => {
    api.mockResolvedValue(payment());
    render(<DemoCheckoutView reference={REF} />);
    expect(await screen.findByText(/Demo payment — no real money is charged\. This page stands in for bKash\./)).toBeInTheDocument();
    expect(screen.getByText("৳500", { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText(/Electrical Services with Rahim Uddin/).length).toBeGreaterThan(0);
    expect(api).toHaveBeenCalledWith(`/payments/${REF}`);
    expect(screen.getByRole("button", { name: "Simulate successful payment" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Simulate failed payment" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(outcomeCalls()).toHaveLength(0); // nothing happens on load
  });

  it.each([
    ["Simulate successful payment", "success"],
    ["Simulate failed payment", "failed"],
    ["Cancel", "cancelled"],
  ])("'%s' posts exactly {outcome: '%s'} and then opens the payment status", async (label, outcome) => {
    api.mockResolvedValueOnce(payment()).mockResolvedValueOnce(payment({ status: "SUCCEEDED" }));
    render(<DemoCheckoutView reference={REF} />);
    fireEvent.click(await screen.findByRole("button", { name: label }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/payments/${REF}?returned=1`));
    expect(outcomeCalls()).toEqual([[`/payments/${REF}/demo-outcome`, { method: "POST", body: { outcome } }]]);
  });

  it("a double click is one request, and every button is disabled meanwhile", async () => {
    let finish: (v: unknown) => void = () => {};
    api.mockResolvedValueOnce(payment()).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<DemoCheckoutView reference={REF} />);
    const button = await screen.findByRole("button", { name: "Simulate successful payment" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(outcomeCalls()).toHaveLength(1);
    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "true"));
    expect(screen.getByRole("button", { name: "Simulate failed payment" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getAllByRole("status").some((el) => /Applying/.test(el.textContent ?? ""))).toBe(true);
    finish(payment({ status: "SUCCEEDED" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledTimes(1));
    expect(outcomeCalls()).toHaveLength(1);
  });

  it("shows the server's message when the outcome is refused and lets the visitor try again", async () => {
    api.mockResolvedValueOnce(payment()).mockRejectedValueOnce(new ApiError(409, "This simulated payment is not waiting for an outcome.", {}, "NOT_AWAITING_OUTCOME"));
    render(<DemoCheckoutView reference={REF} />);
    fireEvent.click(await screen.findByRole("button", { name: "Simulate failed payment" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This simulated payment is not waiting for an outcome.");
    expect(router.replace).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Simulate failed payment" })).toBeEnabled());
  });

  it("offers no buttons for a payment that is not a demo payment", async () => {
    api.mockResolvedValue(payment({ provider: "BKASH", mode: "live" }));
    render(<DemoCheckoutView reference={REF} />);
    expect(await screen.findByText("This is not a demo payment")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Simulate/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See the payment" })).toHaveAttribute("href", `/payments/${REF}`);
  });

  it("offers no buttons once the simulated payment is no longer waiting", async () => {
    api.mockResolvedValue(payment({ status: "SUCCEEDED" }));
    render(<DemoCheckoutView reference={REF} />);
    expect(await screen.findByText("This simulated payment is not waiting for an outcome")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Simulate|Cancel/ })).not.toBeInTheDocument();
  });

  it("says so when the payment does not exist or belongs to someone else", async () => {
    api.mockRejectedValue(new ApiError(404, "Payment not found"));
    render(<DemoCheckoutView reference={REF} />);
    expect(await screen.findByText("Payment not found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Simulate/ })).not.toBeInTheDocument();
  });

  it("shows a loading state first", () => {
    api.mockReturnValue(new Promise(() => {}));
    render(<DemoCheckoutView reference={REF} />);
    expect(screen.getByLabelText("Loading payment")).toHaveAttribute("aria-busy", "true");
  });

  it("the route rejects anything that is not a payment reference", async () => {
    const inner = (reference: string) => {
      const root = DemoPaymentPage({ params: Promise.resolve({ reference }) }) as { props: { children: unknown } };
      // page > breadcrumbs + wrapper > Suspense > async Checkout
      const wrapper = (root.props.children as { props: { children: unknown } }[])[1]!;
      const suspense = wrapper.props.children as { props: { children: { type: (p: unknown) => Promise<unknown>; props: unknown } } };
      const { type, props } = suspense.props.children;
      return type(props);
    };
    await expect(inner("FIN1")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(inner("..%2Fadmin")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(inner(REF)).resolves.toBeTruthy();
  });
});
