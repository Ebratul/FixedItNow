"use client";

import Link from "next/link";
import { ArrowLeft, StickyNote } from "lucide-react";
import { useId, useState } from "react";
import { AdminPage, ApiView, StatusBadge } from "@/components/admin/kit";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SelectInput } from "@/components/ui/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import { TextArea } from "@/components/ui/text-area";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import {
  CATEGORY_LABELS, PRIORITY, STAFF_STATUS, TICKET_PRIORITIES, ticketErrorMessage,
  type AdminTicket, type AdminTicketDetail, type TicketPriority, type TicketStatus,
} from "@/lib/support";
import { useApi } from "@/lib/use-api";

export function AdminTicketDetailView({ id }: { id: string }) {
  return (
    <AdminPage title="Support ticket" permission="support.read" actions={<Link href="/admin/support" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-800 hover:underline"><ArrowLeft className="size-4" aria-hidden /> All tickets</Link>}>
      <Body id={id} />
    </AdminPage>
  );
}

function Body({ id }: { id: string }) {
  const { state, reload, refresh } = useApi<AdminTicketDetail>(`/admin/support/tickets/${id}`);
  return (
    <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-96" />}>
      {({ ticket }) => <Ticket ticket={ticket} onChanged={refresh} />}
    </ApiView>
  );
}

function Ticket({ ticket, onChanged }: { ticket: AdminTicket; onChanged: () => void }) {
  const { can } = useAdmin();
  const manage = can("support.manage");
  const closed = ticket.status === "CLOSED";
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h2 className="text-xl font-extrabold break-words text-ink">#{ticket.number}: {ticket.subject}</h2>
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <StatusBadge value={ticket.status} map={STAFF_STATUS} />
          <StatusBadge value={ticket.priority} map={PRIORITY} />
          <span>{CATEGORY_LABELS[ticket.category] ?? ticket.category}</span>
          <span>· From {ticket.requester.name}</span>
          <span>· Opened {formatDateTime(ticket.createdAt)}</span>
          <span>· {ticket.assignee ? `Assigned to ${ticket.assignee.name}` : "Unassigned"}</span>
        </p>
      </header>

      {ticket.isOwn && (
        <Alert tone="warning" title="You raised this request yourself">
          You can read it, but another member of staff has to answer and change it.
        </Alert>
      )}
      {ticket.resolution && (
        <Alert tone="success" title="Resolution shown to the requester">
          <span className="whitespace-pre-line break-words">{ticket.resolution}</span>
          {ticket.resolvedAt ? ` (${formatDateTime(ticket.resolvedAt)})` : ""}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Conversation messages={ticket.messages} />
          {manage && !ticket.isOwn && <ReplyBox ticket={ticket} closed={closed} onSent={onChanged} />}
        </div>
        <aside className="space-y-4" aria-label="Ticket details">
          {ticket.booking && <BookingContext booking={ticket.booking} />}
          {manage && !ticket.isOwn && <Controls ticket={ticket} onChanged={onChanged} />}
          {!manage && <Alert tone="info">Your role can read tickets but not answer or change them.</Alert>}
        </aside>
      </div>
    </div>
  );
}

function Conversation({ messages }: { messages: AdminTicket["messages"] }) {
  return (
    <section aria-label="Conversation" className="space-y-3">
      <h2 className="text-lg font-bold text-ink">Conversation</h2>
      {messages.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-surface p-4 text-sm text-ink-muted">There are no messages on this ticket.</p>
      ) : (
        <ol className="space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                "rounded-card border p-4",
                m.internal ? "border-dashed border-amber-400 bg-warning-soft" : m.from === "staff" ? "border-brand-200 bg-brand-50 sm:ml-8" : "border-line bg-canvas sm:mr-8",
              )}
            >
              <p className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                <span className="font-bold text-ink">{m.author}</span>
                <Badge tone={m.from === "staff" ? "brand" : "neutral"}>{m.from === "staff" ? "Staff" : "Requester"}</Badge>
                <span>{formatDateTime(m.createdAt)}</span>
              </p>
              {m.internal && (
                <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-warning">
                  <StickyNote className="size-4" aria-hidden /> Internal note: not shown to the user
                </p>
              )}
              <p className="mt-2 text-sm whitespace-pre-line break-words text-ink">{m.body}</p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function BookingContext({ booking }: { booking: NonNullable<AdminTicket["booking"]> }) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-bold text-ink">Booking this is about</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div><dt className="text-xs font-semibold text-ink-subtle">Service</dt><dd>{booking.service}</dd></div>
        <div><dt className="text-xs font-semibold text-ink-subtle">Booking status</dt><dd>{booking.status.toLowerCase().replaceAll("_", " ")}</dd></div>
        <div><dt className="text-xs font-semibold text-ink-subtle">Customer</dt><dd>{booking.customer.name}</dd></div>
        <div><dt className="text-xs font-semibold text-ink-subtle">Professional</dt><dd>{booking.worker.displayName ?? "(no display name)"}</dd></div>
      </dl>
      <Link href={`/admin/bookings/${booking.id}`} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-800 hover:underline">Open the booking</Link>
    </Card>
  );
}

function ReplyBox({ ticket, closed, onSent }: { ticket: AdminTicket; closed: boolean; onSent: () => void }) {
  const id = useId();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const empty = body.trim().length === 0;

  if (closed) return <Alert tone="info">This ticket is closed, so it cannot be answered.</Alert>;

  async function send() {
    if (empty || pending) return;
    setPending(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await api(`/admin/support/tickets/${ticket.id}/messages`, { method: "POST", body: { body: body.trim(), internal } });
      setNotice(internal ? "Internal note added. The requester cannot see it." : "Reply sent. The requester was notified.");
      setBody("");
      onSent();
    } catch (e) {
      setError(ticketErrorMessage(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-label="Reply" className="space-y-3">
      <h2 className="text-lg font-bold text-ink">Reply</h2>
      <TextArea
        id={`${id}-body`}
        label={internal ? "Internal note" : "Reply to the requester"}
        hint={internal ? "Only staff can see an internal note." : "The requester is notified and sees this reply."}
        value={body}
        maxLength={4000}
        onChange={(e) => setBody(e.target.value)}
        disabled={pending}
        className={internal ? "border-amber-400 bg-warning-soft" : undefined}
      />
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} disabled={pending} className="size-4" />
        Internal note (not shown to the user)
      </label>
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}
      <Button onClick={send} loading={pending} disabled={empty}>{internal ? "Add internal note" : "Send reply"}</Button>
    </section>
  );
}

function Controls({ ticket, onChanged }: { ticket: AdminTicket; onChanged: () => void }) {
  const [notice, setNotice] = useState<string>();
  const done = (message: string) => { setNotice(message); onChanged(); };
  return (
    <Card className="space-y-5 p-4">
      <h2 className="text-sm font-bold text-ink">Handle this ticket</h2>
      <div aria-live="polite">{notice && <Alert tone="success">{notice}</Alert>}</div>
      <StatusControl ticket={ticket} onDone={done} />
      <PriorityControl ticket={ticket} onDone={done} />
      <AssigneeControl ticket={ticket} onDone={done} />
    </Card>
  );
}

function useSave(ticketId: string, onDone: (message: string) => void) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  /** Resolves to true when the server accepted the change. */
  async function save(patch: Record<string, unknown>, message: string): Promise<boolean> {
    setPending(true);
    setError(undefined);
    try {
      await api(`/admin/support/tickets/${ticketId}`, { method: "PATCH", body: patch });
      onDone(message);
      return true;
    } catch (e) {
      setError(ticketErrorMessage(e));
      return false;
    } finally {
      setPending(false);
    }
  }
  return { save, pending, error, setError };
}

function StatusControl({ ticket, onDone }: { ticket: AdminTicket; onDone: (m: string) => void }) {
  const id = useId();
  const [next, setNext] = useState<TicketStatus | "">("");
  const [resolution, setResolution] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const { save, pending, error } = useSave(ticket.id, onDone);
  const label = (s: TicketStatus) => STAFF_STATUS[s].label;

  if (ticket.allowedNext.length === 0) {
    return <p className="text-sm text-ink-muted">Status: {label(ticket.status)}. A closed ticket is final and cannot change.</p>;
  }
  const resolving = next === "RESOLVED";
  const short = resolving && resolution.trim().length < 5;

  async function apply() {
    if (!next) return;
    if (next === "CLOSED") { setConfirmClose(true); return; }
    const ok = await save(resolving ? { status: next, resolution: resolution.trim() } : { status: next }, `Status changed to ${label(next).toLowerCase()}.`);
    if (ok) { setNext(""); setResolution(""); }
  }

  return (
    <div className="space-y-3">
      <SelectInput id={`${id}-status`} label={`Status (now ${label(ticket.status).toLowerCase()})`} placeholder="Choose a new status" value={next} onChange={(e) => setNext(e.target.value as TicketStatus | "")}
        options={ticket.allowedNext.map((s) => ({ value: s, label: label(s) }))} />
      {resolving && (
        <TextArea id={`${id}-resolution`} label="Resolution (shown to the requester)" hint="At least 5 characters. The requester is notified with this text." value={resolution} maxLength={2000} onChange={(e) => setResolution(e.target.value)} className="min-h-24" />
      )}
      {error && <Alert tone="error">{error}</Alert>}
      <Button variant="secondary" onClick={apply} loading={pending} disabled={!next || short}>Change status</Button>
      <ConfirmDialog
        open={confirmClose}
        title="Close this ticket?"
        confirmLabel="Close ticket"
        tone="danger"
        onClose={() => setConfirmClose(false)}
        onConfirm={async () => {
          await api(`/admin/support/tickets/${ticket.id}`, { method: "PATCH", body: { status: "CLOSED" } }).catch((e: unknown) => { throw new Error(ticketErrorMessage(e)); });
          setNext("");
          onDone("Ticket closed.");
        }}
      >
        A closed ticket is final: nobody can reply to it or reopen it. The requester would have to open a new request.
      </ConfirmDialog>
    </div>
  );
}

function PriorityControl({ ticket, onDone }: { ticket: AdminTicket; onDone: (m: string) => void }) {
  const id = useId();
  const [value, setValue] = useState<TicketPriority>(ticket.priority);
  const { save, pending, error } = useSave(ticket.id, onDone);
  return (
    <div className="space-y-3">
      <SelectInput id={`${id}-priority`} label="Priority" placeholder={null} value={value} onChange={(e) => setValue(e.target.value as TicketPriority)}
        options={TICKET_PRIORITIES.map((p) => ({ value: p, label: PRIORITY[p].label }))} />
      {error && <Alert tone="error">{error}</Alert>}
      <Button variant="secondary" loading={pending} disabled={value === ticket.priority} onClick={() => void save({ priority: value }, `Priority set to ${PRIORITY[value].label.toLowerCase()}.`)}>Change priority</Button>
    </div>
  );
}

function AssigneeControl({ ticket, onDone }: { ticket: AdminTicket; onDone: (m: string) => void }) {
  const id = useId();
  const { me } = useAdmin();
  const { state } = useApi<{ staff: { id: string; name: string }[] }>("/admin/support/assignees");
  const [value, setValue] = useState(ticket.assignee?.id ?? "");
  const { save, pending, error } = useSave(ticket.id, onDone);
  const staff = state.status === "ready" ? state.data.staff : [];
  // Keep the current assignee selectable even if they are no longer in the list of active staff.
  const options = [...staff, ...(ticket.assignee && !staff.some((s) => s.id === ticket.assignee!.id) ? [ticket.assignee] : [])].map((s) => ({ value: s.id, label: s.name }));
  const current = ticket.assignee?.id ?? "";
  const meInList = staff.some((s) => s.id === me.user.id);
  return (
    <div className="space-y-3">
      <SelectInput id={`${id}-assignee`} label="Assignee" placeholder="Unassigned" value={value} onChange={(e) => setValue(e.target.value)} options={options}
        hint={state.status === "error" ? `Could not load staff: ${state.message}` : undefined} disabled={state.status === "loading"} />
      {error && <Alert tone="error">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" loading={pending} disabled={value === current} onClick={() => void save({ assigneeId: value || null }, value ? "Assignee changed." : "Ticket unassigned.")}>Change assignee</Button>
        {meInList && current !== me.user.id && (
          <Button variant="ghost" disabled={pending} onClick={() => { setValue(me.user.id); void save({ assigneeId: me.user.id }, "Assigned to you."); }}>Assign to me</Button>
        )}
      </div>
    </div>
  );
}

