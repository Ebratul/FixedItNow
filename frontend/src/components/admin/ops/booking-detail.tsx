"use client";

import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiView, DataTable, StatusBadge, type Column } from "@/components/admin/kit";
import { EVENT_LABELS, formatBdt, formatDateTime, STATUS_LABELS } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { BackLink, DISPUTE_STATUS, Fact, PAYMENT_STATUS, Section, humanize, providerLabel } from "./shared";

type Booking = {
  id: string;
  status: string;
  description: string | null;
  serviceArea: string | null;
  serviceAddress: string | null;
  startAt: string;
  endAt: string;
  durationMinutes: number | null;
  timezone: string | null;
  pricingModel: string;
  unitPriceBdt: number | null;
  agreedAmountBdt: number | null;
  currency: string;
  createdAt: string;
  confirmedAt: string | null;
  startedAt: string | null;
  completionRequestedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  category: { name: string; slug: string };
  customer: { id: string; name: string };
  worker: { id: string; displayName: string };
  dispute: { id: string; status: string; category: string; createdAt: string } | null;
  review: { id: string; rating: number; status: string } | null;
  quotes: { id: string; status: string; totalBdt: number; createdAt: string; expiresAt: string | null }[];
  payments: { reference: string; provider: string; status: string; amountBdt: number; refundedAmountBdt: number; createdAt: string }[];
  rescheduleRequests: { id: string; status: string; newStartAt: string; createdAt: string }[];
  events: { id: string; type: string; actorRole: string | null; fromStatus: string | null; toStatus: string | null; reason: string | null; createdAt: string }[];
};

const bookingStatus = STATUS_LABELS as Record<string, { label: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" }>;
const label = (s: string | null) => (s ? bookingStatus[s]?.label ?? humanize(s) : "");

export function BookingDetail({ id }: { id: string }) {
  const { state, reload } = useApi<{ booking: Booking }>(`/admin/bookings/${id}`);
  return (
    <div className="space-y-6">
      <BackLink href="/admin/bookings">All bookings</BackLink>
      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-96" />}>{({ booking }) => <Body b={booking} />}</ApiView>
    </div>
  );
}

function Body({ b }: { b: Booking }) {
  const paymentColumns: Column<Booking["payments"][number]>[] = [
    { key: "ref", header: "Reference", cell: (p) => <Link href={`/admin/payments/${p.reference}`} className="font-mono text-brand-700 hover:underline">{p.reference}</Link> },
    { key: "provider", header: "Provider", cell: (p) => providerLabel(p.provider) },
    { key: "status", header: "Status", cell: (p) => <StatusBadge value={p.status} map={PAYMENT_STATUS} /> },
    { key: "amount", header: "Amount", align: "right", cell: (p) => formatBdt(p.amountBdt) },
    { key: "refunded", header: "Refunded", align: "right", cell: (p) => formatBdt(p.refundedAmountBdt) },
    { key: "created", header: "Created", hideBelow: "md", cell: (p) => formatDateTime(p.createdAt) },
  ];
  return (
    <>
      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-extrabold text-brand-950">{b.category.name}</h2>
          <StatusBadge value={b.status} map={bookingStatus} />
          {b.dispute && (
            <Link href={`/admin/disputes/${b.dispute.id}`} className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand-700 hover:underline">
              Dispute: <Badge tone="danger">{DISPUTE_STATUS[b.dispute.status]?.label ?? b.dispute.status}</Badge> (open the dispute)
            </Link>
          )}
        </div>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Fact label="Booking id"><span className="font-mono text-sm">{b.id}</span></Fact>
          <Fact label="Customer">{b.customer.name}</Fact>
          <Fact label="Professional">{b.worker.displayName}</Fact>
          <Fact label="Appointment">{formatDateTime(b.startAt)} to {formatDateTime(b.endAt)}</Fact>
          <Fact label="Duration">{b.durationMinutes ? `${b.durationMinutes} minutes` : "Not set"}</Fact>
          <Fact label="Pricing">{humanize(b.pricingModel)}{b.unitPriceBdt !== null ? `, ${formatBdt(b.unitPriceBdt)} unit price` : ""}</Fact>
          <Fact label="Agreed amount">{b.agreedAmountBdt === null ? "Not agreed yet" : `${formatBdt(b.agreedAmountBdt)} ${b.currency}`}</Fact>
          <Fact label="Requested">{formatDateTime(b.createdAt)}</Fact>
          {b.confirmedAt && <Fact label="Confirmed">{formatDateTime(b.confirmedAt)}</Fact>}
          {b.startedAt && <Fact label="Started">{formatDateTime(b.startedAt)}</Fact>}
          {b.completionRequestedAt && <Fact label="Marked finished by professional">{formatDateTime(b.completionRequestedAt)}</Fact>}
          {b.completedAt && <Fact label="Completed">{formatDateTime(b.completedAt)}</Fact>}
          {b.cancelledAt && <Fact label="Cancelled">{formatDateTime(b.cancelledAt)}</Fact>}
          {b.cancellationReason && <Fact label="Cancellation reason">{b.cancellationReason}</Fact>}
          {b.review && <Fact label="Review">{b.review.rating} of 5 stars ({humanize(b.review.status)})</Fact>}
        </dl>
      </Card>

      <Section title="Service location and description">
        <Alert tone="info">
          The address and the customer&apos;s description are shown because your role includes the bookings.read permission. They are private to the customer and the professional; use them only to help with this booking. Contact details are never shown here.
        </Alert>
        <Card className="space-y-4 p-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Service area">{b.serviceArea ?? "Not set"}</Fact>
            <Fact label="Address">{b.serviceAddress ?? "Not set"}</Fact>
          </dl>
          <div>
            <p className="text-xs font-semibold text-ink-subtle">Customer&apos;s description</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-ink">{b.description ?? "No description."}</p>
          </div>
        </Card>
      </Section>

      <Section title="Timeline">
        {b.events.length === 0 ? (
          <p className="text-sm text-ink-muted">No events recorded.</p>
        ) : (
          <ol className="space-y-3 border-l-2 border-line pl-4">
            {b.events.map((e) => (
              <li key={e.id}>
                <p className="font-semibold">{EVENT_LABELS[e.type] ?? humanize(e.type)}</p>
                <p className="text-sm text-ink-muted">
                  {formatDateTime(e.createdAt)}
                  {e.actorRole ? ` · by ${humanize(e.actorRole)}` : ""}
                  {e.fromStatus || e.toStatus ? ` · ${label(e.fromStatus) || "start"} → ${label(e.toStatus)}` : ""}
                </p>
                {e.reason && <p className="mt-0.5 text-sm break-words">Reason: {e.reason}</p>}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Quotes">
        {b.quotes.length === 0 ? (
          <p className="text-sm text-ink-muted">No quotes were sent.</p>
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-canvas">
            {b.quotes.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-semibold">{formatBdt(q.totalBdt)}</span>
                <Badge>{humanize(q.status)}</Badge>
                <span className="text-ink-muted">Sent {formatDateTime(q.createdAt)}{q.expiresAt ? ` · expires ${formatDateTime(q.expiresAt)}` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Payments">
        {b.payments.length === 0 ? <p className="text-sm text-ink-muted">No payment attempts for this booking.</p> : <DataTable caption="Payments for this booking" columns={paymentColumns} rows={b.payments} rowKey={(p) => p.reference} />}
      </Section>

      <Section title="Reschedule requests">
        {b.rescheduleRequests.length === 0 ? (
          <p className="text-sm text-ink-muted">No reschedule requests.</p>
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-canvas">
            {b.rescheduleRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span>Proposed new start: <span className="font-semibold">{formatDateTime(r.newStartAt)}</span></span>
                <Badge>{humanize(r.status)}</Badge>
                <span className="text-ink-muted">Requested {formatDateTime(r.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <p className="text-sm text-ink-subtle">This page is read-only. Bookings change only through their normal flow or the dispute process.</p>
    </>
  );
}
