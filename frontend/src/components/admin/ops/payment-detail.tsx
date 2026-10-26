"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiView, StatusBadge } from "@/components/admin/kit";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { api } from "@/lib/api";
import { formatBdt, formatDateTime, STATUS_LABELS } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { BackLink, Fact, PAYMENT_STATUS, REFUND_STATUS, Section, errorText, humanize, metadataText, providerLabel } from "./shared";
import { CreateRefundDialog, RefundActions } from "./refund-actions";

type PaymentDetailData = {
  reference: string;
  bookingId: string;
  provider: string;
  mode: "live" | "sandbox" | "simulated";
  status: string;
  amountBdt: number;
  currency: string;
  refundedAmountBdt: number;
  refundableAmountBdt: number;
  needsAttention: boolean;
  bookingIneligible: boolean;
  providerTransactionId: string | null;
  createdAt: string;
  succeededAt: string | null;
  reviewReason: string | null;
  failureCode: string | null;
  verificationAttempts: number;
  lastVerifiedAt: string | null;
  booking: { id: string; status: string; serviceName: string };
  refunds: { id: string; status: string; requestedAmountBdt: number; approvedAmountBdt: number | null; reason: string; decisionNote: string | null; createdAt: string; decidedAt: string | null; completedAt: string | null }[];
  events: { type: string; fromStatus: string | null; toStatus: string | null; actorRole: string | null; metadata: unknown; createdAt: string }[];
};

const REVIEW_REASONS: Record<string, string> = {
  AMOUNT_MISMATCH: "The amount the provider reports does not match the amount expected.",
  CURRENCY_MISMATCH: "The provider reports a different currency than expected.",
  REFERENCE_MISMATCH: "The provider's reference does not match this payment.",
  DUPLICATE_PAYMENT: "A second, verified payment arrived for a booking that was already paid. It is refundable.",
  PROVIDER_RISK_FLAG: "The provider flagged this payment as risky.",
  BOOKING_INELIGIBLE: "The customer paid successfully, but the booking was no longer payable (for example cancelled or in dispute).",
};
const bookingStatus = STATUS_LABELS as Record<string, { label: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" }>;

export function PaymentDetail({ reference }: { reference: string }) {
  const { state, reload, refresh } = useApi<{ payment: PaymentDetailData }>(`/admin/payments/${reference}`);
  return (
    <div className="space-y-6">
      <BackLink href="/admin/payments">All payments</BackLink>
      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-96" />}>
        {({ payment }) => <Body p={payment} onChanged={refresh} />}
      </ApiView>
    </div>
  );
}

function Body({ p, onChanged }: { p: PaymentDetailData; onChanged: () => void }) {
  const { can } = useAdmin();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [verifying, setVerifying] = useState(false);
  const [creating, setCreating] = useState(false);
  const changed = (message: string) => { setNotice(message); onChanged(); };

  async function reverify() {
    setVerifying(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const res = await api<{ payment: { status: string } }>(`/admin/payments/${encodeURIComponent(p.reference)}/reconcile`, { method: "POST", body: {} });
      changed(`The provider was asked again. Its answer: ${PAYMENT_STATUS[res.payment.status]?.label ?? humanize(res.payment.status)}.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setVerifying(false);
    }
  }

  const canRefund = can("refunds.decide") && (p.refundableAmountBdt > 0 || p.reviewReason === "DUPLICATE_PAYMENT");
  return (
    <>
      {notice && <Alert tone="info">{notice}</Alert>}
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-mono text-xl font-extrabold break-all text-brand-950">{p.reference}</h2>
          <StatusBadge value={p.status} map={PAYMENT_STATUS} />
          {p.needsAttention && <Badge tone="warning">Needs attention</Badge>}
          <Badge>{p.mode === "live" ? "Live payment" : p.mode === "simulated" ? "Simulated (demo) payment" : "Sandbox (test) payment"}</Badge>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Amount">{formatBdt(p.amountBdt)} {p.currency}</Fact>
          <Fact label="Refunded so far (confirmed)">{formatBdt(p.refundedAmountBdt)}</Fact>
          <Fact label="Still refundable">{formatBdt(p.refundableAmountBdt)}</Fact>
          <Fact label="Provider">{providerLabel(p.provider)}</Fact>
          <Fact label="Provider receipt number">{p.providerTransactionId ?? "None: not verified as paid"}</Fact>
          <Fact label="Booking"><Link href={`/admin/bookings/${p.booking.id}`} className="font-semibold text-brand-700 hover:underline">{p.booking.serviceName}</Link> <StatusBadge value={p.booking.status} map={bookingStatus} /></Fact>
          <Fact label="Created">{formatDateTime(p.createdAt)}</Fact>
          <Fact label="Payment confirmed">{p.succeededAt ? formatDateTime(p.succeededAt) : "Not confirmed"}</Fact>
          <Fact label="Verification attempts">{p.verificationAttempts}{p.lastVerifiedAt ? `, last on ${formatDateTime(p.lastVerifiedAt)}` : ""}</Fact>
          {p.failureCode && <Fact label="Failure code">{p.failureCode}</Fact>}
        </dl>
        {p.reviewReason && (
          <Alert tone="warning" title={`Review reason: ${humanize(p.reviewReason)}`}>{REVIEW_REASONS[p.reviewReason] ?? "This payment needs a person to look at it."}</Alert>
        )}
      </Card>

      {(can("payments.reconcile") || canRefund) && (
        <Section title="Actions">
          <div className="flex flex-wrap gap-3">
            {can("payments.reconcile") && <Button variant="secondary" loading={verifying} onClick={reverify}>Re-verify with provider</Button>}
            {canRefund && <Button onClick={() => setCreating(true)}>Create refund</Button>}
          </div>
          {can("payments.reconcile") && <p className="text-sm text-ink-muted">Re-verifying asks {providerLabel(p.provider)} for the payment&apos;s real state. The status always comes from the provider, never from this page, and it may stay unchanged.</p>}
          {error && <Alert tone="error">{error}</Alert>}
          {creating && <CreateRefundDialog reference={p.reference} maxBdt={p.refundableAmountBdt} onClose={() => setCreating(false)} onChanged={changed} />}
        </Section>
      )}

      <Section title="Refunds">
        {p.refunds.length === 0 ? (
          <p className="text-sm text-ink-muted">No refunds for this payment.</p>
        ) : (
          <ul className="space-y-3">
            {p.refunds.map((r) => (
              <li key={r.id}>
                <Card className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><StatusBadge value={r.status} map={REFUND_STATUS} /><span className="font-semibold">{formatBdt(r.approvedAmountBdt ?? r.requestedAmountBdt)}</span></span>
                    <span className="text-sm text-ink-muted">Requested {formatDateTime(r.createdAt)}</span>
                  </div>
                  <p className="text-sm break-words">Reason: {r.reason}</p>
                  {r.decisionNote && <p className="text-sm break-words text-ink-muted">Decision note: {r.decisionNote}</p>}
                  {r.completedAt && <p className="text-sm text-ink-muted">Completed {formatDateTime(r.completedAt)}</p>}
                  <RefundActions refund={r} reference={p.reference} provider={p.provider} onChanged={changed} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Event timeline" description="Everything recorded about this payment, oldest first. Details are sanitised text, never raw provider data.">
        {p.events.length === 0 ? (
          <p className="text-sm text-ink-muted">No events.</p>
        ) : (
          <ol className="space-y-3 border-l-2 border-line pl-4">
            {p.events.map((e, i) => {
              const meta = metadataText(e.metadata);
              return (
                <li key={`${e.createdAt}-${i}`}>
                  <p className="font-semibold">{humanize(e.type)}{e.fromStatus || e.toStatus ? <span className="font-normal text-ink-muted"> · {e.fromStatus ? humanize(e.fromStatus) : "start"} → {e.toStatus ? humanize(e.toStatus) : "?"}</span> : null}</p>
                  <p className="text-sm text-ink-muted">{formatDateTime(e.createdAt)}{e.actorRole ? ` · by ${humanize(e.actorRole)}` : ""}</p>
                  {meta && <p className="text-xs break-words text-ink-subtle">{meta}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </Section>
    </>
  );
}
