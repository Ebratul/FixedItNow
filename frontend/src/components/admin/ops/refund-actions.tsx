"use client";

import { useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { TypedConfirmDialog } from "@/components/admin/kit";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { api } from "@/lib/api";
import { formatBdt } from "@/lib/format";
import { FormDialog, errorText, providerLabel } from "./shared";

export type RefundLite = { id: string; status: string; requestedAmountBdt: number; approvedAmountBdt: number | null };
type RefundResponse = { refund: { status: string } };

/** What the API says happened, never what we hoped would happen. */
export function outcomeMessage(status: string): string {
  switch (status) {
    case "SUCCEEDED": return "The provider confirmed the refund. It is now recorded as refunded.";
    case "PROCESSING": return "The request was sent to the provider, but the refund is NOT complete until the provider confirms it. Use “Re-check with provider” later.";
    case "FAILED": return "The provider did not complete this refund. It is marked failed and no money was refunded.";
    case "APPROVED": return "Approved. No money has moved yet: send it to the payment provider to start the refund.";
    case "REJECTED": return "The refund was rejected. No money was refunded.";
    default: return `The refund is now ${status.toLowerCase().replaceAll("_", " ")}.`;
  }
}

/** Parse a whole-taka amount box. Empty is allowed (means "the full amount"). */
function amountProblem(text: string, max: number): string | undefined {
  const t = text.trim();
  if (!t) return undefined;
  if (!/^\d+$/.test(t)) return "Enter whole taka, digits only.";
  const n = Number(t);
  if (n < 1 || n > max) return `Enter an amount from ৳1 to ${formatBdt(max)}.`;
  return undefined;
}

/**
 * Per-refund actions, shown by status AND permission. `can()` only hides buttons: the server enforces.
 * Sending a refund to the provider moves real money and needs the payment reference typed in.
 */
export function RefundActions({ refund, reference, provider, onChanged }: { refund: RefundLite; reference: string; provider: string; onChanged: (message: string) => void }) {
  const { can } = useAdmin();
  const [dialog, setDialog] = useState<"approve" | "reject" | "process" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const decide = can("refunds.decide");
  const process = can("refunds.process");
  const reconcile = can("payments.reconcile");

  async function recheck() {
    setBusy(true);
    setError(undefined);
    try {
      const res = await api<RefundResponse>(`/admin/refunds/${refund.id}/reconcile`, { method: "POST", body: {} });
      onChanged(`Checked with ${providerLabel(provider)}. ${outcomeMessage(res.refund.status)}`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const show = {
    approve: refund.status === "REQUESTED" && decide,
    reject: (refund.status === "REQUESTED" || refund.status === "APPROVED") && decide,
    process: refund.status === "APPROVED" && process,
    recheck: refund.status === "PROCESSING" && reconcile,
  };
  if (!show.approve && !show.reject && !show.process && !show.recheck) return null;
  const close = () => setDialog(null);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {show.approve && <Button size="sm" onClick={() => setDialog("approve")}>Approve</Button>}
        {show.process && <Button size="sm" onClick={() => setDialog("process")}>Send to payment provider</Button>}
        {show.recheck && <Button size="sm" variant="secondary" loading={busy} onClick={recheck}>Re-check with provider</Button>}
        {show.reject && <Button size="sm" variant="secondary" onClick={() => setDialog("reject")}>Reject</Button>}
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      {dialog === "approve" && <ApproveDialog refund={refund} onClose={close} onChanged={onChanged} />}
      {dialog === "reject" && <RejectDialog refund={refund} onClose={close} onChanged={onChanged} />}
      {dialog === "process" && <ProcessDialog refund={refund} reference={reference} provider={provider} onClose={close} onChanged={onChanged} />}
    </div>
  );
}

type DialogProps = { refund: RefundLite; onClose: () => void; onChanged: (message: string) => void };

function ApproveDialog({ refund, onClose, onChanged }: DialogProps) {
  const amountId = useId();
  const noteId = useId();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const problem = amountProblem(amount, refund.requestedAmountBdt);
  const noteTrim = note.trim();
  return (
    <FormDialog
      title="Approve refund"
      submitLabel="Approve refund"
      onClose={onClose}
      canSubmit={!problem}
      onSubmit={async () => {
        const body: Record<string, unknown> = { confirm: true };
        if (amount.trim()) body.amountBdt = Number(amount.trim());
        if (noteTrim) body.note = noteTrim;
        const res = await api<RefundResponse>(`/admin/refunds/${refund.id}/approve`, { method: "POST", body });
        onChanged(outcomeMessage(res.refund.status));
      }}
    >
      <p className="text-sm text-ink-muted">Approving records the platform&apos;s decision. It does <strong>not</strong> move money: a separate step sends it to the payment provider.</p>
      <TextInput id={amountId} label={`Amount to refund (৳, up to ${formatBdt(refund.requestedAmountBdt)})`} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(refund.requestedAmountBdt)} hint="Leave empty to approve the full requested amount." error={problem} />
      <TextArea id={noteId} label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-20" />
    </FormDialog>
  );
}

function RejectDialog({ refund, onClose, onChanged }: DialogProps) {
  const noteId = useId();
  const [note, setNote] = useState("");
  const trimmed = note.trim();
  return (
    <FormDialog
      title="Reject refund"
      submitLabel="Reject refund"
      tone="danger"
      onClose={onClose}
      canSubmit={trimmed.length >= 3}
      onSubmit={async () => {
        const res = await api<RefundResponse>(`/admin/refunds/${refund.id}/reject`, { method: "POST", body: { note: trimmed } });
        onChanged(outcomeMessage(res.refund.status));
      }}
    >
      <p className="text-sm text-ink-muted">The customer is not refunded and this refund cannot be reopened.</p>
      <TextArea id={noteId} label="Reason for rejecting (shown to the customer)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} hint="3 to 500 characters." error={note.length > 0 && trimmed.length < 3 ? "Use at least 3 characters." : undefined} className="min-h-24" autoFocus />
    </FormDialog>
  );
}

function ProcessDialog({ refund, reference, provider, onClose, onChanged }: DialogProps & { reference: string; provider: string }) {
  const amount = refund.approvedAmountBdt ?? refund.requestedAmountBdt;
  return (
    <TypedConfirmDialog
      open
      title="Send refund to the payment provider"
      phrase={reference}
      confirmLabel={`Refund ${formatBdt(amount)} now`}
      onClose={onClose}
      onConfirm={async () => {
        const res = await api<RefundResponse>(`/admin/refunds/${refund.id}/process`, { method: "POST", body: { confirm: true } });
        onChanged(outcomeMessage(res.refund.status));
      }}
    >
      <div className="space-y-2">
        <p><strong>This moves real money.</strong> {formatBdt(amount)} will be refunded to the customer through {providerLabel(provider)}. It cannot be undone from this page.</p>
        <p>The refund counts as done only when the provider confirms it. If the provider does not answer, it stays “Processing” and you can re-check it later; it is never sent twice automatically.</p>
        <p>Some providers have automatic refunds switched off. If so, the server refuses with its own message (REFUNDS_NOT_SUPPORTED) and the refund stays approved.</p>
      </div>
    </TypedConfirmDialog>
  );
}

/** Admin-created refund (already approved on creation; still needs “Send to payment provider”). */
export function CreateRefundDialog({ reference, maxBdt, onClose, onChanged }: { reference: string; maxBdt: number; onClose: () => void; onChanged: (message: string) => void }) {
  const amountId = useId();
  const reasonId = useId();
  // One key per opening of the dialog: a double click or retry replays the same refund instead of creating two.
  const [key] = useState(() => crypto.randomUUID());
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const problem = maxBdt > 0 ? amountProblem(amount, maxBdt) : undefined;
  const reasonTrim = reason.trim();
  const reasonProblem = reason.length > 0 && reasonTrim.length < 10 ? "Use at least 10 characters." : undefined;
  return (
    <FormDialog
      title="Create refund"
      submitLabel="Create refund"
      onClose={onClose}
      canSubmit={!problem && reasonTrim.length >= 10}
      onSubmit={async () => {
        const body: Record<string, unknown> = { reason: reasonTrim, confirm: true };
        if (amount.trim()) body.amountBdt = Number(amount.trim());
        await api<RefundResponse>(`/admin/payments/${encodeURIComponent(reference)}/refunds`, { method: "POST", body, headers: { "Idempotency-Key": key } });
        onChanged("Refund created and approved. No money has moved yet: send it to the payment provider from the refund list below.");
      }}
    >
      <p className="text-sm text-ink-muted">An administrator-created refund is approved straight away. It is only sent to the payment provider in a separate, confirmed step.</p>
      <TextInput id={amountId} label={`Amount (৳, up to ${formatBdt(maxBdt)})`} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(maxBdt)} hint="Leave empty to refund everything that is still refundable." error={problem} />
      <TextArea id={reasonId} label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} hint="10 to 500 characters. Recorded with the refund." error={reasonProblem} className="min-h-24" autoFocus />
    </FormDialog>
  );
}
