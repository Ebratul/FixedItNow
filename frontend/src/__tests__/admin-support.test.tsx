import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => "/admin/support",
}));

const api = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => api(...a),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string, public fieldErrors: Record<string, string> = {}, public code?: string) { super(message); }
  },
}));

let me: unknown;
const data: Record<string, unknown> = {};
const paths: string[] = [];
vi.mock("@/lib/use-api", () => ({
  useMe: () => ({ state: { status: "ready", data: me }, reload: vi.fn() }),
  useApi: (path: string) => {
    paths.push(path);
    // the longest registered prefix wins, so "/x/1" can be told apart from "/x"
    const key = Object.keys(data).filter((k) => path.startsWith(k)).sort((a, b) => b.length - a.length)[0];
    const value = key ? (data[key] as { __error?: string }) : undefined;
    const state = !key ? { status: "loading" } : value?.__error ? { status: "error", message: value.__error } : { status: "ready", data: value };
    return { state, reload: vi.fn(), refresh: vi.fn(), stale: false };
  },
}));

import { ApiError } from "@/lib/api";
import { AiAdminView } from "@/components/admin/ai/ai-view";
import { ModerationView } from "@/components/admin/moderation-view";
import { AdminProvider } from "@/components/admin/shell/admin-context";
import { AdminTicketDetailView } from "@/components/admin/support/ticket-detail";
import { TicketQueue } from "@/components/admin/support/ticket-queue";
import { describeIntegration, formatUptime, SystemView } from "@/components/admin/system/system-view";
import { NewRequestForm } from "@/components/support/new-request-form";
import { SupportList } from "@/components/support/support-list";
import { SupportTicketView } from "@/components/support/ticket-view";

const person = (permissions: string[] | null, over: object = {}) => ({
  user: { id: "me1", name: "Maya", email: "maya@x.test", emailVerified: true, image: null },
  isAdmin: permissions !== null,
  admin: permissions ? { role: { key: "support", name: "Support" }, permissions } : null,
  customer: { onboarded: true },
  worker: { started: false, approved: false },
  ...over,
});
const asAdmin = (ui: ReactElement, permissions: string[]) => {
  me = person(permissions);
  return render(<AdminProvider me={me as never}>{ui}</AdminProvider>);
};
const page = { page: 1, pageSize: 20, total: 1, totalPages: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  api.mockReset();
  paths.length = 0;
  for (const k of Object.keys(data)) delete data[k];
});

// ---------------------------------------------------------------- admin queue
const row = (over: object = {}) => ({
  id: "t1", number: 12, category: "WORKER_COMPLAINT", priority: "URGENT", subject: "Plumber never came", status: "OPEN", bookingId: "b1",
  createdAt: "2026-11-01T06:00:00Z", lastMessageAt: "2026-11-02T06:00:00Z", requester: { id: "u9", name: "Asha Rahman" }, assignee: null, messageCount: 2, ...over,
});

describe("admin ticket queue", () => {
  it("lists real rows with requester NAME, priority, status and counts per status", () => {
    data["/admin/support/tickets"] = { ...page, tickets: [row(), row({ id: "t2", number: 13, subject: "Refund?", priority: "LOW", status: "IN_PROGRESS", assignee: { id: "s1", name: "Rafi" } })], statusCounts: { OPEN: 4, IN_PROGRESS: 1 }, total: 2 };
    asAdmin(<TicketQueue />, ["support.read"]);
    const table = screen.getByRole("table", { name: "Support tickets" });
    expect(within(table).getByRole("link", { name: "Plumber never came" })).toHaveAttribute("href", "/admin/support/t1");
    expect(within(table).getAllByText("Asha Rahman").length).toBeGreaterThan(0);
    expect(within(table).getByText("Urgent")).toBeInTheDocument();
    expect(within(table).getByText("Unassigned")).toBeInTheDocument();
    expect(within(table).getByText("Rafi")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Open \(4\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^In progress \(1\)/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^All \(5\)/ })).toBeInTheDocument();
  });

  it("changes the query for status tabs and the assignee filter and goes back to page 1", () => {
    data["/admin/support/tickets"] = { ...page, tickets: [row()], statusCounts: { OPEN: 1 } };
    asAdmin(<TicketQueue />, ["support.read"]);
    fireEvent.click(screen.getByRole("button", { name: /^Open/ }));
    expect(paths.at(-1)).toContain("status=OPEN");
    fireEvent.change(screen.getByLabelText("Assignee"), { target: { value: "unassigned" } });
    expect(paths.at(-1)).toContain("assignee=unassigned");
    expect(paths.at(-1)).toContain("status=OPEN");
    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "HIGH" } });
    expect(paths.at(-1)).toContain("priority=HIGH");
  });

  it("tells the truth when nothing matches, and when the API fails", () => {
    data["/admin/support/tickets"] = { ...page, total: 0, totalPages: 0, tickets: [], statusCounts: {} };
    const { unmount } = asAdmin(<TicketQueue />, ["support.read"]);
    expect(screen.getByText("No tickets found")).toBeInTheDocument();
    expect(screen.getByText(/Nobody has raised a support request yet/)).toBeInTheDocument();
    unmount();
    data["/admin/support/tickets"] = { __error: "Something went wrong on our side. Please try again." };
    asAdmin(<TicketQueue />, ["support.read"]);
    expect(screen.getByText(/Something went wrong on our side/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("does not call the API for a role without support.read", () => {
    asAdmin(<TicketQueue />, ["users.read"]);
    expect(screen.getByText("Your role cannot open this page")).toBeInTheDocument();
    expect(paths).toHaveLength(0);
  });
});

// ---------------------------------------------------------------- admin detail
const ticket = (over: object = {}) => ({
  id: "t1", number: 12, category: "WORKER_COMPLAINT", priority: "NORMAL", subject: "Plumber never came", status: "OPEN", bookingId: "b1", resolution: null, resolvedAt: null,
  createdAt: "2026-11-01T06:00:00Z", updatedAt: "2026-11-02T06:00:00Z", lastMessageAt: "2026-11-02T06:00:00Z",
  requester: { id: "u9", name: "Asha Rahman" }, assignee: null, isOwn: false, allowedNext: ["IN_PROGRESS", "WAITING_FOR_USER", "RESOLVED", "CLOSED"],
  booking: { id: "b1", status: "CONFIRMED", service: "Plumbing", customer: { id: "u9", name: "Asha Rahman" }, worker: { id: "w1", displayName: "Karim the plumber" } },
  messages: [
    { id: "m1", from: "requester", author: "Asha Rahman", body: "He did not show up <b>twice</b>", internal: false, createdAt: "2026-11-01T06:00:00Z" },
    { id: "m2", from: "staff", author: "Rafi", body: "Checking with him", internal: true, createdAt: "2026-11-01T07:00:00Z" },
    { id: "m3", from: "staff", author: "Rafi", body: "We are looking into it", internal: false, createdAt: "2026-11-01T08:00:00Z" },
  ],
  ...over,
});
const detail = (over: object = {}) => {
  data["/admin/support/tickets/t1"] = { ticket: ticket(over) };
  data["/admin/support/assignees"] = { staff: [{ id: "me1", name: "Maya" }, { id: "s1", name: "Rafi" }] };
};
const MANAGE = ["support.read", "support.manage"];

describe("admin ticket detail", () => {
  it("shows the conversation as plain text, labels internal notes, and gives booking context", () => {
    detail();
    const { container } = asAdmin(<AdminTicketDetailView id="t1" />, MANAGE);
    expect(screen.getByText(/He did not show up <b>twice<\/b>/)).toBeInTheDocument();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getAllByText("Internal note: not shown to the user")).toHaveLength(1);
    expect(screen.getByText("Karim the plumber")).toBeInTheDocument();
    expect(screen.getByText("Plumbing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the booking" })).toHaveAttribute("href", "/admin/bookings/b1");
  });

  it("sends a visible reply, then an internal note, with the checkbox deciding", async () => {
    detail();
    api.mockResolvedValue({ ticket: ticket() });
    asAdmin(<AdminTicketDetailView id="t1" />, MANAGE);
    fireEvent.change(screen.getByLabelText("Reply to the requester"), { target: { value: " Sorry about this " } });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/support/tickets/t1/messages", { method: "POST", body: { body: "Sorry about this", internal: false } }));
    expect(await screen.findByText(/Reply sent/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Internal note (not shown to the user)"));
    fireEvent.change(screen.getByLabelText("Internal note", { selector: "textarea" }), { target: { value: "Call the worker" } });
    fireEvent.click(screen.getByRole("button", { name: "Add internal note" }));
    await waitFor(() => expect(api).toHaveBeenLastCalledWith("/admin/support/tickets/t1/messages", { method: "POST", body: { body: "Call the worker", internal: true } }));
  });

  it("offers only allowedNext, and resolving needs a resolution text that is sent", async () => {
    detail({ allowedNext: ["OPEN", "CLOSED"], status: "RESOLVED" });
    api.mockResolvedValue({ ticket: ticket() });
    const { unmount } = asAdmin(<AdminTicketDetailView id="t1" />, MANAGE);
    const select = screen.getByLabelText(/^Status/);
    expect(within(select).getAllByRole("option").map((o) => o.textContent)).toEqual(["Choose a new status", "Open", "Closed"]);
    unmount();

    detail();
    asAdmin(<AdminTicketDetailView id="t1" />, MANAGE);
    fireEvent.change(screen.getByLabelText(/^Status/), { target: { value: "RESOLVED" } });
    const apply = screen.getByRole("button", { name: "Change status" });
    expect(apply).toBeDisabled(); // resolution required
    fireEvent.change(screen.getByLabelText(/^Resolution/), { target: { value: "Rebooked with another plumber" } });
    fireEvent.click(apply);
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/support/tickets/t1", { method: "PATCH", body: { status: "RESOLVED", resolution: "Rebooked with another plumber" } }));
    expect(await screen.findByText("Status changed to resolved.")).toBeInTheDocument();
  });

  it("closing asks for confirmation first", async () => {
    detail();
    api.mockResolvedValue({ ticket: ticket() });
    asAdmin(<AdminTicketDetailView id="t1" />, MANAGE);
    fireEvent.change(screen.getByLabelText(/^Status/), { target: { value: "CLOSED" } });
    fireEvent.click(screen.getByRole("button", { name: "Change status" }));
    expect(api).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Close ticket", hidden: true }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/support/tickets/t1", { method: "PATCH", body: { status: "CLOSED" } }));
  });

  it("shows the server's explanation for OWN_TICKET / INVALID_TRANSITION failures", async () => {
    detail();
    api.mockRejectedValueOnce(new ApiError(403, "You don't have permission to do that.", {}, "OWN_TICKET"));
    asAdmin(<AdminTicketDetailView id="t1" />, MANAGE);
    fireEvent.change(screen.getByLabelText("Reply to the requester"), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
    expect(await screen.findByText(/cannot handle a request you raised yourself/)).toBeInTheDocument();

    api.mockRejectedValueOnce(new ApiError(409, "A resolved ticket cannot become in progress", {}, "INVALID_TRANSITION"));
    fireEvent.change(screen.getByLabelText(/^Status/), { target: { value: "IN_PROGRESS" } });
    fireEvent.click(screen.getByRole("button", { name: "Change status" }));
    expect(await screen.findByText(/status change is not allowed/)).toBeInTheDocument();
  });

  it("assigns using the staff list and the 'assign to me' shortcut", async () => {
    detail();
    api.mockResolvedValue({ ticket: ticket() });
    asAdmin(<AdminTicketDetailView id="t1" />, MANAGE);
    fireEvent.change(screen.getByLabelText("Assignee"), { target: { value: "s1" } });
    fireEvent.click(screen.getByRole("button", { name: "Change assignee" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/support/tickets/t1", { method: "PATCH", body: { assigneeId: "s1" } }));
    fireEvent.click(screen.getByRole("button", { name: "Assign to me" }));
    await waitFor(() => expect(api).toHaveBeenLastCalledWith("/admin/support/tickets/t1", { method: "PATCH", body: { assigneeId: "me1" } }));
  });

  it("is read-only without support.manage, and for a ticket the admin raised", () => {
    detail();
    const { unmount } = asAdmin(<AdminTicketDetailView id="t1" />, ["support.read"]);
    expect(screen.queryByRole("button", { name: "Send reply" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Change status" })).not.toBeInTheDocument();
    expect(screen.getByText(/can read tickets but not answer/)).toBeInTheDocument();
    unmount();

    detail({ isOwn: true });
    asAdmin(<AdminTicketDetailView id="t1" />, MANAGE);
    expect(screen.getByText("You raised this request yourself")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send reply" })).not.toBeInTheDocument();
  });

  it("a closed ticket cannot be answered or changed", () => {
    detail({ status: "CLOSED", allowedNext: [] });
    asAdmin(<AdminTicketDetailView id="t1" />, MANAGE);
    expect(screen.getByText(/closed, so it cannot be answered/)).toBeInTheDocument();
    expect(screen.getByText(/closed ticket is final/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send reply" })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- user-facing support
const own = (over: object = {}) => ({
  id: "t1", number: 7, category: "PAYMENT", subject: "Double charge", status: "WAITING_FOR_USER", bookingId: null, resolution: null,
  createdAt: "2026-11-01T06:00:00Z", updatedAt: "2026-11-02T06:00:00Z", lastMessageAt: "2026-11-02T06:00:00Z", ...over,
});

describe("user support", () => {
  it("lists my requests in plain words and explains how they are answered", () => {
    me = person(null);
    data["/support/tickets"] = { ...page, tickets: [own()] };
    render(<SupportList />);
    expect(screen.getByRole("heading", { level: 1, name: "Help and support" })).toBeInTheDocument();
    expect(screen.getByText(/answered here in the app/)).toBeInTheDocument();
    expect(screen.getByText(/can see the booking and the conversation/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Double charge/ })).toHaveAttribute("href", "/account/support/t1");
    expect(within(screen.getByRole("link", { name: /Double charge/ })).getByText("Waiting for your reply")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "New request" }).length).toBeGreaterThan(0);
  });

  it("empty state offers a new request", () => {
    me = person(null);
    data["/support/tickets"] = { ...page, total: 0, totalPages: 0, tickets: [] };
    render(<SupportList />);
    expect(screen.getByText("No requests yet")).toBeInTheDocument();
  });

  const bookings = (role: string) => ({ role, page: 1, pageSize: 50, total: 1, totalPages: 1, bookings: [{ id: role === "customer" ? "b1" : "b2", status: "COMPLETED", category: { slug: "p", name: "Plumbing" }, counterpartyName: role === "customer" ? "Karim" : "Asha", serviceArea: "Dhaka", startAt: "2026-11-01T06:00:00Z", endAt: "2026-11-01T07:00:00Z", agreedAmountBdt: 500, pricingModel: "FIXED", createdAt: "2026-10-30T06:00:00Z" }] });
  const fillBase = () => {
    fireEvent.change(screen.getByLabelText("Subject"), { target: { value: "Bad job" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "The pipe still leaks after the visit." } });
  };

  it("validates in the browser, requires a booking for complaints, and posts exactly what was entered", async () => {
    me = person(null);
    api.mockImplementation((path: string) => (path.startsWith("/bookings") ? Promise.resolve(bookings("customer")) : Promise.resolve({ ticket: { id: "t9" } })));
    render(<NewRequestForm />);
    expect(screen.getByText(/We answer inside the app/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText("Choose what your request is about.")).toBeInTheDocument();
    expect(screen.getByText("Use 3 to 140 characters.")).toBeInTheDocument();
    expect(screen.getByText("Use 10 to 4,000 characters.")).toBeInTheDocument();
    expect(api).not.toHaveBeenCalledWith("/support/tickets", expect.anything());

    const category = screen.getByLabelText("What is this about?");
    expect(within(category).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Choose a topic", "General question", "A booking", "A payment", "My account", "Complaint about a professional", "Complaint about a customer", "Safety concern", "Other",
    ]);
    fireEvent.change(category, { target: { value: "WORKER_COMPLAINT" } });
    fillBase();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText("Choose the booking this complaint is about.")).toBeInTheDocument();

    const booking = await screen.findByLabelText("Booking");
    await waitFor(() => expect(booking).not.toBeDisabled());
    expect(within(booking).getByRole("option", { name: /Plumbing with Karim/ })).toBeInTheDocument();
    fireEvent.change(booking, { target: { value: "b1" } });
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/support/tickets", { method: "POST", body: { category: "WORKER_COMPLAINT", subject: "Bad job", body: "The pipe still leaks after the visit.", bookingId: "b1" } }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/account/support/t9"));
  });

  it("a professional can also pick bookings they worked, matched to the complaint kind", async () => {
    me = person(null, { worker: { started: true, approved: true } });
    api.mockImplementation((path: string) => Promise.resolve(bookings(path.includes("role=worker") ? "worker" : "customer")));
    render(<NewRequestForm />);
    fireEvent.change(screen.getByLabelText("What is this about?"), { target: { value: "CUSTOMER_COMPLAINT" } });
    const booking = await screen.findByLabelText("Booking");
    await waitFor(() => expect(within(booking).getAllByRole("option")).toHaveLength(2));
    expect(within(booking).getByRole("option", { name: /Plumbing for Asha.*you worked/ })).toBeInTheDocument();
    expect(within(booking).queryByRole("option", { name: /with Karim/ })).not.toBeInTheDocument();
  });

  it("shows server field errors and business-rule messages", async () => {
    me = person(null);
    api.mockImplementation((path: string) =>
      path.startsWith("/bookings") ? Promise.resolve(bookings("customer")) : Promise.reject(new ApiError(422, "Please check the form.", { subject: "Subject contains unsupported characters" })));
    render(<NewRequestForm />);
    fireEvent.change(screen.getByLabelText("What is this about?"), { target: { value: "GENERAL" } });
    fillBase();
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText("Subject contains unsupported characters")).toBeInTheDocument();
    expect(screen.getByText("Please check the form.")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("the conversation shows staff replies without internal data; reply and close work", async () => {
    me = person(null);
    data["/support/tickets/t1"] = { ticket: { ...own({ resolution: null }), messages: [
      { id: "m1", authorRole: "CUSTOMER", body: "I was charged twice", createdAt: "2026-11-01T06:00:00Z", fromStaff: false },
      { id: "m2", authorRole: "ADMIN", body: "Can you send the reference?", createdAt: "2026-11-02T06:00:00Z", fromStaff: true },
    ] } };
    api.mockResolvedValue({});
    render(<SupportTicketView id="t1" />);
    expect(screen.getByText("FixedItNow support")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.queryByText(/Internal note/)).not.toBeInTheDocument();
    expect(screen.getByText("We are waiting for your reply.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Your message"), { target: { value: "FIN123" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reply" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/support/tickets/t1/messages", { method: "POST", body: { body: "FIN123" } }));
    fireEvent.click(screen.getByRole("button", { name: "Close this request" }));
    fireEvent.click(await screen.findByRole("button", { name: "Close request", hidden: true }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/support/tickets/t1/close", { method: "POST" }));
  });

  it("a closed request cannot be replied to and shows the answer", () => {
    me = person(null);
    data["/support/tickets/t1"] = { ticket: { ...own({ status: "CLOSED", resolution: "Refunded in full" }), messages: [] } };
    render(<SupportTicketView id="t1" />);
    expect(screen.getByText("Refunded in full")).toBeInTheDocument();
    expect(screen.queryByLabelText("Your message")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "send a new request" })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- moderation content tab
describe("moderation content tab", () => {
  const overview = { reports: { open: 0, reviewing: 0, openByType: {} }, proposals: { submitted: 0, needsReview: 0, voteThreshold: 10 }, hidden: { posts: 0, comments: 0, reviews: 0, proposals: 0 }, visible: { reviews: 0, posts: 0 } };
  const item = (over: object = {}) => ({ type: "POST", id: "p1", status: "VISIBLE", title: "Cheap deal", text: "call me", truncated: false, author: "Asha", createdAt: "2026-11-01T06:00:00Z", openReports: 2, moderationReason: null, ...over });
  const open = (permissions: string[]) => {
    data["/admin/moderation/overview"] = overview;
    data["/admin/content/"] = { ...page, items: [item(), item({ id: "p2", status: "HIDDEN", title: "Spam", moderationReason: "Advertising" })] };
    asAdmin(<ModerationView />, permissions);
    fireEvent.click(screen.getByRole("tab", { name: "Content" }));
  };

  it("browses by type with filters and hides content with a reason", async () => {
    open(["moderation.read", "moderation.manage"]);
    expect(screen.getByText("Cheap deal")).toBeInTheDocument();
    expect(screen.getAllByText("2 open reports")).toHaveLength(2);
    expect(screen.getByText(/Moderation reason:/)).toBeInTheDocument();
    expect(paths.at(-1)).toBe("/admin/content/posts?page=1");
    fireEvent.change(screen.getByLabelText("Content type"), { target: { value: "reviews" } });
    expect(paths.at(-1)).toBe("/admin/content/reviews?page=1");
    fireEvent.click(screen.getByLabelText("Only items with open reports"));
    expect(paths.at(-1)).toContain("reported=true");
    fireEvent.change(screen.getByLabelText("Visibility"), { target: { value: "HIDDEN" } });
    expect(paths.at(-1)).toContain("status=HIDDEN");

    api.mockResolvedValue({});
    fireEvent.click(screen.getAllByRole("button", { name: "Hide…" })[0]!);
    const confirm = screen.getByRole("button", { name: "Hide", hidden: true });
    expect(confirm).toBeDisabled(); // reason required
    fireEvent.change(screen.getByLabelText(/^Reason/, { selector: "textarea" }), { target: { value: "Advertising" } });
    fireEvent.click(confirm);
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/moderation/reviews/p1/visibility", { method: "POST", body: { hidden: true, reason: "Advertising" } }));
    expect(await screen.findByText("Content hidden.")).toBeInTheDocument();
  });

  it("offers Restore for hidden items, and no actions at all to a read-only role", () => {
    open(["moderation.read", "moderation.manage"]);
    expect(screen.getByRole("button", { name: "Restore…" })).toBeInTheDocument();
  });

  it("read-only roles see the content but no hide/restore buttons", () => {
    open(["moderation.read"]);
    expect(screen.getByText("Cheap deal")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hide…" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Restore…" })).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------- AI assistant
describe("admin AI assistant", () => {
  const status = (over: { service?: object; knowledge?: object } = {}) => ({
    service: { configured: true, reachable: true, llm: "gemini", assistantEnabled: true, ...over.service },
    knowledge: { published: 3, draft: 1, archived: 0, expectedDigest: "abc", running: { source: "api", configuredSource: "api", documents: 3, chunks: 9, digest: "abc" }, inSync: true, lastSync: { ok: true, at: "2026-11-02T06:00:00Z", by: "Rafi", detail: { documents: 3, chunks: 9, source: "api" } }, ...over.knowledge },
  });
  const docs = { documents: [{ id: "d1", slug: "refunds", title: "Refund rules", url: "/help", status: "DRAFT", version: 2, updatedAt: "2026-11-01T06:00:00Z", publishedAt: null, characters: 120, allowedNext: ["PUBLISHED", "ARCHIVED"] }] };
  const doc = (over: object = {}) => ({ document: { ...docs.documents[0], body: "# Refunds\nRefunds take five days to arrive.", revisions: [{ version: 2, title: "Refund rules", createdAt: "2026-11-01T06:00:00Z" }, { version: 1, title: "Refunds", createdAt: "2026-10-30T06:00:00Z" }], ...over } });

  it("shows service state, counts, in-sync and last sync from the API", () => {
    data["/admin/ai/status"] = status();
    data["/admin/ai/knowledge"] = docs;
    asAdmin(<AiAdminView />, ["ai.read", "ai.manage"]);
    expect(screen.getByText("Reachable")).toBeInTheDocument();
    expect(screen.getByText(/Language model: gemini/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Change in settings" })).toHaveAttribute("href", "/admin/settings");
    expect(screen.getByText("In sync")).toBeInTheDocument();
    expect(screen.getByTestId("last-sync")).toHaveTextContent(/succeeded.*by Rafi.*3 documents, 9 sections, source api/);
    expect(screen.getByText("Refund rules")).toBeInTheDocument();
  });

  it("explains a service reading bundled files instead of claiming sync", () => {
    data["/admin/ai/status"] = status({ knowledge: { inSync: false, running: { source: "files", configuredSource: "files", documents: 4, chunks: 12, digest: "zzz" } } });
    data["/admin/ai/knowledge"] = docs;
    asAdmin(<AiAdminView />, ["ai.read"]);
    expect(screen.queryByText("In sync")).not.toBeInTheDocument();
    expect(screen.getByText(/reading bundled files, so published documents do not reach it/)).toBeInTheDocument();
  });

  it("sync needs confirmation, sends confirm:true and reports the hint honestly", async () => {
    data["/admin/ai/status"] = status({ knowledge: { inSync: false, running: { source: "files", configuredSource: "files", documents: 4, chunks: 12, digest: "zzz" } } });
    data["/admin/ai/knowledge"] = docs;
    api.mockResolvedValue({ synced: true, inSync: false, source: "files", documents: 4, chunks: 12, hint: "The AI service is configured to read bundled files." });
    asAdmin(<AiAdminView />, ["ai.read", "ai.manage"]);
    fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
    expect(api).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: "Sync now", hidden: true }).at(-1)!);
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/ai/sync", { method: "POST", body: { confirm: true } }));
    expect(await screen.findByText("The AI service was refreshed, but not from your documents")).toBeInTheDocument();
  });

  it("keeps the dialog open with the 502 message when the sync fails", async () => {
    data["/admin/ai/status"] = status();
    data["/admin/ai/knowledge"] = docs;
    api.mockRejectedValue(new ApiError(502, "Something went wrong on our side. Please try again.", {}, "AI_SYNC_FAILED"));
    asAdmin(<AiAdminView />, ["ai.read", "ai.manage"]);
    fireEvent.click(screen.getByRole("button", { name: "Sync now" }));
    fireEvent.click(screen.getAllByRole("button", { name: "Sync now", hidden: true }).at(-1)!);
    expect(await screen.findByText(/Something went wrong on our side/)).toBeInTheDocument();
    expect(screen.queryByText("Sync finished")).not.toBeInTheDocument();
  });

  it("is read-only for ai.read without ai.manage", () => {
    data["/admin/ai/status"] = status();
    data["/admin/ai/knowledge"] = docs;
    data["/admin/ai/knowledge/d1"] = doc();
    asAdmin(<AiAdminView />, ["ai.read"]);
    expect(screen.queryByRole("button", { name: "Sync now" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New document" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View Refund rules" }));
    expect(screen.getByText(/can read knowledge documents but not change them/)).toBeInTheDocument();
    expect(screen.getByLabelText("Text")).toHaveAttribute("readonly");
    for (const name of ["Save changes", "Publish…", "Archive…", "Revert to version 1"]) expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
  });

  it("publishing needs a confirmation and sends status + confirm:true", async () => {
    data["/admin/ai/status"] = status();
    data["/admin/ai/knowledge"] = docs;
    data["/admin/ai/knowledge/d1"] = doc();
    api.mockResolvedValue({});
    asAdmin(<AiAdminView />, ["ai.read", "ai.manage"]);
    fireEvent.click(screen.getByRole("button", { name: "Open Refund rules" }));
    expect(screen.getByText(new RegExp(`${doc().document.body.length} / 20,000 characters`))).toBeInTheDocument();
    expect(screen.getByLabelText("Text")).toHaveClass("font-mono");
    fireEvent.click(screen.getByRole("button", { name: "Publish…" }));
    expect(api).not.toHaveBeenCalled();
    expect(screen.getByText(/can change live answers after the next sync/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish", hidden: true }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/ai/knowledge/d1/status", { method: "POST", body: { status: "PUBLISHED", confirm: true } }));
  });

  it("saves only what changed, blocks status changes while edits are unsaved, and reverts a version", async () => {
    data["/admin/ai/status"] = status();
    data["/admin/ai/knowledge"] = docs;
    data["/admin/ai/knowledge/d1"] = doc();
    api.mockResolvedValue({});
    asAdmin(<AiAdminView />, ["ai.read", "ai.manage"]);
    fireEvent.click(screen.getByRole("button", { name: "Open Refund rules" }));
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Refund policy" } });
    expect(screen.getByRole("button", { name: "Publish…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/ai/knowledge/d1", { method: "PATCH", body: { title: "Refund policy" } }));

    fireEvent.click(screen.getByRole("button", { name: "Revert to version 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Revert", hidden: true }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/ai/knowledge/d1/revert", { method: "POST", body: { version: 1 } }));
  });

  it("creates a draft after checking the slug, path and text", async () => {
    data["/admin/ai/status"] = status();
    data["/admin/ai/knowledge"] = docs;
    data["/admin/ai/knowledge/d9"] = doc({ id: "d9" });
    api.mockResolvedValue({ document: { id: "d9" } });
    asAdmin(<AiAdminView />, ["ai.read", "ai.manage"]);
    fireEvent.click(screen.getByRole("button", { name: "New document" }));
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    expect(await screen.findByText(/Use lowercase letters, digits and hyphens/)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "safety-tips" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Safety tips" } });
    fireEvent.change(screen.getByLabelText("Text"), { target: { value: "# Safety\nNever pay outside the app." } });
    fireEvent.click(screen.getByRole("button", { name: "Create draft" }));
    await waitFor(() => expect(api).toHaveBeenCalledWith("/admin/ai/knowledge", { method: "POST", body: { slug: "safety-tips", title: "Safety tips", url: "/help", body: "# Safety\nNever pay outside the app." } }));
  });
});

// ---------------------------------------------------------------- system
describe("admin operations", () => {
  const ops = {
    database: "ok", databaseLatencyMs: 12,
    integrations: [
      { id: "database", label: "Database (PostgreSQL)", status: "ok", detail: "Answered in 12 ms", probed: true },
      { id: "bkash", label: "bKash", status: "sandbox", detail: "Credentials present (sandbox); not verified against bKash from here.", probed: false },
      { id: "mail", label: "Email delivery", status: "ok", detail: "SMTP transport configured (delivery is not probed)", probed: false },
      { id: "ai", label: "AI assistant service", status: "down", detail: "Configured but not answering", probed: true },
      { id: "google", label: "Google sign-in", status: "not_configured", detail: "GOOGLE_CLIENT_ID / SECRET are not set", probed: false },
    ],
    queues: { paymentsRequiringReview: 2, paymentsUnresolvedOver30Minutes: 0, refundsAwaitingProvider: 1, refundsAwaitingDecision: 3, disputesOpen: 4, reportsOpen: 5, ticketsOpen: 6, ticketsUnassigned: 7 },
    audit: { headSeq: 1234, lastEntryAt: "2026-11-02T06:00:00Z" },
    platform: { maintenanceMode: true },
    runtime: { environment: "production", node: "v22.1.0", uptimeSeconds: 93_784 },
  };

  it("never calls a configured-only dependency 'working', and says what was actually checked", async () => {
    api.mockResolvedValue(ops);
    asAdmin(<SystemView />, ["ops.read", "payments.read", "support.read"]);
    expect(await screen.findByText("Database (PostgreSQL)")).toBeInTheDocument();
    expect(screen.getByText("Working")).toBeInTheDocument(); // only the probed database
    expect(screen.getByText("Configured (not tested)")).toBeInTheDocument(); // mail
    expect(screen.getByText("Sandbox mode (test money)")).toBeInTheDocument();
    expect(screen.getByText("Down")).toBeInTheDocument();
    expect(screen.getByText("Not configured")).toBeInTheDocument();
    expect(screen.getAllByText("Checked now")).toHaveLength(2);
    expect(screen.getAllByText("Configuration only")).toHaveLength(3);
    expect(screen.getByText("12 ms")).toBeInTheDocument();
    expect(screen.getByText("#1234")).toBeInTheDocument();
    expect(screen.getByText("On")).toBeInTheDocument(); // maintenance mode
    expect(screen.getByText(/Node v22.1.0 · up 1 d 2 h 3 min/)).toBeInTheDocument();
    expect(screen.getByText(/Last updated/)).toBeInTheDocument();
  });

  it("links queues only where the role may open the page, and refreshes on demand", async () => {
    api.mockResolvedValue(ops);
    asAdmin(<SystemView />, ["ops.read", "support.read"]);
    await screen.findByText("Waiting for a person");
    expect(screen.getByRole("link", { name: /Support tickets open or in progress/ })).toHaveAttribute("href", "/admin/support");
    expect(screen.queryByRole("link", { name: /Open disputes/ })).not.toBeInTheDocument();
    expect(screen.getByText("Open disputes")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Refresh/ }));
    await waitFor(() => expect(api).toHaveBeenCalledTimes(2));
  });

  it("shows the error with a retry when the status cannot be read", async () => {
    api.mockRejectedValue(new Error("Something went wrong on our side. Please try again."));
    asAdmin(<SystemView />, ["ops.read"]);
    expect(await screen.findByText(/Something went wrong on our side/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("describeIntegration and formatUptime", () => {
    expect(describeIntegration({ status: "ok", probed: false }).label).toBe("Configured (not tested)");
    expect(describeIntegration({ status: "live", probed: false }).label).toBe("Live mode");
    expect(describeIntegration({ status: "off", probed: false }).label).toBe("Off");
    expect(describeIntegration({ status: "degraded", probed: true }).label).toBe("Degraded");
    expect(formatUptime(42)).toBe("42 s");
  });
});
