"use client";

import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { api, ApiError } from "@/lib/api";
import type { BookingDetail, Quote } from "@/lib/booking-types";
import { formatBdt, formatDateTime } from "@/lib/format";

const QUOTE_TONES: Record<Quote["status"], BadgeTone> = {
  PENDING: "brand", ACCEPTED: "success", REJECTED: "neutral", WITHDRAWN: "neutral", EXPIRED: "neutral",
};

export function QuoteCard({
  quote,
  viewer,
  onAccept,
  onReject,
  onWithdraw,
}: {
  quote: Quote;
  viewer: "CUSTOMER" | "WORKER";
  onAccept: () => void;
  onReject: () => void;
  onWithdraw: () => void;
}) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-lg font-extrabold">{formatBdt(quote.totalBdt)}</p>
        <Badge tone={QUOTE_TONES[quote.status]}>{quote.status.charAt(0) + quote.status.slice(1).toLowerCase()}</Badge>
      </div>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
        <dt className="text-ink-subtle">Labour</dt><dd className="text-right">{formatBdt(quote.laborBdt)}</dd>
        {quote.materialsBdt > 0 && (<><dt className="text-ink-subtle">Materials</dt><dd className="text-right">{formatBdt(quote.materialsBdt)}</dd></>)}
        {quote.otherBdt > 0 && (<><dt className="text-ink-subtle">Other</dt><dd className="text-right">{formatBdt(quote.otherBdt)}</dd></>)}
      </dl>
      <p className="mt-3 text-sm whitespace-pre-line text-ink-muted">{quote.description}</p>
      {quote.terms && <p className="mt-2 text-sm text-ink-subtle"><span className="font-semibold">Terms:</span> {quote.terms}</p>}
      <p className="mt-2 text-xs text-ink-subtle">
        Sent {formatDateTime(quote.createdAt)}
        {quote.status === "PENDING" ? ` · valid until ${formatDateTime(quote.expiresAt)}` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        {quote.actions.includes("accept") && viewer === "CUSTOMER" && <Button variant="accent" onClick={onAccept}>Accept quote</Button>}
        {quote.actions.includes("reject") && viewer === "CUSTOMER" && <Button variant="secondary" onClick={onReject}>Reject</Button>}
        {quote.actions.includes("withdraw") && viewer === "WORKER" && <Button variant="secondary" onClick={onWithdraw}>Withdraw</Button>}
      </div>
    </Card>
  );
}

const whole = (v: string) => (v.trim() === "" ? 0 : Number(v));
const valid = (v: string) => v.trim() === "" || (/^\d{1,7}$/.test(v.trim()) && Number(v) <= 1_000_000);

/** Worker's quote form. The total shown is a preview; the server computes the real one. */
export function QuoteForm({ bookingId, revising, onDone, onCancel }: { bookingId: string; revising: boolean; onDone: (d: BookingDetail) => void; onCancel: () => void }) {
  const [labor, setLabor] = useState("");
  const [materials, setMaterials] = useState("");
  const [other, setOther] = useState("");
  const [description, setDescription] = useState("");
  const [terms, setTerms] = useState("");
  const [hours, setHours] = useState("48");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const total = [labor, materials, other].every(valid) ? whole(labor) + whole(materials) + whole(other) : null;

  async function submit() {
    if (pending) return;
    const found: Record<string, string> = {};
    if (!valid(labor) || labor.trim() === "") found.laborBdt = "Enter the labour cost in whole taka";
    if (!valid(materials)) found.materialsBdt = "Whole taka only";
    if (!valid(other)) found.otherBdt = "Whole taka only";
    if (total === null || total <= 0) found.laborBdt ||= "The total must be greater than zero";
    if (description.trim().length < 10) found.description = "Describe what the price covers (at least 10 characters)";
    setErrors(found);
    if (Object.keys(found).length) return;
    setPending(true);
    setFormError(undefined);
    try {
      const res = await api<BookingDetail>(`/bookings/${bookingId}/quotes`, {
        method: "POST",
        body: {
          laborBdt: whole(labor), materialsBdt: whole(materials), otherBdt: whole(other),
          description: description.trim(), terms: terms.trim() || null, validForHours: Number(hours),
        },
      });
      onDone(res);
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      setFormError(e instanceof Error ? e.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <Card className="p-5">
      <h3 className="text-lg font-bold">{revising ? "Revise your quote" : "Send a quote"}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <TextInput id="q-labor" label="Labour (৳)" inputMode="numeric" value={labor} onChange={(e) => setLabor(e.target.value)} error={errors.laborBdt} />
        <TextInput id="q-materials" label="Materials (৳)" inputMode="numeric" value={materials} onChange={(e) => setMaterials(e.target.value)} error={errors.materialsBdt} />
        <TextInput id="q-other" label="Other (৳)" inputMode="numeric" value={other} onChange={(e) => setOther(e.target.value)} error={errors.otherBdt} />
      </div>
      <p className="mt-3 text-sm" aria-live="polite">
        Total shown to the customer: <strong>{total !== null && total > 0 ? formatBdt(total) : "—"}</strong>
      </p>
      <div className="mt-4 space-y-4">
        <TextArea id="q-desc" label="What does this price include?" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} error={errors.description} className="min-h-24" />
        <TextInput id="q-terms" label="Terms (optional)" value={terms} onChange={(e) => setTerms(e.target.value)} maxLength={1000} error={errors.terms} />
        <SelectInput id="q-valid" label="Quote is valid for" placeholder="" options={[{ value: "24", label: "24 hours" }, { value: "48", label: "48 hours" }, { value: "72", label: "3 days" }, { value: "168", label: "7 days" }]} value={hours} onChange={(e) => setHours(e.target.value)} className="max-w-48" />
      </div>
      {formError && <Alert tone="error" className="mt-4">{formError}</Alert>}
      <div className="mt-5 flex gap-3">
        <Button onClick={submit} loading={pending}>{revising ? "Send revised quote" : "Send quote"}</Button>
        <Button variant="ghost" onClick={onCancel} disabled={pending}>Cancel</Button>
      </div>
    </Card>
  );
}
