"use client";

import { MessageSquare } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TextArea } from "@/components/ui/text-area";
import { api, ApiError } from "@/lib/api";
import type { ChatAvailability, ChatMessage, ChatThread, ViewerRole } from "@/lib/booking-types";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";

/** How often an open conversation asks the server for new messages. This is polling, not push delivery. */
export const CHAT_POLL_MS = 5000;
export const CHAT_MAX_LENGTH = 2000;

type Pending = { clientMessageId: string; body: string; state: "sending" | "failed"; error?: string };

const newClientId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * The booking's private conversation. Whether it is offered at all (and whether
 * the participant may write) comes from the server's `chat` flag; every message
 * request is authorised again on the server. Updates arrive by polling every few
 * seconds while the conversation is open and the tab is visible: there is no
 * push delivery and no read receipt, and the page says so.
 */
export function ChatSection({
  bookingId,
  chat,
  viewer,
  otherName,
  startOpen = false,
}: {
  bookingId: string;
  chat: ChatAvailability;
  viewer: ViewerRole;
  otherName: string;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  if (chat.state === "NOT_OPEN") {
    // Never a button before the booking is accepted; only a short note while it is still a request.
    return chat.reason ? (
      <section aria-labelledby="chat-heading">
        <h2 id="chat-heading" className="text-h2 font-extrabold">Messages</h2>
        <p className="mt-3 text-sm text-ink-muted">{chat.reason}</p>
      </section>
    ) : null;
  }
  return (
    <section aria-labelledby="chat-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="chat-heading" className="text-h2 font-extrabold">Messages</h2>
        <Button variant={open ? "secondary" : "accent"} aria-expanded={open} aria-controls="chat-panel" onClick={() => setOpen((v) => !v)}>
          <MessageSquare aria-hidden className="size-4" />
          {open ? "Hide chat" : `Chat with ${otherName}`}
        </Button>
      </div>
      {chat.state === "READ_ONLY" && chat.reason && <p className="mt-3 text-sm text-ink-muted">{chat.reason}</p>}
      {open && (
        <div id="chat-panel" className="mt-4">
          <Conversation bookingId={bookingId} viewer={viewer} canSend={chat.state === "OPEN"} />
        </div>
      )}
    </section>
  );
}

function Conversation({ bookingId, viewer, canSend }: { bookingId: string; viewer: ViewerRole; canSend: boolean }) {
  const [thread, setThread] = useState<ChatThread>();
  const [loadError, setLoadError] = useState<string>();
  const [refreshError, setRefreshError] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string>();
  const sending = useRef(new Set<string>());
  const log = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<ChatThread>(`/bookings/${bookingId}/chat`);
      setThread(res);
      setLoadError(undefined);
      setRefreshError(false);
    } catch (e) {
      // The first load failing is an error screen; a later poll failing keeps what is on screen.
      if (e instanceof ApiError) setLoadError(e.message);
      else setLoadError("Something went wrong. Please try again.");
      setRefreshError(true);
    }
  }, [bookingId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of server state, then polling
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, CHAT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const count = (thread?.messages.length ?? 0) + pending.length;
  useEffect(() => {
    log.current?.scrollTo?.({ top: log.current.scrollHeight });
  }, [count]);

  async function deliver(clientMessageId: string, body: string) {
    if (sending.current.has(clientMessageId)) return; // double click / double submit
    sending.current.add(clientMessageId);
    setPending((p) => p.map((m) => (m.clientMessageId === clientMessageId ? { ...m, state: "sending", error: undefined } : m)));
    try {
      const res = await api<{ message: ChatMessage }>(`/bookings/${bookingId}/chat/messages`, { method: "POST", body: { body, clientMessageId } });
      // Only now, after the server stored it, does it count as sent.
      setThread((t) => (t && !t.messages.some((m) => m.id === res.message.id) ? { ...t, messages: [...t.messages, res.message] } : t));
      setPending((p) => p.filter((m) => m.clientMessageId !== clientMessageId));
    } catch (e) {
      const message = e instanceof ApiError || e instanceof Error ? e.message : "Not sent.";
      setPending((p) => p.map((m) => (m.clientMessageId === clientMessageId ? { ...m, state: "failed", error: message } : m)));
    } finally {
      sending.current.delete(clientMessageId);
    }
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) {
      setDraftError("Write a message first.");
      return;
    }
    if (body.length > CHAT_MAX_LENGTH) {
      setDraftError(`Messages can be up to ${CHAT_MAX_LENGTH} characters.`);
      return;
    }
    setDraftError(undefined);
    const clientMessageId = newClientId();
    setPending((p) => [...p, { clientMessageId, body, state: "sending" }]);
    setDraft("");
    void deliver(clientMessageId, body);
  }

  if (!thread && !loadError) {
    return <div aria-busy="true" aria-label="Loading messages" className="space-y-3"><Skeleton className="h-16" /><Skeleton className="h-16 w-2/3" /></div>;
  }
  if (!thread) {
    return (
      <Alert tone="error" title="Messages could not be loaded">
        {loadError} <Button size="sm" variant="secondary" className="ml-2" onClick={() => void load()}>Try again</Button>
      </Alert>
    );
  }

  const stored = new Set(thread.messages.map((m) => m.clientMessageId).filter(Boolean));
  const waiting = pending.filter((m) => !stored.has(m.clientMessageId));
  const other = thread.counterparty.displayName;

  return (
    <Card className="overflow-hidden">
      <div ref={log} role="log" aria-live="polite" aria-label={`Conversation with ${other}`} className="max-h-96 min-h-40 overflow-y-auto p-4">
      <ol className="space-y-3">
        {thread.hasMore && <li className="text-center text-xs text-ink-subtle">Showing the latest messages only.</li>}
        {thread.messages.length === 0 && waiting.length === 0 && (
          <li className="py-8 text-center text-sm text-ink-muted">No messages yet. {canSend ? `Say hello to ${other}.` : ""}</li>
        )}
        {thread.messages.map((m) => (
          <Bubble key={m.id} mine={m.mine} who={m.mine ? "You" : other} when={formatDateTime(m.createdAt)} body={m.body} />
        ))}
        {waiting.map((m) => (
          <Bubble key={m.clientMessageId} mine who="You" when={m.state === "sending" ? "Sending…" : "Not sent"} body={m.body} faded={m.state === "sending"}>
            {m.state === "failed" && (
              <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-danger">
                {m.error}
                <Button size="sm" variant="secondary" onClick={() => void deliver(m.clientMessageId, m.body)}>Retry</Button>
                <Button size="sm" variant="ghost" onClick={() => setPending((p) => p.filter((x) => x.clientMessageId !== m.clientMessageId))}>Discard</Button>
              </span>
            )}
          </Bubble>
        ))}
      </ol>
      </div>
      {refreshError && <p className="border-t border-line px-4 py-2 text-xs text-ink-subtle" role="status">Could not refresh just now. Showing the last messages we have.</p>}
      {canSend ? (
        <form onSubmit={submit} className="space-y-3 border-t border-line p-4" noValidate>
          <TextArea
            id="chat-draft"
            label={`Message ${viewer === "CUSTOMER" ? "the professional" : "the customer"}`}
            hint={`Plain text, up to ${CHAT_MAX_LENGTH} characters. New messages appear within a few seconds; there are no read receipts. Do not share passwords or payment PINs.`}
            value={draft}
            maxLength={CHAT_MAX_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            error={draftError}
            className="min-h-20"
          />
          <Button type="submit">Send message</Button>
        </form>
      ) : (
        <p className="border-t border-line p-4 text-sm text-ink-muted">You can read this conversation, but new messages can no longer be sent.</p>
      )}
    </Card>
  );
}

function Bubble({ mine, who, when, body, faded, children }: { mine: boolean; who: string; when: string; body: string; faded?: boolean; children?: React.ReactNode }) {
  return (
    <li className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      <div className={cn("max-w-[85%] rounded-card px-3 py-2 text-sm", mine ? "bg-brand-700 text-white" : "bg-surface-strong text-ink", faded && "opacity-70")}>
        <p className="whitespace-pre-line break-words">{body}</p>
      </div>
      <span className="mt-1 text-xs text-ink-subtle">{who} · {when}</span>
      {children}
    </li>
  );
}
