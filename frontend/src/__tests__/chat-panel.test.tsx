import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage, ChatThread } from "@/lib/booking-types";

const api = vi.fn();
vi.mock("@/lib/api", () => ({
  api: (...a: unknown[]) => api(...a),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));

import { ChatSection, CHAT_POLL_MS } from "@/components/bookings/chat-panel";

const msg = (over: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "m1", senderRole: "WORKER", mine: false, body: "I am on my way", createdAt: "2026-11-04T03:00:00.000Z", ...over,
});
const thread = (messages: ChatMessage[] = [], over: Partial<ChatThread> = {}): ChatThread => ({
  chat: { state: "OPEN", reason: null },
  counterparty: { displayName: "Rahim Uddin", role: "WORKER", slug: "rahim-1a2b" },
  messages, hasMore: false, ...over,
});

const open = async (chat = { state: "OPEN" as const, reason: null as string | null }, props: { startOpen?: boolean } = {}) => {
  render(<ChatSection bookingId="b1" chat={chat} viewer="CUSTOMER" otherName="Rahim Uddin" {...props} />);
};

beforeEach(() => { api.mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe("ChatSection", () => {
  it("has no chat button and no request before the booking is accepted", () => {
    render(<ChatSection bookingId="b1" chat={{ state: "NOT_OPEN", reason: "Messaging opens once the professional accepts the booking." }} viewer="CUSTOMER" otherName="Rahim" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Messaging opens once the professional accepts the booking.")).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it("renders nothing for a booking that never had a conversation (declined, expired)", () => {
    const { container } = render(<ChatSection bookingId="b1" chat={{ state: "NOT_OPEN", reason: null }} viewer="CUSTOMER" otherName="Rahim" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("loads nothing until the customer opens the conversation, then shows the stored history", async () => {
    api.mockResolvedValue(thread([msg(), msg({ id: "m2", mine: true, senderRole: "CUSTOMER", body: "Thanks", clientMessageId: "c-2222222" })]));
    await open();
    expect(api).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Chat with Rahim Uddin" }));
    expect(await screen.findByText("I am on my way")).toBeInTheDocument();
    expect(screen.getByText("Thanks")).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith("/bookings/b1/chat");
    expect(screen.getByRole("log", { name: "Conversation with Rahim Uddin" })).toBeInTheDocument();
  });

  it("shows an honest empty state", async () => {
    api.mockResolvedValue(thread([]));
    await open(undefined, { startOpen: true });
    expect(await screen.findByText(/No messages yet/)).toBeInTheDocument();
  });

  it("shows a load error with a retry", async () => {
    api.mockRejectedValueOnce(new Error("Boom")).mockResolvedValueOnce(thread([msg()]));
    await open(undefined, { startOpen: true });
    expect(await screen.findByText("Messages could not be loaded")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("I am on my way")).toBeInTheDocument();
  });

  it("shows a sent message as 'Sending…' until the server has stored it, then as sent", async () => {
    let finish!: (v: unknown) => void;
    api.mockImplementation((path: string, init?: { method?: string }) =>
      init?.method === "POST" ? new Promise((resolve) => { finish = resolve; }) : Promise.resolve(thread([])));
    await open(undefined, { startOpen: true });
    fireEvent.change(await screen.findByLabelText(/Message the professional/), { target: { value: "  Hello  " } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Sending…", { exact: false })).toBeInTheDocument();
    const post = api.mock.calls.find((c) => c[1]?.method === "POST")!;
    expect(post[0]).toBe("/bookings/b1/chat/messages");
    expect(post[1].body.body).toBe("Hello");
    expect(post[1].body.clientMessageId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    await act(async () => finish({ message: msg({ id: "m9", mine: true, senderRole: "CUSTOMER", body: "Hello", clientMessageId: post[1].body.clientMessageId }) }));
    await waitFor(() => expect(screen.queryByText("Sending…", { exact: false })).not.toBeInTheDocument());
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("keeps a failed message visible and retries with the SAME key, so a retry cannot duplicate it", async () => {
    api.mockImplementation((path: string, init?: { method?: string }) => init?.method === "POST" ? Promise.reject(new Error("We couldn't reach the server.")) : Promise.resolve(thread([])));
    await open(undefined, { startOpen: true });
    fireEvent.change(await screen.findByLabelText(/Message the professional/), { target: { value: "Are you coming?" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("We couldn't reach the server.")).toBeInTheDocument();
    expect(screen.getByText("Are you coming?")).toBeInTheDocument();
    const firstKey = api.mock.calls.find((c) => c[1]?.method === "POST")![1].body.clientMessageId;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(api.mock.calls.filter((c) => c[1]?.method === "POST")).toHaveLength(2));
    expect(api.mock.calls.filter((c) => c[1]?.method === "POST")[1][1].body.clientMessageId).toBe(firstKey);
  });

  it("does not send an empty or oversized message", async () => {
    api.mockResolvedValue(thread([]));
    await open(undefined, { startOpen: true });
    await screen.findByLabelText(/Message the professional/);
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText("Write a message first.")).toBeInTheDocument();
    expect(api.mock.calls.filter((c) => c[1]?.method === "POST")).toHaveLength(0);
  });

  it("is read-only when the server says so: history visible, no composer", async () => {
    api.mockResolvedValue(thread([msg()], { chat: { state: "READ_ONLY", reason: "This booking was cancelled." } }));
    await open({ state: "READ_ONLY", reason: "This booking was cancelled, so new messages cannot be sent. You can still read the conversation." } as never, { startOpen: true });
    expect(await screen.findByText("I am on my way")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Send message" })).not.toBeInTheDocument();
    expect(screen.getByText(/new messages can no longer be sent/)).toBeInTheDocument();
  });

  it("renders message text inertly", async () => {
    api.mockResolvedValue(thread([msg({ body: "<img src=x onerror=alert(1)><script>alert(2)</script>" })]));
    await open(undefined, { startOpen: true });
    expect(await screen.findByText(/<img src=x onerror=alert\(1\)>/)).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    expect(document.querySelector("img[src='x']")).toBeNull();
  });

  it("polls for new messages and keeps the old ones on screen when a poll fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.mockResolvedValueOnce(thread([msg()])).mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(thread([msg(), msg({ id: "m2", body: "Almost there" })]));
    await open(undefined, { startOpen: true });
    expect(await screen.findByText("I am on my way")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(CHAT_POLL_MS); });
    expect(await screen.findByText(/Could not refresh just now/)).toBeInTheDocument();
    expect(screen.getByText("I am on my way")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(CHAT_POLL_MS); });
    expect(await screen.findByText("Almost there")).toBeInTheDocument();
    expect(screen.queryByText(/Could not refresh just now/)).not.toBeInTheDocument();
  });
});
