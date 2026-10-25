"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TextInput } from "@/components/ui/text-input";
import { api } from "@/lib/api";
import type { BookingDetail, RescheduleRequest } from "@/lib/booking-types";
import { dhakaLocalToIso, formatRange } from "@/lib/format";
import { SlotPicker } from "./slot-picker";

const TONES: Record<RescheduleRequest["status"], BadgeTone> = { PENDING: "warning", ACCEPTED: "success", REJECTED: "neutral", WITHDRAWN: "neutral", EXPIRED: "neutral" };

export function RescheduleCard({ request, viewer, onAccept, onReject, onWithdraw, withdrawing = false }: { request: RescheduleRequest; viewer: string; onAccept: () => void; onReject: () => void; onWithdraw: () => void; withdrawing?: boolean }) {
  const mine = request.requestedByRole === viewer;
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">{mine ? "You asked" : request.requestedByRole === "CUSTOMER" ? "The customer asked" : "The professional asked"} to move this appointment</p>
        <Badge tone={TONES[request.status]}>{request.status.charAt(0) + request.status.slice(1).toLowerCase()}</Badge>
      </div>
      <p className="mt-2 text-sm text-ink-muted line-through">{formatRange(request.previousStartAt, request.previousEndAt)}</p>
      <p className="text-sm font-semibold">{formatRange(request.newStartAt, request.newEndAt)}</p>
      {request.reason && <p className="mt-2 text-sm text-ink-muted">“{request.reason}”</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        {request.actions.includes("accept") && <Button variant="accent" onClick={onAccept}>Accept new time</Button>}
        {request.actions.includes("reject") && <Button variant="secondary" onClick={onReject}>Decline</Button>}
        {request.actions.includes("withdraw") && <Button variant="secondary" onClick={onWithdraw} loading={withdrawing}>Withdraw request</Button>}
      </div>
    </Card>
  );
}

/** Ask to move a confirmed appointment. The original stays reserved until the other side accepts. */
export function RescheduleForm({ detail, onDone, onCancel }: { detail: BookingDetail; onDone: (d: BookingDetail) => void; onCancel: () => void }) {
  const { booking } = detail;
  const [startAt, setStartAt] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const slug = booking.worker.slug;

  async function submit() {
    const chosen = slug ? startAt : manual ? dhakaLocalToIso(manual) : null;
    if (!chosen) return setError("Choose the new time");
    if (reason.trim() && reason.trim().length < 5) return setError("Use at least 5 characters for the reason, or leave it empty");
    setPending(true);
    setError(undefined);
    try {
      onDone(await api<BookingDetail>(`/bookings/${booking.id}/reschedule`, { method: "POST", body: { newStartAt: chosen, ...(reason.trim() && { reason: reason.trim() }) } }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <h3 className="text-lg font-bold">Request a different time</h3>
      <p className="mt-1 text-sm text-ink-muted">The other person has to accept. Your current appointment stays as it is until then.</p>
      <div className="mt-4 space-y-4">
        {slug ? (
          <SlotPicker slug={slug} durationMinutes={booking.durationMinutes} value={startAt} onChange={setStartAt} />
        ) : (
          <TextInput id="rs-manual" type="datetime-local" label="New start time (Bangladesh time)" hint="Public times are unavailable for this professional right now; the server still checks the time." value={manual} onChange={(e) => setManual(e.target.value)} className="max-w-72" />
        )}
        <TextInput id="rs-reason" label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </div>
      {error && <Alert tone="error" className="mt-4">{error}</Alert>}
      <div className="mt-5 flex gap-3">
        <Button onClick={submit} loading={pending}>Send request</Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </Card>
  );
}
