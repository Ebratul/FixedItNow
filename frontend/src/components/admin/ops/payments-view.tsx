"use client";

import Link from "next/link";
import { Receipt } from "lucide-react";
import { useState } from "react";
import { Pager } from "@/components/community/community-shell";
import { ApiView, DataTable, StatusBadge, buildQuery, useDebounced, type Column } from "@/components/admin/kit";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { SelectInput } from "@/components/ui/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBdt, formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { DateRangeFields, PAYMENT_STATUS, PROVIDER_LABEL, REFUND_STATUS, Tabs, dayStartIso, humanize, nextDayStartIso, providerLabel, rangeError, type Paged } from "./shared";
import { RefundActions } from "./refund-actions";

export type PaymentRow = {
  reference: string;
  bookingId: string;
  provider: string;
  mode: "live" | "sandbox";
  status: string;
  amountBdt: number;
  refundedAmountBdt: number;
  needsAttention: boolean;
  createdAt: string;
  customer: { id: string; name: string };
  reviewReason: string | null;
};
type PaymentList = Paged & { payments: PaymentRow[] };

export type RefundRow = {
  id: string;
  status: string;
  requestedAmountBdt: number;
  approvedAmountBdt: number | null;
  reason: string;
  decisionNote: string | null;
  createdAt: string;
  requestedByRole: string;
  failureCode: string | null;
  payment: { reference: string; provider: string; amountBdt: number; refundedAmountBdt: number; status: string };
};
type RefundList = Paged & { refunds: RefundRow[] };

export function PaymentsView() {
  const [tab, setTab] = useState("payments");
  return (
    <Tabs label="Payments and refunds" tabs={[{ value: "payments", label: "Payments" }, { value: "refunds", label: "Refunds" }]} value={tab} onChange={setTab}>
      {tab === "payments" ? <PaymentsTab /> : <RefundsTab />}
    </Tabs>
  );
}

function PaymentsTab() {
  const [status, setStatus] = useState("");
  const [provider, setProvider] = useState("");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const dateProblem = rangeError(from, to);
  const searchProblem = search.trim().length > 0 && search.trim().length < 3 ? "Type at least 3 characters to search." : undefined;
  const query = buildQuery({
    status, provider, page, pageSize: 20,
    q: q.length >= 3 ? q : undefined,
    from: !dateProblem && from ? dayStartIso(from) : undefined,
    to: !dateProblem && to ? nextDayStartIso(to) : undefined,
  });
  const { state, reload, stale } = useApi<PaymentList>(`/admin/payments${query}`);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  const columns: Column<PaymentRow>[] = [
    { key: "ref", header: "Reference", cell: (p) => <Link href={`/admin/payments/${p.reference}`} className="font-mono text-sm font-semibold text-brand-700 hover:underline">{p.reference}</Link> },
    { key: "status", header: "Status", cell: (p) => <span className="flex flex-wrap gap-1"><StatusBadge value={p.status} map={PAYMENT_STATUS} />{p.needsAttention && p.status !== "REQUIRES_REVIEW" && <Badge tone="warning">Needs attention</Badge>}</span> },
    { key: "amount", header: "Amount", align: "right", cell: (p) => <>{formatBdt(p.amountBdt)}{p.refundedAmountBdt > 0 && <span className="block text-xs text-ink-subtle">{formatBdt(p.refundedAmountBdt)} refunded</span>}</> },
    { key: "provider", header: "Provider", hideBelow: "md", cell: (p) => <>{providerLabel(p.provider)}{p.mode === "sandbox" && <Badge className="ml-2">Sandbox</Badge>}</> },
    { key: "customer", header: "Customer", hideBelow: "lg", cell: (p) => p.customer.name },
    { key: "created", header: "Created", hideBelow: "md", cell: (p) => formatDateTime(p.createdAt) },
    { key: "booking", header: "Booking", hideBelow: "lg", cell: (p) => <Link href={`/admin/bookings/${p.bookingId}`} className="text-brand-700 hover:underline">Open booking</Link> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <SearchInput id="payment-search" label="Search" placeholder="Payment reference or full booking id" value={search} onChange={(e) => reset(setSearch)(e.target.value)} maxLength={64} error={searchProblem} />
        </div>
        <SelectInput id="payment-status" label="Status" placeholder="All statuses" value={status} onChange={(e) => reset(setStatus)(e.target.value)} className="w-52"
          options={["NEEDS_ATTENTION", "REQUIRES_REVIEW", "PENDING", "INITIATED", "PROCESSING", "SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED", "FAILED", "CANCELLED", "EXPIRED"].map((v) => ({ value: v, label: PAYMENT_STATUS[v].label }))} />
        <SelectInput id="payment-provider" label="Provider" placeholder="All providers" value={provider} onChange={(e) => reset(setProvider)(e.target.value)} className="w-44"
          options={Object.entries(PROVIDER_LABEL).map(([value, label]) => ({ value, label }))} />
      </div>
      <DateRangeFields idPrefix="payment" from={from} to={to} onFrom={reset(setFrom)} onTo={reset(setTo)} error={dateProblem} />
      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-64" />}>
        {(data) =>
          dateProblem ? null : data.payments.length === 0 ? (
            <EmptyState headingLevel={2} icon={Receipt} title="No payments found">Nothing matches these filters. Try clearing the status or date range.</EmptyState>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-ink-muted" aria-live="polite">{data.total} payment{data.total === 1 ? "" : "s"}{stale ? " (updating…)" : ""}</p>
              <DataTable caption="Payments" columns={columns} rows={data.payments} rowKey={(p) => p.reference} busy={stale} />
              <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} label="Payments pages" />
            </div>
          )
        }
      </ApiView>
    </div>
  );
}

function RefundsTab() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string>();
  const { state, reload, refresh, stale } = useApi<RefundList>(`/admin/refunds${buildQuery({ status, page, pageSize: 20 })}`);

  const columns: Column<RefundRow>[] = [
    {
      key: "refund",
      header: "Refund",
      cell: (r) => (
        <>
          <StatusBadge value={r.status} map={REFUND_STATUS} />
          <span className="mt-1 block text-xs font-normal text-ink-subtle">{formatDateTime(r.createdAt)}</span>
        </>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      cell: (r) => <>{formatBdt(r.approvedAmountBdt ?? r.requestedAmountBdt)}{r.approvedAmountBdt !== null && r.approvedAmountBdt !== r.requestedAmountBdt && <span className="block text-xs text-ink-subtle">of {formatBdt(r.requestedAmountBdt)} requested</span>}</>,
    },
    { key: "payment", header: "Payment", cell: (r) => <><Link href={`/admin/payments/${r.payment.reference}`} className="font-mono text-xs text-brand-700 hover:underline">{r.payment.reference}</Link><span className="block text-xs text-ink-subtle">{providerLabel(r.payment.provider)} · {formatBdt(r.payment.amountBdt)} paid</span></> },
    { key: "reason", header: "Reason", hideBelow: "lg", className: "max-w-64", cell: (r) => <><span className="line-clamp-3 break-words">{r.reason}</span><span className="block text-xs text-ink-subtle">Asked by {humanize(r.requestedByRole)}{r.failureCode ? ` · failure ${r.failureCode}` : ""}</span>{r.decisionNote && <span className="block text-xs text-ink-subtle">Note: {r.decisionNote}</span>}</> },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => <RefundActions refund={r} reference={r.payment.reference} provider={r.payment.provider} onChanged={(m) => { setNotice(m); refresh(); }} />,
    },
  ];

  return (
    <div className="space-y-4">
      <SelectInput id="refund-status" label="Status" placeholder="All statuses" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-64"
        options={Object.entries(REFUND_STATUS).map(([value, v]) => ({ value, label: v.label }))} />
      {notice && <Alert tone="info">{notice}</Alert>}
      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-64" />}>
        {(data) =>
          data.refunds.length === 0 ? (
            <EmptyState headingLevel={2} icon={Receipt} title="No refunds found">{status ? "No refunds have this status." : "No refunds have been requested yet."}</EmptyState>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-ink-muted" aria-live="polite">{data.total} refund{data.total === 1 ? "" : "s"}{stale ? " (updating…)" : ""}. A refund is only complete when its status says “Refunded (confirmed)”.</p>
              <DataTable caption="Refunds" columns={columns} rows={data.refunds} rowKey={(r) => r.id} busy={stale} />
              <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} label="Refunds pages" />
            </div>
          )
        }
      </ApiView>
    </div>
  );
}
