"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button, LinkButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TextArea } from "@/components/ui/text-area";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { CATEGORY_LABELS, MESSAGE_MAX, USER_STATUS, type OwnTicketDetail } from "@/lib/support";
import { useApi } from "@/lib/use-api";

function Detail({ id }: { id: string }) {
  const { state, reload, refresh } = useApi<OwnTicketDetail>(`/support/tickets/${id}`);
  const replyId = useId();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [confirmClose, setConfirmClose] = useState(false);

  if (state.status === "loading" || state.status === "unauthenticated") return <div aria-busy="true" aria-label="Loading your request" className="space-y-3"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-40" /></div>;
  if (state.status === "error") return <ErrorState action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>;
  const { ticket } = state.data;
  const closed = ticket.status === "CLOSED";
  const status = USER_STATUS[ticket.status];

  async function send() {
    const text = body.trim();
    if (!text || pending) return;
    setPending(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await api(`/support/tickets/${id}/messages`, { method: "POST", body: { body: text } });
      setBody("");
      setNotice("Your message was sent.");
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Help and support", href: "/account/support" }, { label: `Request #${ticket.number}` }]} />
      <header className="space-y-2">
        <h1 className="text-h1 font-extrabold break-words text-brand-950">{ticket.subject}</h1>
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <Badge tone={status?.tone ?? "neutral"}>{status?.label ?? ticket.status}</Badge>
          <span>#{ticket.number}</span>
          <span>· {CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
          <span>· Sent {formatDateTime(ticket.createdAt)}</span>
        </p>
      </header>

      {ticket.resolution && (
        <Alert tone="success" title="Our answer"><span className="whitespace-pre-line break-words">{ticket.resolution}</span></Alert>
      )}
      {ticket.status === "RESOLVED" && <Alert tone="info">If this did not solve it, reply below and we will look at it again.</Alert>}
      {ticket.status === "WAITING_FOR_USER" && <Alert tone="warning">We are waiting for your reply.</Alert>}

      <section aria-label="Conversation" className="space-y-3">
        <h2 className="text-lg font-bold text-ink">Conversation</h2>
        <ol className="space-y-3">
          {ticket.messages.map((m) => (
            <li key={m.id} className={cn("rounded-card border p-4", m.fromStaff ? "border-brand-200 bg-brand-50 sm:mr-8" : "border-line bg-canvas sm:ml-8")}>
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                <span className="font-bold text-ink">{m.fromStaff ? "FixedItNow support" : "You"}</span>
                <span>{formatDateTime(m.createdAt)}</span>
              </p>
              <p className="mt-2 text-sm whitespace-pre-line break-words text-ink">{m.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {closed ? (
        <Alert tone="info">This request is closed. If you still need help, <Link className="font-semibold underline" href="/account/support/new">send a new request</Link>.</Alert>
      ) : (
        <section aria-label="Reply" className="space-y-3">
          <h2 className="text-lg font-bold text-ink">Reply</h2>
          <TextArea id={replyId} label="Your message" value={body} maxLength={MESSAGE_MAX} onChange={(e) => setBody(e.target.value)} disabled={pending} hint={`${body.trim().length.toLocaleString("en")} of ${MESSAGE_MAX.toLocaleString("en")} characters`} />
          {error && <Alert tone="error">{error}</Alert>}
          {notice && <Alert tone="success">{notice}</Alert>}
          <div className="flex flex-wrap gap-3">
            <Button onClick={send} loading={pending} disabled={body.trim().length === 0}>Send reply</Button>
            <Button variant="secondary" onClick={() => setConfirmClose(true)} disabled={pending}>Close this request</Button>
          </div>
          <ConfirmDialog open={confirmClose} title="Close this request?" confirmLabel="Close request" onClose={() => setConfirmClose(false)}
            onConfirm={async () => { await api(`/support/tickets/${id}/close`, { method: "POST" }); setNotice("The request is closed."); refresh(); }}>
            Close it if you no longer need help. A closed request cannot be reopened, but you can always send a new one.
          </ConfirmDialog>
        </section>
      )}
      <LinkButton href="/account/support" variant="ghost">Back to all requests</LinkButton>
    </div>
  );
}

export function SupportTicketView({ id }: { id: string }) {
  return <AuthGate>{() => <Detail id={id} />}</AuthGate>;
}
