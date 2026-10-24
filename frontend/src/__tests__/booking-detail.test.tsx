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
    confirmedAt: null, completedAt: null, cancellation: null, createdAt: "2026-11-01T06:00:00.000Z", ...over,
  },
  actions: [], quotes: [], rescheduleRequests: [], dispute: null, events: [],
  ...rest,
});

beforeEach(() => { vi.clearAllMocks(); });
const names = () => screen.queryAllByRole("button").map((b) => b.textContent);

describe("BookingDetailView", () => {
  it("shows only the actions the server says are allowed", () => {
    detail = base({}, { actions: ["cancel", "reschedule"] });
    render(<BookingDetailView id="b1" />);
    expect(names()).toEqual(expect.arrayContaining(["Cancel booking", "Request a different time"]));
    for (const forbidden of ["Accept request", "Start job", "Mark job finished", "Confirm work is complete", "Report a problem"]) {
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
});
