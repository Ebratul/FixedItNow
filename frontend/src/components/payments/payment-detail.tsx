"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Receipt } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { api, ApiError } from "@/lib/api";
import { formatBdt, formatDateTime } from "@/lib/format";
import { describePayment, EVENT_COPY, isOpen, PROVIDER_LABELS, REFUND_COPY } from "@/lib/payment-status";
import type { PaymentDetail } from "@/lib/payment-types";
import { PaymentBadge } from "./payment-badge";

const POLL_MS = 3000;
const MAX_POLLS = 40;

export function PaymentDetailView({ reference }: { reference: string }) {
  return <AuthGate>{() => <Loader reference={reference} />}</AuthGate>;
}

function Loader({ reference }: { reference: string }) {
  const [data, setData] = useState<PaymentDetail>();
  const [error, setError] = useState<string>();
  const [gaveUp, setGaveUp] = useState(false);
  // Bumped after EVERY attempt, successful or not, so a failed poll still schedules the next one.
  const [attempts, setAttempts] = useState(0);
  const polls = useRef(0);
  const returned = useSearchParams().get("returned") === "1";

  const load = useCallback(async () => {
    try {
      setData(await api<PaymentDetail>(`/payments/${reference}`));
      setError(undefined);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? "NOT_FOUND" : e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setAttempts((n) => n + 1);
    }
  }, [reference]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of server state
    void load();
  }, [load]);

  // While the outcome is open, keep asking the SERVER. A URL like ?status=success is never consulted.
  const status = data?.payment.status;
  useEffect(() => {
    if (!status || !isOpen(status)) return;
    if (polls.current >= MAX_POLLS) {
      setGaveUp(true);
      return;
    }
    const timer = setTimeout(() => {
      polls.current += 1;
      void load();
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [status, data, attempts, load]);

  if (error === "NOT_FOUND") {
    return <EmptyState icon={Receipt} headingLevel={1} title="Payment not found" action={<LinkButton href="/payments">Your payments</LinkButton>}>This payment does not exist, or it belongs to someone else.</EmptyState>;
  }
  if (error && !data) return <ErrorState action={<Button onClick={load}>Try again</Button>}>{error}</ErrorState>;
  if (!data) return <div aria-busy="true" aria-label="Loading payment" className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-48" /></div>;
  return <Detail data={data} reload={load} returned={returned} gaveUp={gaveUp} refreshFailed={Boolean(error)} />;
}

export function Detail({ data, reload, returned, gaveUp = false, refreshFailed = false }: { data: PaymentDetail; reload: () => void | Promise<void>; returned: boolean; gaveUp?: boolean; refreshFailed?: boolean }) {
  const { payment } = data;
  const copy = describePayment(payment);
  const open = isOpen(payment.status);
  const openRefund = payment.refunds?.some((r) => ["REQUESTED", "APPROVED", "PROCESSING"].includes(r.status));

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h1 font-extrabold text-brand-950">Payment</h1>
          <PaymentBadge payment={payment} />
        </div>
        <p className="mt-2 text-lg text-ink-muted">{payment.booking.serviceName} with {payment.booking.workerName}</p>
      </div>

      <div role="status" aria-live="polite" className="space-y-3">
        <Alert tone={copy.alert} title={copy.headline}>{copy.message}</Alert>
        {refreshFailed && open && <Alert tone="warning">We could not refresh this payment just now. The last status shown may be out of date; we will keep trying.</Alert>}
        {returned && open && !gaveUp && !refreshFailed && <p className="text-sm text-ink-muted">Checking with the payment provider…</p>}
        {open && gaveUp && <Alert tone="info">Still waiting for the provider. You can leave this page; come back to your payments later to see the result.</Alert>}
        {payment.mode === "sandbox" && <Alert tone="warning" title="Test payment">This was made in the provider&apos;s test (sandbox) environment. No real money moved.</Alert>}
        {payment.status === "REQUIRES_REVIEW" && <p className="text-sm text-ink-muted">Keep this reference: <span className="font-mono">{payment.reference}</span>. Support contact details are not published yet; an administrator can look the payment up by it.</p>}
      </div>

      <Card className="p-6">
        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="font-semibold text-ink-muted">Amount</dt>
          <dd className="text-lg font-extrabold">{formatBdt(payment.amountBdt)} <span className="text-sm font-normal text-ink-subtle">{payment.currency}</span></dd>
          <dt className="font-semibold text-ink-muted">Method</dt>
          <dd>{PROVIDER_LABELS[payment.provider]}</dd>
          <dt className="font-semibold text-ink-muted">Reference</dt>
          <dd className="font-mono text-xs break-all">{payment.reference}</dd>
          {payment.providerTransactionId && (<><dt className="font-semibold text-ink-muted">Receipt number</dt><dd className="font-mono text-xs break-all">{payment.providerTransactionId}</dd></>)}
          <dt className="font-semibold text-ink-muted">Started</dt>
          <dd>{formatDateTime(payment.createdAt)}</dd>
          {payment.succeededAt && (<><dt className="font-semibold text-ink-muted">Verified</dt><dd>{formatDateTime(payment.succeededAt)}</dd></>)}
          {payment.refundedAmountBdt > 0 && (<><dt className="font-semibold text-ink-muted">Refunded</dt><dd>{formatBdt(payment.refundedAmountBdt)}</dd></>)}
        </dl>
        <p className="mt-4 text-sm"><Link href={`/bookings/${payment.booking.id}`} className="font-semibold text-brand-700 hover:underline">View the booking</Link></p>
      </Card>

      {(payment.status === "FAILED" || payment.status === "CANCELLED" || payment.status === "EXPIRED") && (
        <LinkButton href={`/bookings/${payment.booking.id}/pay`} variant="accent">Try paying again</LinkButton>
      )}

      {(payment.refunds?.length ?? 0) > 0 && (
        <section aria-labelledby="refunds-heading">
          <h2 id="refunds-heading" className="text-h2 font-extrabold">Refund requests</h2>
          <ul className="mt-4 space-y-3">
            {payment.refunds!.map((r) => {
              const rc = REFUND_COPY[r.status];
              return (
                <li key={r.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-bold">{formatBdt(r.approvedAmountBdt ?? r.requestedAmountBdt)}</p>
                      <Badge tone={rc.tone}>{rc.label}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-ink-muted">{rc.detail}</p>
                    <p className="mt-2 text-sm text-ink-subtle">“{r.reason}”</p>
                    {r.decisionNote && <p className="mt-1 text-sm text-ink-subtle">Note from our team: {r.decisionNote}</p>}
                    <p className="mt-2 text-xs text-ink-subtle">Requested {formatDateTime(r.createdAt)}</p>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {payment.refundableAmountBdt > 0 && !openRefund && (
        payment.booking.status === "CANCELLED"
          ? <RefundForm reference={payment.reference} refundable={payment.refundableAmountBdt} onDone={reload} />
          : <Alert tone="info" title="Refunds">A refund can be requested once the booking is cancelled. If something is wrong with the work, use “Report a problem” on the booking page instead.</Alert>
      )}

      {payment.events && payment.events.length > 0 && (
        <section aria-labelledby="payment-history-heading">
          <h2 id="payment-history-heading" className="text-h2 font-extrabold">History</h2>
          <ol className="mt-4 space-y-3 border-l-2 border-line pl-5">
            {payment.events.map((e, i) => (
              <li key={`${e.type}-${i}`} className="relative">
                <span aria-hidden className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-brand-600" />
                <p className="text-sm font-semibold">{EVENT_COPY[e.type] ?? e.type}</p>
                <p className="text-xs text-ink-subtle">{formatDateTime(e.createdAt)}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function RefundForm({ reference, refundable, onDone }: { reference: string; refundable: number; onDone: () => void | Promise<void> }) {
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const key = useRef(crypto.randomUUID());

  async function submit() {
    if (pending) return;
    const found: Record<string, string> = {};
    if (reason.trim().length < 10) found.reason = "Tell us why (at least 10 characters)";
    const n = amount.trim() === "" ? refundable : Number(amount);
    if (!Number.isInteger(n) || n < 1 || n > refundable) found.amountBdt = `Enter a whole amount from ৳1 to ৳${refundable}`;
    setErrors(found);
    if (Object.keys(found).length) return;
    setPending(true);
    setFormError(undefined);
    try {
      await api(`/payments/${reference}/refunds`, {
        method: "POST",
        body: { reason: reason.trim(), ...(amount.trim() === "" ? {} : { amountBdt: n }) },
        headers: { "Idempotency-Key": key.current },
      });
      await onDone();
    } catch (e) {
      if (e instanceof ApiError) setErrors(e.fieldErrors);
      setFormError(e instanceof Error ? e.message : "Something went wrong.");
      key.current = crypto.randomUUID();
    }
    setPending(false);
  }

  return (
    <Card className="p-5">
      <h2 className="text-lg font-bold">Request a refund</h2>
      <p className="mt-1 text-sm text-ink-muted">Cancelling does not refund you automatically. Our team reviews each request, and a refund only counts once the payment provider confirms it. Up to {formatBdt(refundable)} can be refunded.</p>
      <div className="mt-4 space-y-4">
        <TextArea id="refund-reason" label="Why are you asking for a refund?" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} error={errors.reason} className="min-h-24" />
        <TextInput id="refund-amount" label="Amount (৳, optional)" hint={`Leave empty to ask for the full ${formatBdt(refundable)}.`} inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} error={errors.amountBdt} className="max-w-48" />
      </div>
      {formError && <Alert tone="error" className="mt-4">{formError}</Alert>}
      <div className="mt-5"><Button onClick={submit} loading={pending}>Send refund request</Button></div>
    </Card>
  );
}
