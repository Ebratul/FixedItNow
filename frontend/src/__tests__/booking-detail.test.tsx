import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingDetail } from "@/lib/booking-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/bookings/b1",
  useSearchParams: () => new URLSearchParams(),
}));
let detail: BookingDetail;
vi.mock("@/lib/use-api", () => ({
  useMe: () => ({ state: { status: "ready", data: { user: { name: "T" }, worker: { started: true }, customer: { onboarded: true } } }, reload: vi.fn() }),
  useApi: () => ({ state: { status: "ready", data: detail }, reload: vi.fn() }),
}));
const api = vi.fn();
vi.mock("@/lib/api", () => ({ api: (...a: unknown[]) => api(...a), ApiError: class extends Error {} }));

import { BookingDetailView } from "@/components/bookings/booking-detail";

const base = (over: Partial<BookingDetail["booking"]> = {}, rest: Partial<BookingDetail> = {}): BookingDetail => ({
  booking: {
    id: "b1", status: "CONFIRMED", viewerRole: "CUSTOMER", category: { slug: "electrical", name: "Electrical Services" },
    description: "Fan noise", serviceArea: "Dhaka", serviceAddress: "House 12, Road 5", startAt: "2026-11-04T04:00:00.000Z", endAt: "2026-11-04T05:00:00.000Z",
    durationMinutes: 60, timezone: "Asia/Dhaka", worker: { displayName: "Rahim Uddin", slug: "rahim-1a2b" },
    pricing: { model: "FIXED", unitPriceBdt: 500, agreedAmountBdt: 500, currency: "BDT" },
    confirmedAt: null, startWindowOpensAt: "2026-11-04T03:30:00.000Z", arrivedAt: null, startedAt: null, completionRequestedAt: null, completedAt: null, cancellation: null, createdAt: "2026-11-01T06:00:00.000Z", ...over,
  },
  actions: [], quotes: [], rescheduleRequests: [], dispute: null, events: [],
  chat: { state: "NOT_OPEN", reason: null },
  payment: { state: "UNPAID", canPay: false, amountBdt: 500, currency: "BDT", activeReference: null, payments: [] },
  review: { canReview: false, review: null },
  ...rest,
});

beforeEach(() => { vi.clearAllMocks(); });
const names = () => screen.queryAllByRole("button").map((b) => b.textContent);

describe("BookingDetailView", () => {
  it("shows only the actions the server says are allowed", () => {
    detail = base({}, { actions: ["cancel", "reschedule"] });
    render(<BookingDetailView id="b1" />);
    expect(names()).toEqual(expect.arrayContaining(["Cancel booking", "Request a different time"]));
    for (const forbidden of ["Accept request", "I have arrived", "Start job", "Mark job finished", "Work is finished: pay now", "Report a problem"]) {
      expect(names()).not.toContain(forbidden);
    }
  });

  it("shows no action section when nothing is permitted (e.g. a cancelled booking)", () => {
    detail = base({ status: "CANCELLED", cancellation: { at: "2026-11-02T06:00:00Z", reason: "Plans changed", by: "CUSTOMER" } });
    render(<BookingDetailView id="b1" />);
    expect(screen.queryByText("What you can do")).not.toBeInTheDocument();
    expect(screen.getByText(/by the customer: “Plans changed”/)).toBeInTheDocument();
  });

  it("explains that the street address stays private from a worker until confirmation", () => {
    detail = base({ status: "REQUESTED", viewerRole: "WORKER", serviceAddress: null, customer: { name: "Karim" }, pricing: { model: "FIXED", unitPriceBdt: 500, agreedAmountBdt: null, currency: "BDT" } }, { actions: ["accept", "decline"] });
    render(<BookingDetailView id="b1" />);
    expect(screen.getByText(/full address is shared once the booking is confirmed/)).toBeInTheDocument();
    expect(screen.queryByText(/House 12/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept request" })).toBeInTheDocument();
  });

  it("confirming an action calls the matching endpoint and renders the server's new state", async () => {
    detail = base({ status: "REQUESTED", viewerRole: "WORKER", customer: { name: "Karim" }, pricing: { model: "FIXED", unitPriceBdt: 500, agreedAmountBdt: null, currency: "BDT" } }, { actions: ["accept", "decline"] });
    api.mockResolvedValue(base({ status: "CONFIRMED", viewerRole: "WORKER", customer: { name: "Karim" } }, { actions: ["cancel"] }));
    render(<BookingDetailView id="b1" />);
    fireEvent.click(screen.getByRole("button", { name: "Accept request" }));
    fireEvent.click(await screen.findByRole("button", { name: "Accept and confirm" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/bookings/b1/accept", { method: "POST", body: {} }));
    expect(await screen.findByText("Booking confirmed. The time is now reserved.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept request" })).not.toBeInTheDocument();
  });

  it("offers quote actions to the customer only for a live pending quote, and sends the amount they saw", async () => {
    detail = base({ status: "QUOTED", pricing: { model: "QUOTE", unitPriceBdt: null, agreedAmountBdt: null, currency: "BDT" } }, {
      actions: ["cancel"],
      quotes: [{ id: "q1", status: "PENDING", laborBdt: 800, materialsBdt: 300, otherBdt: 50, totalBdt: 1150, currency: "BDT", description: "Gas refill.", terms: null, estimatedDurationMinutes: null, expiresAt: "2026-11-03T06:00:00Z", createdAt: "2026-11-01T07:00:00Z", decidedAt: null, actions: ["accept", "reject"] }],
    });
    api.mockResolvedValue(base({ status: "CONFIRMED" }));
    render(<BookingDetailView id="b1" />);
    fireEvent.click(screen.getByRole("button", { name: "Accept quote" }));
    fireEvent.click(await screen.findByRole("button", { name: "Accept and confirm" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/bookings/b1/quotes/q1/accept", { method: "POST", body: { expectedTotalBdt: 1150 } }));
  });

  it("withdrawing a quote twice in quick succession sends one request (the second click used to show a false 409)", async () => {
    detail = base({ status: "QUOTED", viewerRole: "WORKER", customer: { name: "Karim" }, pricing: { model: "QUOTE", unitPriceBdt: null, agreedAmountBdt: null, currency: "BDT" } }, {
      actions: [],
      quotes: [{ id: "q1", status: "PENDING", laborBdt: 800, materialsBdt: 300, otherBdt: 50, totalBdt: 1150, currency: "BDT", description: "Gas refill.", terms: null, estimatedDurationMinutes: null, expiresAt: "2026-11-03T06:00:00Z", createdAt: "2026-11-01T07:00:00Z", decidedAt: null, actions: ["withdraw"] }],
    });
    let finish!: (v: unknown) => void;
    api.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    render(<BookingDetailView id="b1" />);
    const button = screen.getByRole("button", { name: "Withdraw" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(api).toHaveBeenCalledTimes(1);
    finish(base({ status: "REQUESTED", viewerRole: "WORKER", customer: { name: "Karim" } }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(api).toHaveBeenCalledTimes(1);
  });

  it("renders customer-written text inertly (no HTML injection)", () => {
    detail = base({ description: "<img src=x onerror=alert(1)> and <script>alert(2)</script>", viewerRole: "WORKER", customer: { name: "<b>Karim</b>" } });
    render(<BookingDetailView id="b1" />);
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("img[src='x']")).toBeNull();
    expect(screen.getByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
    expect(screen.getByText("for <b>Karim</b>")).toBeInTheDocument();
  });

  it("surfaces a failed action's message instead of failing silently", async () => {
    detail = base({}, { actions: ["cancel"] });
    api.mockRejectedValue(new Error("This booking just changed. Refresh the page and try again."));
    render(<BookingDetailView id="b1" />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
    fireEvent.change(await screen.findByLabelText("Reason"), { target: { value: "Plans changed a lot" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Cancel booking" }).at(-1)!);
    expect(await screen.findByText("This booking just changed. Refresh the page and try again.")).toBeInTheDocument();
  });

  describe("arrival, payment due and chat", () => {
    const worker = { viewerRole: "WORKER" as const, customer: { name: "Karim" } };

    it("offers 'I have arrived' only when the server allows it, sends the request, and labels arrival as self-reported", async () => {
      detail = base({ ...worker, status: "CONFIRMED", confirmedAt: "2026-11-02T06:00:00Z" }, { actions: ["arrive", "start", "cancel"] });
      api.mockResolvedValue(base({ ...worker, status: "CONFIRMED", confirmedAt: "2026-11-02T06:00:00Z", arrivedAt: "2026-11-04T03:50:00Z" }, { actions: ["start", "cancel"] }));
      render(<BookingDetailView id="b1" />);
      fireEvent.click(screen.getByRole("button", { name: "I have arrived" }));
      expect(screen.getByText(/FixedItNow does not check your location/)).toBeInTheDocument();
      fireEvent.click(await screen.findByRole("button", { name: "Yes, I have arrived" }));
      await waitFor(() => expect(api).toHaveBeenCalledWith("/bookings/b1/arrive", { method: "POST", body: {} }));
      expect(await screen.findByText(/reported by the professional \(location is not verified\)/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "I have arrived" })).not.toBeInTheDocument();
    });

    it("tells the professional when arrival and start open, instead of silently showing no button, and marks only the NEXT step", () => {
      detail = base({ ...worker, status: "CONFIRMED", confirmedAt: "2026-11-02T06:00:00Z" }, { actions: ["cancel", "reschedule"] });
      render(<BookingDetailView id="b1" />);
      expect(screen.getByText("Arrival and start open shortly before the appointment")).toBeInTheDocument();
      expect(screen.getByText(/30 minutes before the scheduled time/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "I have arrived" })).not.toBeInTheDocument();
      // "Professional arrived" is merely the next step, labelled as such, and is not ticked
      expect(screen.getByText("Next")).toBeInTheDocument();
      expect(screen.queryByText("✓ Professional arrived")).not.toBeInTheDocument();
    });

    it("shows the customer 'payment due' with a Pay now link once the work is finished, and no confirm-completion shortcut", () => {
      detail = base({ status: "COMPLETION_PENDING", confirmedAt: "2026-11-02T06:00:00Z", completionRequestedAt: "2026-11-04T05:00:00Z" }, {
        actions: ["open_dispute"],
        payment: { state: "UNPAID", canPay: true, amountBdt: 500, currency: "BDT", activeReference: null, payments: [] },
      });
      render(<BookingDetailView id="b1" />);
      expect(screen.getByText("The work is finished: payment is due")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Payment due" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Pay now" })).toHaveAttribute("href", "/bookings/b1/pay");
      expect(screen.queryByRole("button", { name: /confirm work is complete/i })).not.toBeInTheDocument();
      expect(screen.getByText("Awaiting payment")).toBeInTheDocument();
    });

    it("lets the customer declare the work finished early; it asks first, then calls the endpoint and shows payment due", async () => {
      detail = base({ status: "CONFIRMED", confirmedAt: "2026-11-02T06:00:00Z" }, { actions: ["mark_finished", "cancel"] });
      api.mockResolvedValue(base({ status: "COMPLETION_PENDING", confirmedAt: "2026-11-02T06:00:00Z", completionRequestedAt: "2026-11-03T05:00:00Z" }, {
        actions: ["open_dispute"], payment: { state: "UNPAID", canPay: true, amountBdt: 500, currency: "BDT", activeReference: null, payments: [] },
      }));
      render(<BookingDetailView id="b1" />);
      fireEvent.click(screen.getByRole("button", { name: "Work is finished: pay now" }));
      expect(api).not.toHaveBeenCalled(); // asks first
      expect(screen.getByText(/Only continue if the job is really done/)).toBeInTheDocument();
      fireEvent.click(await screen.findByRole("button", { name: "Yes, the work is finished" }));
      await waitFor(() => expect(api).toHaveBeenCalledWith("/bookings/b1/mark-finished", { method: "POST", body: {} }));
      expect(await screen.findByRole("link", { name: "Pay now" })).toHaveAttribute("href", "/bookings/b1/pay");
      expect(screen.queryByRole("button", { name: "Work is finished: pay now" })).not.toBeInTheDocument();
    });

    it("tells the professional the booking waits for the customer's verified payment", () => {
      detail = base({ ...worker, status: "COMPLETION_PENDING", confirmedAt: "2026-11-02T06:00:00Z" }, { payment: { state: "UNPAID" } });
      render(<BookingDetailView id="b1" />);
      expect(screen.getByText(/completes after the customer.s payment is verified/)).toBeInTheDocument();
    });

    it("offers no chat before the booking is accepted, only a note while it is a request", () => {
      detail = base({ status: "REQUESTED" }, { chat: { state: "NOT_OPEN", reason: "Messaging opens once the professional accepts the booking." } });
      render(<BookingDetailView id="b1" />);
      expect(screen.queryByRole("button", { name: /^Chat with/ })).not.toBeInTheDocument();
      expect(screen.getByText("Messaging opens once the professional accepts the booking.")).toBeInTheDocument();
    });

    it("shows a chat button after acceptance and no chat section at all for a declined request", () => {
      detail = base({ status: "CONFIRMED", confirmedAt: "2026-11-02T06:00:00Z" }, { chat: { state: "OPEN", reason: null } });
      const { unmount } = render(<BookingDetailView id="b1" />);
      expect(screen.getByRole("button", { name: "Chat with Rahim Uddin" })).toBeInTheDocument();
      unmount();
      detail = base({ status: "DECLINED" }, { chat: { state: "NOT_OPEN", reason: null } });
      render(<BookingDetailView id="b1" />);
      expect(screen.queryByText("Messages")).not.toBeInTheDocument();
    });
  });

  describe("payment section", () => {
    it("offers Pay now only when the server says the customer can pay, and says 'paid' only for a verified payment", () => {
      detail = base({}, { payment: { state: "UNPAID", canPay: true, amountBdt: 500, currency: "BDT", activeReference: null, payments: [] } });
      const { unmount } = render(<BookingDetailView id="b1" />);
      expect(screen.getByRole("link", { name: "Pay now" })).toHaveAttribute("href", "/bookings/b1/pay");
      expect(screen.getAllByText(/not paid yet/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/paid and verified/)).not.toBeInTheDocument();
      unmount();

      detail = base({}, { payment: { state: "IN_PROGRESS", canPay: false, amountBdt: 500, currency: "BDT", activeReference: "FIN1", payments: [] } });
      const second = render(<BookingDetailView id="b1" />);
      expect(screen.queryByRole("link", { name: "Pay now" })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Check payment status" })).toHaveAttribute("href", "/payments/FIN1");
      second.unmount();

      detail = base({}, { payment: { state: "PAID", canPay: false, amountBdt: 500, currency: "BDT", activeReference: null, payments: [] } });
      render(<BookingDetailView id="b1" />);
      expect(screen.getAllByText(/paid and verified/).length).toBeGreaterThan(0);
    });

    it("shows the professional only whether a verified payment exists, with no pay button", () => {
      detail = base({ viewerRole: "WORKER", customer: { name: "Karim" } }, { payment: { state: "PAID" } });
      render(<BookingDetailView id="b1" />);
      expect(screen.getByText(/the customer's payment has been verified/)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Pay now" })).not.toBeInTheDocument();
      expect(screen.queryByText("Payment")).not.toBeInTheDocument();
    });

    it("warns that cancelling a paid booking does not refund automatically", () => {
      detail = base({}, { actions: ["cancel"], payment: { state: "PAID", canPay: false, amountBdt: 500, currency: "BDT", activeReference: null, payments: [] } });
      render(<BookingDetailView id="b1" />);
      fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
      expect(screen.getByText(/does NOT refund it automatically/)).toBeInTheDocument();
    });
  });
});
