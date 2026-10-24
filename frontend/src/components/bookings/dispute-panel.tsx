"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { SelectInput } from "@/components/ui/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import { TextArea } from "@/components/ui/text-area";
import { api } from "@/lib/api";
import type { BookingDetail, DisputeDetail } from "@/lib/booking-types";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";

export const DISPUTE_CATEGORIES = [
  { value: "SERVICE_QUALITY", label: "Quality of the work" },
  { value: "NO_SHOW", label: "Someone did not show up" },
  { value: "PRICE_DISAGREEMENT", label: "Disagreement about the price" },
  { value: "CONDUCT", label: "Conduct or safety" },
  { value: "OTHER", label: "Something else" },
];
const STATUS: Record<string, { label: string; tone: BadgeTone }> = {
  OPEN: { label: "Open", tone: "warning" },
  UNDER_REVIEW: { label: "Under review", tone: "brand" },
  WAITING_FOR_INFORMATION: { label: "Waiting for information", tone: "warning" },
  RESOLVED: { label: "Resolved", tone: "success" },
  REJECTED: { label: "Not upheld", tone: "neutral" },
  CLOSED: { label: "Closed", tone: "neutral" },
};

export function DisputeForm({ bookingId, onDone, onCancel }: { bookingId: string; onDone: (d: BookingDetail) => void; onCancel: () => void }) {
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit() {
    const found: Record<string, string> = {};
    if (!category) found.category = "Choose what the problem is about";
    if (description.trim().length < 20) found.description = "Explain what happened in at least 20 characters";
    setErrors(found);
    if (Object.keys(found).length) return;
    setPending(true);
    setError(undefined);
    try {
      onDone(await api<BookingDetail>(`/bookings/${bookingId}/disputes`, { method: "POST", body: { category, description: description.trim() } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPending(false);
    }
  }
  return (
    <Card className="p-5">
      <h3 className="text-lg font-bold">Report a problem</h3>
      <p className="mt-1 text-sm text-ink-muted">A FixedItNow reviewer will look at it. This pauses the booking until it is resolved. Text only: file attachments are not supported yet.</p>
      <div className="mt-4 space-y-4">
        <SelectInput id="dp-cat" label="What is it about?" placeholder="Choose…" options={DISPUTE_CATEGORIES} value={category} onChange={(e) => setCategory(e.target.value)} error={errors.category} />
        <TextArea id="dp-desc" label="What happened?" hint={`${description.trim().length}/2000 characters (at least 20).`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} error={errors.description} />
      </div>
      {error && <Alert tone="error" className="mt-4">{error}</Alert>}
      <div className="mt-5 flex gap-3">
        <Button onClick={submit} loading={pending}>Submit</Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </Card>
  );
}

/** Status, description, messages and (for the opener) withdrawal of a dispute. */
export function DisputePanel({ bookingId, viewer, onBookingChanged }: { bookingId: string; viewer: string; onBookingChanged: (d: BookingDetail) => void }) {
  const { state, reload } = useApi<DisputeDetail>(`/bookings/${bookingId}/dispute`);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<"send" | "withdraw" | null>(null);
  const [error, setError] = useState<string>();

  if (state.status === "loading") return <Skeleton className="h-40" />;
  if (state.status !== "ready") return <ErrorState action={<Button onClick={reload}>Try again</Button>}>We couldn&apos;t load the dispute.</ErrorState>;
  const { dispute } = state.data;
  const info = STATUS[dispute.status];
  const active = ["OPEN", "UNDER_REVIEW", "WAITING_FOR_INFORMATION"].includes(dispute.status);

  async function send() {
    if (message.trim().length < 1 || pending) return;
    setPending("send");
    setError(undefined);
    try {
      await api(`/bookings/${bookingId}/dispute/messages`, { method: "POST", body: { body: message.trim() } });
      setMessage("");
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(null);
    }
  }
  async function withdraw() {
    setPending("withdraw");
    setError(undefined);
    try {
      onBookingChanged(await api<BookingDetail>(`/bookings/${bookingId}/dispute/withdraw`, { method: "POST", body: {} }));
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(null);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">Dispute</h3>
        <Badge tone={info.tone}>{info.label}</Badge>
      </div>
      <p className="mt-1 text-sm text-ink-subtle">Opened {formatDateTime(dispute.createdAt)} by {dispute.openedByRole === "CUSTOMER" ? "the customer" : "the professional"} · {DISPUTE_CATEGORIES.find((c) => c.value === dispute.category)?.label}</p>
      <p className="mt-3 text-sm whitespace-pre-line text-ink-muted">{dispute.description}</p>
      {dispute.resolution && <Alert tone="info" title="Decision" className="mt-4">{dispute.resolution}</Alert>}
      {dispute.messages.length > 0 && (
        <ul className="mt-4 space-y-3" aria-label="Messages">
          {dispute.messages.map((m) => (
            <li key={m.id} className="rounded-card bg-surface p-3 text-sm">
              <p className="text-xs font-semibold text-ink-subtle">{m.authorRole === "ADMIN" ? "FixedItNow reviewer" : m.authorRole === viewer ? "You" : m.authorRole === "CUSTOMER" ? "Customer" : "Professional"} · {formatDateTime(m.createdAt)}</p>
              <p className="mt-1 whitespace-pre-line">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
      {active && (
        <div className="mt-4 space-y-3">
          <TextArea id="dp-msg" label="Add a message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} className="min-h-20" />
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex flex-wrap gap-3">
            <Button onClick={send} loading={pending === "send"} disabled={!message.trim()}>Send message</Button>
            {dispute.openedByRole === viewer && <Button variant="secondary" onClick={withdraw} loading={pending === "withdraw"}>Withdraw dispute</Button>}
          </div>
        </div>
      )}
    </Card>
  );
}
