import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/workers/rahim/book",
  useSearchParams: () => new URLSearchParams(),
}));
let session: { user: { id: string } } | null = { user: { id: "u1" } };
vi.mock("@/lib/auth-client", () => ({ authClient: { useSession: () => ({ data: session, isPending: false }) } }));
const api = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => api(...a),
  ApiError: class ApiError extends Error { constructor(public status: number, message: string, public fieldErrors = {}, public code?: string) { super(message); } },
}));
vi.mock("@/components/bookings/slot-picker", () => ({
  SlotPicker: ({ onChange }: { onChange: (iso: string) => void }) => (
    <button type="button" onClick={() => onChange("2026-11-04T04:00:00.000Z")}>pick-10am</button>
  ),
}));
vi.mock("@/lib/use-api", () => ({
  useMe: () => ({ state: { status: "ready", data: { user: { name: "T" }, worker: { started: true }, customer: { onboarded: true } } }, reload: vi.fn() }),
  useApi: () => ({ state: { status: "loading" }, reload: vi.fn() }),
}));

import { BookingForm, type BookableWorker } from "@/components/bookings/booking-form";
import { QuoteForm } from "@/components/bookings/quote-panel";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const worker: BookableWorker = {
  id: "0192a000-0000-7000-8000-000000000001",
  slug: "rahim-1a2b3c4d",
  displayName: "Rahim Uddin",
  serviceAreas: ["Dhaka"],
  services: [{ category: { slug: "electrical", name: "Electrical Services" }, pricingModel: "FIXED", basePriceBdt: 500 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  session = { user: { id: "u1" } };
});

describe("ConfirmDialog", () => {
  it("requires a reason when asked, runs the action, and closes only on success", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<ConfirmDialog open title="Cancel?" confirmLabel="Cancel booking" reason="required" onConfirm={onConfirm} onClose={onClose}>Sure?</ConfirmDialog>);
    const confirm = screen.getByRole("button", { name: "Cancel booking" });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Plans changed a lot" } });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("Plans changed a lot"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("stays open and shows the server's message when the action fails", async () => {
    const onClose = vi.fn();
    render(<ConfirmDialog open title="Accept?" confirmLabel="Accept" onConfirm={() => Promise.reject(new Error("That time slot is no longer available"))} onClose={onClose}>Body</ConfirmDialog>);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(await screen.findByText("That time slot is no longer available")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not double-submit while pending", async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<ConfirmDialog open title="Go?" confirmLabel="Go" onConfirm={onConfirm} onClose={vi.fn()}>Body</ConfirmDialog>);
    const go = screen.getByRole("button", { name: "Go" });
    fireEvent.click(go);
    fireEvent.click(go);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    resolve();
  });
});

describe("QuoteForm", () => {
  it("previews the total, validates, and never sends a total to the server", async () => {
    api.mockResolvedValue({ booking: {}, quotes: [] });
    const onDone = vi.fn();
    render(<QuoteForm bookingId="b1" revising={false} onDone={onDone} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Send quote" }));
    expect(await screen.findByText("Enter the labour cost in whole taka")).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Labour (৳)"), { target: { value: "800" } });
    fireEvent.change(screen.getByLabelText("Materials (৳)"), { target: { value: "300" } });
    fireEvent.change(screen.getByLabelText("Other (৳)"), { target: { value: "50" } });
    expect(screen.getByText("৳1,150")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("What does this price include?"), { target: { value: "Gas refill and filter cleaning." } });
    fireEvent.click(screen.getByRole("button", { name: "Send quote" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    const [path, init] = api.mock.calls[0];
    expect(path).toBe("/bookings/b1/quotes");
    expect(Object.keys(init.body).sort()).toEqual(["description", "laborBdt", "materialsBdt", "otherBdt", "terms", "validForHours"]);
    expect(init.body).not.toHaveProperty("totalBdt");
  });

  it("rejects fractional or negative amounts client-side", async () => {
    render(<QuoteForm bookingId="b1" revising onDone={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Labour (৳)"), { target: { value: "99.5" } });
    fireEvent.change(screen.getByLabelText("What does this price include?"), { target: { value: "Something long enough." } });
    fireEvent.click(screen.getByRole("button", { name: "Send revised quote" }));
    expect(await screen.findByText("Enter the labour cost in whole taka")).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });
});

describe("BookingForm", () => {
  const fillDetails = () => {
    fireEvent.change(screen.getByLabelText("What needs to be done?"), { target: { value: "The ceiling fan is making noise." } });
    fireEvent.change(screen.getByLabelText("Address"), { target: { value: "House 12, Road 5, Dhanmondi" } });
  };

  it("asks a signed-out visitor to log in and come back here", () => {
    session = null;
    render(<BookingForm worker={worker} />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?next=%2Fworkers%2Frahim-1a2b3c4d%2Fbook");
    expect(screen.queryByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  });

  it("validates each step before moving on", async () => {
    render(<BookingForm worker={worker} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Describe the work in at least 10 characters")).toBeInTheDocument();
    expect(screen.getByText("Enter the address (at least 5 characters)")).toBeInTheDocument();
    fillDetails();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Review" }));
    expect(await screen.findByText("Choose a start time")).toBeInTheDocument();
  });

  it("only navigates after the server confirms the request, sending a stable idempotency key", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ booking: { id: "b-123" } }), { status: 201 }));
    render(<BookingForm worker={worker} />);
    fillDetails();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByText("pick-10am"));
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(await screen.findByText("This is a request, not a confirmed booking")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/bookings/b-123?requested=1"));
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("/api/v1/bookings");
    expect((init!.headers as Record<string, string>)["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(init!.body as string)).toMatchObject({ workerId: worker.id, categorySlug: "electrical", durationMinutes: 60, startAt: "2026-11-04T04:00:00.000Z" });
    expect(JSON.parse(init!.body as string)).not.toHaveProperty("customerId");
    fetchSpy.mockRestore();
  });

  it("stays on the form and returns to time selection when the slot was just taken", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ message: "That time slot is no longer available", code: "SLOT_UNAVAILABLE" }), { status: 409 }));
    render(<BookingForm worker={worker} />);
    fillDetails();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByText("pick-10am"));
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    fireEvent.click(await screen.findByRole("button", { name: "Send request" }));
    expect(await screen.findByText("That time slot is no longer available")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText("pick-10am")).toBeInTheDocument(); // back on the time step
    fetchSpy.mockRestore();
  });
});
