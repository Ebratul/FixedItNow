import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantResponse } from "@/lib/assistant";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/assistant",
}));
const api = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => api(...a),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string, public fieldErrors: Record<string, string> = {}, public code?: string) { super(message); }
  },
}));
let available = true;
vi.mock("@/lib/use-api", () => ({
  useMe: () => ({ state: { status: "ready", data: {} }, reload: vi.fn() }),
  useApi: (path: string) =>
    path === "/ai/status"
      ? { state: { status: "ready", data: { available } }, reload: vi.fn() }
      : { state: { status: "ready", data: { categories: [{ slug: "plumbing", name: "Plumbing" }, { slug: "electrical", name: "Electrical Services" }] } }, reload: vi.fn() },
}));
vi.mock("@/components/professional/professional-card", () => ({
  ProfessionalCard: ({ pro }: { pro: { displayName: string; startingPriceBdt: number | null; rating: number | null } }) => (
    <article aria-label={pro.displayName}>
      {pro.displayName} · {pro.startingPriceBdt ?? "no price"} · {pro.rating ?? "no rating"}
    </article>
  ),
}));

import { ApiError } from "@/lib/api";
import { AssistantView } from "@/components/assistant/assistant-view";
import { assistantErrorMessage, directorySearchHref, intentChips, withoutField } from "@/lib/assistant";

const worker = (id: string, name: string) => ({
  id, slug: `s-${id}`, displayName: name, headline: null, primaryCategory: null, categories: [], serviceAreas: ["Sylhet"],
  experienceYears: 5, startingPriceBdt: 700, verification: "VERIFIED" as const, rating: null, reviewCount: 0, publishedAt: "2026-10-01T00:00:00Z",
});
const reply = (over: Partial<AssistantResponse> = {}): AssistantResponse => ({
  kind: "results", message: "I found 2 professionals matching your filters.", language: "en",
  intent: { category: "plumbing", location: "Sylhet" }, intentSources: { category: "inferred", location: "explicit" },
  clarification: null, recommendations: [], total: 0, relaxations: [], answer: null, notes: [], mode: "llm", ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  available = true;
});

const ask = (text: string) => {
  fireEvent.change(screen.getByLabelText(/describe what you need/i), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: /send/i }));
};

describe("assistant chat", () => {
  it("sends the message with the server-held intent and renders cards from the API only", async () => {
    api.mockResolvedValueOnce(reply({ recommendations: [{ rank: 1, matchedOn: ["CATEGORY", "LOCATION"], worker: worker("1", "Karim Mia") }], total: 4 }));
    render(<AssistantView />);
    ask("plumber in Sylhet");
    expect(await screen.findByLabelText("Karim Mia")).toHaveTextContent("Karim Mia · 700 · no rating");
    expect(api).toHaveBeenCalledWith("/ai/chat", { method: "POST", body: { message: "plumber in Sylhet", intent: {}, locale: "auto" } });
    expect(screen.getByText(/Matches your service, area/)).toBeInTheDocument();
    expect(screen.getByText(/come from each profile, not from the assistant/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /see all 4 matching professionals/i })).toHaveAttribute("href", "/workers?category=plumbing&location=Sylhet");
  });

  it("shows filter chips, marks interpreted ones, and removes one with a model-free search", async () => {
    api.mockResolvedValueOnce(reply());
    render(<AssistantView />);
    ask("pipe leak in sylhet");
    const aside = await screen.findByRole("complementary", { name: /your search/i });
    expect(within(aside).getByText("Plumbing")).toBeInTheDocument();
    expect(within(aside).getByText("understood")).toBeInTheDocument();
    api.mockResolvedValueOnce(reply({ intent: { location: "Sylhet" }, intentSources: {} }));
    fireEvent.click(within(aside).getByRole("button", { name: "Remove filter: Plumbing" }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(api.mock.calls[1]![1].body).toEqual({ message: "Update search", intent: { category: null, location: "Sylhet" }, action: "search" });
  });

  it("clarification options re-run the search deterministically", async () => {
    api.mockResolvedValueOnce(reply({
      kind: "clarification", message: "What kind of service do you need?", intent: {}, intentSources: {},
      clarification: { field: "category", question: "What kind of service do you need?", blocking: true, options: [{ value: "plumbing", label: "Plumbing" }] },
    }));
    render(<AssistantView />);
    ask("help at home");
    api.mockResolvedValueOnce(reply());
    fireEvent.click(await screen.findByRole("button", { name: "Plumbing" }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
    expect(api.mock.calls[1]![1].body).toMatchObject({ action: "search", intent: { category: "plumbing" } });
  });

  it("no-results offers only the relaxations the server computed", async () => {
    api.mockResolvedValueOnce(reply({
      kind: "no_results", message: "No published professional matches all of your filters right now.", total: 0,
      intent: { category: "plumbing", maxBudgetBdt: 100 }, relaxations: [{ drop: "max_budget_bdt", matchCount: 3 }],
    }));
    render(<AssistantView />);
    ask("cheap plumber");
    expect(await screen.findByRole("button", { name: "Remove budget limit (3 matches)" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /any area/i })).not.toBeInTheDocument();
  });

  it("answers carry links to their sources, or say that none exist", async () => {
    api.mockResolvedValueOnce(reply({
      kind: "answer", message: "You can cancel.", recommendations: [],
      answer: { text: "You can cancel.", grounded: true, sources: [{ id: "cancellation#cancelling", title: "Cancelling", url: "/bookings" }] },
    }));
    render(<AssistantView />);
    ask("can I cancel");
    expect(await screen.findByRole("link", { name: "Cancelling" })).toHaveAttribute("href", "/bookings");
    api.mockResolvedValueOnce(reply({ kind: "answer", message: "I won't guess.", answer: { text: "I won't guess.", grounded: false, sources: [] } }));
    ask("what percentage?");
    expect(await screen.findByText(/No source in the help content covers this/)).toBeInTheDocument();
  });

  it("renders model text as plain text, never as HTML", async () => {
    api.mockResolvedValueOnce(reply({ kind: "out_of_scope", message: "<img src=x onerror=alert(1)><b>bold</b>" }));
    const { container } = render(<AssistantView />);
    ask("x");
    expect(await screen.findByText(/<img src=x/)).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
  });

  it("notes explain the limits instead of implying availability or bookings", async () => {
    api.mockResolvedValueOnce(reply({ notes: ["AVAILABILITY_NOT_CHECKED", "BOOKING_NOT_SUPPORTED", "SIMPLE_MODE"], intent: { category: "plumbing", preferredTime: "tomorrow evening" } }));
    render(<AssistantView />);
    ask("book a plumber tomorrow evening");
    expect(await screen.findByText(/Search can't check availability/)).toBeInTheDocument();
    expect(screen.getByText(/can't book, cancel or pay for you/)).toBeInTheDocument();
    expect(screen.getByText(/AI model wasn't used/)).toBeInTheDocument();
    expect(screen.getByText(/not used for filtering/)).toBeInTheDocument();
  });

  it("a failed AI call shows a clear error, a retry, and the normal search with the same filters", async () => {
    api.mockResolvedValueOnce(reply());
    render(<AssistantView />);
    ask("plumber in sylhet");
    await screen.findByRole("complementary");
    api.mockRejectedValueOnce(new ApiError(502, "Something went wrong on our side.", {}, "AI_UNAVAILABLE"));
    ask("under 1500");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The assistant is unavailable right now.");
    expect(within(alert).getByRole("link", { name: /normal search/i })).toHaveAttribute("href", "/workers?category=plumbing&location=Sylhet");
    api.mockResolvedValueOnce(reply({ message: "Recovered." }));
    fireEvent.click(within(alert).getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Recovered.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("says plainly when the assistant is not configured, and points to the normal search", () => {
    available = false;
    render(<AssistantView />);
    expect(screen.getByRole("heading", { name: /isn't available yet/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /search professionals/i })).toHaveAttribute("href", "/workers");
    expect(screen.queryByLabelText(/describe what you need/i)).not.toBeInTheDocument();
  });

  it("does not send an empty message", () => {
    render(<AssistantView />);
    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
    expect(api).not.toHaveBeenCalled();
  });
});

describe("assistant helpers", () => {
  it("directorySearchHref uses only valid filter values", () => {
    expect(directorySearchHref({})).toBe("/workers");
    expect(directorySearchHref({ category: "plumbing", location: "Sylhet", maxBudgetBdt: 1500, minExperienceYears: 3 })).toBe(
      "/workers?category=plumbing&location=Sylhet&maxPrice=1500&minExperience=3",
    );
    expect(directorySearchHref({ location: "Atlantis" as never })).toBe("/workers");
  });

  it("builds chips and removes a field without touching the others", () => {
    const intent = { category: "plumbing", location: "Sylhet" as const, maxBudgetBdt: 1500 };
    expect(intentChips(intent, {}, { plumbing: "Plumbing" }).map((c) => c.label)).toEqual(["Plumbing", "Sylhet", "Up to ৳1,500"]);
    expect(withoutField(intent, "maxBudgetBdt")).toEqual({ ...intent, maxBudgetBdt: null });
  });

  it("maps error codes to safe messages and never echoes server text for AI errors", () => {
    expect(assistantErrorMessage(new ApiError(503, "secret internal text", {}, "AI_NOT_CONFIGURED"))).toMatch(/isn't set up/);
    expect(assistantErrorMessage(new ApiError(429, "x", {}, "AI_RATE_LIMITED"))).toMatch(/too quickly/);
    expect(assistantErrorMessage(new ApiError(504, "stack trace", {}, "AI_TIMEOUT"))).not.toMatch(/stack/);
    expect(assistantErrorMessage(new Error("boom"))).toBe("Something went wrong. Please try again.");
  });
});
