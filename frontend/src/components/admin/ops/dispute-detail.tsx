"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TextArea } from "@/components/ui/text-area";
import { ApiView, StatusBadge } from "@/components/admin/kit";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { api } from "@/lib/api";
import { EVENT_LABELS, formatBdt, formatDateTime, STATUS_LABELS } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { BackLink, DISPUTE_STATUS, Fact, FormDialog, Section, humanize } from "./shared";

type Detail = {
  dispute: {
    id: string;
    status: string;
    category: string;
    description: string;
    openedByRole: string;
    previousBookingStatus: string;
    outcome: string | null;
    resolution: string | null;
    resolvedAt: string | null;
    assignedAdminId: string | null;
    createdAt: string;
    messages: { id: string; authorRole: string; body: string; internal: boolean; createdAt: string }[];
  };
  booking: {
    id: string;
    status: string;
    category: { name: string; slug: string } | null;
    description: string | null;
    serviceArea: string | null;
    serviceAddress: string | null;
    startAt: string;
    endAt: string;
    agreedAmountBdt: number | null;
    currency: string;
    customerName: string;
    workerName: string;
  };
  quotes: { id: string; status: string; totalBdt: number; createdAt: string }[];
  events: { type: string; actorRole: string | null; fromStatus: string | null; toStatus: string | null; reason: string | null; createdAt: string }[];
};

const bookingStatus = STATUS_LABELS as Record<string, { label: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" }>;

/**
 * The API does not return a list of allowed actions, so this mirrors the server's dispute state machine
 * (backend dispute.state.ts). It only decides which buttons to SHOW; the server re-checks every action
 * and its message is displayed if the dispute changed in the meantime.
 */
export function allowedDisputeActions(status: string) {
  const active = status === "OPEN" || status === "UNDER_REVIEW" || status === "WAITING_FOR_INFORMATION";
  return {
    review: status === "OPEN",
    requestInfo: status === "UNDER_REVIEW",
    message: active,
    decide: status === "UNDER_REVIEW" || status === "WAITING_FOR_INFORMATION",
  };
}

export const OUTCOMES = [
  { value: "MARK_COMPLETED", label: "Mark the booking completed", plain: "The job counts as done. The booking becomes Completed." },
  { value: "CANCEL_BOOKING", label: "Cancel the booking", plain: "The booking becomes Cancelled. Any payment on it is flagged for review; nothing is refunded automatically, so a refund must be created separately." },
  { value: "RESTORE_BOOKING", label: "Restore the booking", plain: "The booking returns to the status it had before the dispute was opened, as if the dispute never paused it." },
] as const;

export function DisputeDetail({ id }: { id: string }) {
  const { state, reload, refresh } = useApi<Detail>(`/admin/disputes/${id}`);
  const [notice, setNotice] = useState<string>();
  return (
    <div className="space-y-6">
      <BackLink href="/admin/disputes">All disputes</BackLink>
      {notice && <Alert tone="success">{notice}</Alert>}
      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-96" />}>
        {(data) => <Body data={data} onDone={(message) => { setNotice(message); refresh(); }} />}
      </ApiView>
    </div>
  );
}

function Body({ data, onDone }: { data: Detail; onDone: (message: string) => void }) {
  const { dispute: d, booking: b } = data;
  return (
    <>
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-extrabold text-brand-950">{humanize(d.category)}</h2>
          <StatusBadge value={d.status} map={DISPUTE_STATUS} />
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Opened by">{humanize(d.openedByRole)} on {formatDateTime(d.createdAt)}</Fact>
          <Fact label="Reviewer">{d.assignedAdminId ? "An administrator is assigned" : "Unassigned"}</Fact>
          <Fact label="Booking status before the dispute">{bookingStatus[d.previousBookingStatus]?.label ?? humanize(d.previousBookingStatus)}</Fact>
          {d.outcome && <Fact label="Outcome">{humanize(d.outcome)}</Fact>}
          {d.resolvedAt && <Fact label="Decided">{formatDateTime(d.resolvedAt)}</Fact>}
        </dl>
        <div>
          <p className="text-xs font-semibold text-ink-subtle">What was reported</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{d.description}</p>
        </div>
        {d.resolution && (
          <div>
            <p className="text-xs font-semibold text-ink-subtle">Decision shown to the parties</p>
            <p className="mt-1 whitespace-pre-wrap break-words">{d.resolution}</p>
          </div>
        )}
      </Card>

      <Actions disputeId={d.id} status={d.status} onDone={onDone} />

      <Section title="Messages">
        {d.messages.length === 0 ? (
          <p className="text-sm text-ink-muted">No messages yet.</p>
        ) : (
          <ul className="space-y-3">
            {d.messages.map((m) => (
              <li key={m.id} className={`rounded-card border p-4 ${m.internal ? "border-amber-300 bg-warning-soft" : "border-line bg-canvas"}`}>
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-bold">{humanize(m.authorRole)}</span>
                  {m.internal && <Badge tone="warning"><Lock className="size-3" aria-hidden /> Internal note: not visible to the customer or professional</Badge>}
                  <span className="text-ink-muted">{formatDateTime(m.createdAt)}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words">{m.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Booking summary">
        <Card className="space-y-3 p-5">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label="Service">{b.category?.name ?? "Unknown"}</Fact>
            <Fact label="Status"><StatusBadge value={b.status} map={bookingStatus} /></Fact>
            <Fact label="Agreed amount">{b.agreedAmountBdt === null ? "Not agreed" : formatBdt(b.agreedAmountBdt)}</Fact>
            <Fact label="Customer">{b.customerName}</Fact>
            <Fact label="Professional">{b.workerName}</Fact>
            <Fact label="Appointment">{formatDateTime(b.startAt)}</Fact>
            <Fact label="Service area">{b.serviceArea ?? "Not set"}</Fact>
            <Fact label="Address">{b.serviceAddress ?? "Not set"}</Fact>
          </dl>
          {b.description && <p className="whitespace-pre-wrap break-words text-sm text-ink-muted">{b.description}</p>}
          <Link href={`/admin/bookings/${b.id}`} className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline">Open the full booking</Link>
        </Card>
        {data.quotes.length > 0 && (
          <ul className="divide-y divide-line rounded-card border border-line bg-canvas text-sm">
            {data.quotes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span className="font-semibold">Quote {formatBdt(q.totalBdt)}</span>
                <Badge>{humanize(q.status)}</Badge>
                <span className="text-ink-muted">{formatDateTime(q.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Booking history">
        <ol className="space-y-3 border-l-2 border-line pl-4">
          {data.events.map((e, i) => (
            <li key={`${e.createdAt}-${i}`}>
              <p className="font-semibold">{EVENT_LABELS[e.type] ?? humanize(e.type)}</p>
              <p className="text-sm text-ink-muted">{formatDateTime(e.createdAt)}{e.actorRole ? ` · by ${humanize(e.actorRole)}` : ""}</p>
              {e.reason && <p className="text-sm break-words">Reason: {e.reason}</p>}
            </li>
          ))}
        </ol>
      </Section>
    </>
  );
}

type Dialogs = "info" | "message" | "resolve" | "reject" | null;

function Actions({ disputeId, status, onDone }: { disputeId: string; status: string; onDone: (message: string) => void }) {
  const { can } = useAdmin();
  const allowed = allowedDisputeActions(status);
  const [dialog, setDialog] = useState<Dialogs>(null);
  const [startError, setStartError] = useState<string>();
  const [starting, setStarting] = useState(false);
  if (!can("disputes.manage")) return null;
  if (!allowed.review && !allowed.requestInfo && !allowed.message && !allowed.decide) {
    return <Alert tone="info">This dispute is closed. No further actions are available.</Alert>;
  }

  async function startReview() {
    setStarting(true);
    setStartError(undefined);
    try {
      await api(`/admin/disputes/${disputeId}/review`, { method: "POST", body: {} });
      onDone("Review started. You are now the assigned reviewer.");
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Could not start the review.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <Section title="Actions" description="Everything you do here is recorded in the audit log. Messages marked internal are never shown to the customer or the professional.">
      <div className="flex flex-wrap gap-3">
        {allowed.review && <Button onClick={startReview} loading={starting}>Start review</Button>}
        {allowed.requestInfo && <Button variant="secondary" onClick={() => setDialog("info")}>Ask for information</Button>}
        {allowed.message && <Button variant="secondary" onClick={() => setDialog("message")}>Add message</Button>}
        {allowed.decide && <Button onClick={() => setDialog("resolve")}>Resolve</Button>}
        {allowed.decide && <Button variant="secondary" onClick={() => setDialog("reject")}>Reject</Button>}
      </div>
      {startError && <Alert tone="error">{startError}</Alert>}
      {dialog === "info" && <AskInfo disputeId={disputeId} onClose={() => setDialog(null)} onDone={onDone} />}
      {dialog === "message" && <AddMessage disputeId={disputeId} onClose={() => setDialog(null)} onDone={onDone} />}
      {(dialog === "resolve" || dialog === "reject") && <Decide mode={dialog} disputeId={disputeId} onClose={() => setDialog(null)} onDone={onDone} />}
    </Section>
  );
}

type SubProps = { disputeId: string; onClose: () => void; onDone: (message: string) => void };

function AskInfo({ disputeId, onClose, onDone }: SubProps) {
  const id = useId();
  const [message, setMessage] = useState("");
  const trimmed = message.trim();
  return (
    <FormDialog
      title="Ask for information"
      submitLabel="Send request"
      onClose={onClose}
      canSubmit={trimmed.length >= 5}
      onSubmit={async () => {
        await api(`/admin/disputes/${disputeId}/request-info`, { method: "POST", body: { message: trimmed } });
        onDone("Your request was sent and the dispute is now waiting for information.");
      }}
    >
      <p className="text-sm text-ink-muted">The dispute moves to “Waiting for information” and the parties see this message.</p>
      <TextArea id={id} label="What do you need to know?" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} hint="5 to 2000 characters." error={message.length > 0 && trimmed.length < 5 ? "Use at least 5 characters." : undefined} autoFocus />
    </FormDialog>
  );
}

function AddMessage({ disputeId, onClose, onDone }: SubProps) {
  const id = useId();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const trimmed = body.trim();
  return (
    <FormDialog
      title="Add message"
      submitLabel={internal ? "Add internal note" : "Send message"}
      onClose={onClose}
      canSubmit={trimmed.length >= 1}
      onSubmit={async () => {
        await api(`/admin/disputes/${disputeId}/messages`, { method: "POST", body: { body: trimmed, internal } });
        onDone(internal ? "Internal note added. Only administrators can see it." : "Message sent to the parties.");
      }}
    >
      <TextArea id={id} label="Message" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} hint="Up to 2000 characters." autoFocus />
      <label className="flex min-h-11 items-start gap-3 text-sm">
        <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="mt-1 size-5" />
        <span><span className="font-semibold">Internal note.</span> Only administrators will see it; the customer and professional will not.</span>
      </label>
    </FormDialog>
  );
}

/** Resolve or reject: fill in the decision, then confirm it in a second dialog that states the consequence. */
function Decide({ mode, disputeId, onClose, onDone }: SubProps & { mode: "resolve" | "reject" }) {
  const id = useId();
  const [stage, setStage] = useState<"form" | "confirm">("form");
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]["value"]>("RESTORE_BOOKING");
  const [resolution, setResolution] = useState("");
  const trimmed = resolution.trim();
  const valid = trimmed.length >= 10;
  const chosen = OUTCOMES.find((o) => o.value === outcome)!;

  async function submit() {
    if (mode === "resolve") {
      await api(`/admin/disputes/${disputeId}/resolve`, { method: "POST", body: { outcome, resolution: trimmed } });
      onDone(`Dispute resolved: ${chosen.label.toLowerCase()}.`);
    } else {
      await api(`/admin/disputes/${disputeId}/reject`, { method: "POST", body: { resolution: trimmed } });
      onDone("Dispute rejected and the booking restored to its earlier status.");
    }
  }

  if (stage === "confirm") {
    return (
      <ConfirmDialog
        open
        title={mode === "resolve" ? "Resolve this dispute?" : "Reject this dispute?"}
        confirmLabel={mode === "resolve" ? "Resolve dispute" : "Reject dispute"}
        tone="danger"
        onClose={() => setStage("form")}
        onConfirm={async () => {
          await submit();
          onClose();
        }}
      >
        <div className="space-y-2">
          <p>{mode === "resolve" ? chosen.plain : "The dispute is closed without action and the booking returns to the status it had before the dispute."}</p>
          <p>This decision is final and is shown to the customer and the professional:</p>
          <blockquote className="rounded-control bg-surface p-3 whitespace-pre-wrap break-words text-ink">{trimmed}</blockquote>
        </div>
      </ConfirmDialog>
    );
  }

  return (
    <FormDialog
      title={mode === "resolve" ? "Resolve dispute" : "Reject dispute"}
      submitLabel="Continue"
      onClose={onClose}
      canSubmit={valid}
      onNext={() => setStage("confirm")}
    >
      {mode === "resolve" ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Outcome</legend>
          {OUTCOMES.map((o) => (
            <label key={o.value} className="flex min-h-11 items-start gap-3 rounded-control border border-line p-3 text-sm has-[:checked]:border-brand-600 has-[:checked]:bg-brand-50">
              <input type="radio" name={`${id}-outcome`} value={o.value} checked={outcome === o.value} onChange={() => setOutcome(o.value)} className="mt-1 size-4" />
              <span><span className="font-semibold">{o.label}.</span> {o.plain}</span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="text-sm text-ink-muted">Rejecting means the dispute is not upheld. The booking is restored to the status it had before the dispute.</p>
      )}
      <TextArea id={id} label={mode === "resolve" ? "Resolution (shown to both parties)" : "Reason (shown to both parties)"} value={resolution} onChange={(e) => setResolution(e.target.value)} maxLength={2000} hint="10 to 2000 characters." error={resolution.length > 0 && !valid ? "Use at least 10 characters." : undefined} />
    </FormDialog>
  );
}
