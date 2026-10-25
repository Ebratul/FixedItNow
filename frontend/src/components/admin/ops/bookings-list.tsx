"use client";

import Link from "next/link";
import { CalendarX2 } from "lucide-react";
import { useState } from "react";
import { Pager } from "@/components/community/community-shell";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { ApiView, DataTable, StatusBadge, buildQuery, useDebounced, type Column } from "@/components/admin/kit";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { SelectInput } from "@/components/ui/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBdt, formatDateTime, STATUS_LABELS } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { DISPUTE_STATUS, DateRangeFields, Tabs, dayStartIso, nextDayStartIso, rangeError, type Paged } from "./shared";

export type BookingRow = {
  id: string;
  status: string;
  startAt: string;
  endAt: string;
  createdAt: string;
  serviceArea: string | null;
  pricingModel: string;
  agreedAmountBdt: number | null;
  category: { name: string; slug: string };
  customer: { id: string; name: string };
  worker: { id: string; displayName: string };
  dispute: { id: string; status: string } | null;
  paymentCount: number;
};
type BookingList = Paged & { bookings: BookingRow[]; statusCounts: Record<string, number> };
type CategoryTree = { categories: { id: string; name: string; children: { id: string; name: string }[] }[] };

const STATUS_ORDER = ["REQUESTED", "QUOTED", "CONFIRMED", "IN_PROGRESS", "COMPLETION_PENDING", "COMPLETED", "CANCELLED", "DECLINED", "EXPIRED", "DISPUTED"];
const bookingStatus = STATUS_LABELS as Record<string, { label: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" }>;

/** The category filter needs category ids, which only the admin catalogue exposes (catalog.read). */
function CategoryFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { state } = useApi<CategoryTree>("/admin/categories");
  if (state.status !== "ready") return null;
  const options = state.data.categories.flatMap((c) => [{ value: c.id, label: c.name }, ...c.children.map((k) => ({ value: k.id, label: `${c.name} › ${k.name}` }))]);
  return <SelectInput id="booking-category" label="Category" placeholder="All categories" value={value} onChange={(e) => onChange(e.target.value)} options={options} className="w-56" />;
}

export function BookingsList() {
  const { can } = useAdmin();
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const dateProblem = rangeError(from, to);
  const query = buildQuery({
    status, q, categoryId, page, pageSize: 20,
    from: !dateProblem && from ? dayStartIso(from) : undefined,
    to: !dateProblem && to ? nextDayStartIso(to) : undefined,
  });
  const { state, reload, stale } = useApi<BookingList>(`/admin/bookings${query}`);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(1); };

  const columns: Column<BookingRow>[] = [
    {
      key: "booking",
      header: "Booking",
      cell: (b) => (
        <Link href={`/admin/bookings/${b.id}`} className="font-semibold text-brand-700 hover:underline">
          {b.category.name}
          <span className="sr-only"> booking {b.id}</span>
          <span className="block font-mono text-xs font-normal text-ink-subtle" aria-hidden>{b.id.slice(0, 8)}</span>
        </Link>
      ),
    },
    { key: "people", header: "Customer / professional", cell: (b) => <>{b.customer.name}<span className="block text-xs text-ink-subtle">{b.worker.displayName}</span></> },
    { key: "status", header: "Status", cell: (b) => <StatusBadge value={b.status} map={bookingStatus} /> },
    { key: "when", header: "Appointment", hideBelow: "md", cell: (b) => formatDateTime(b.startAt) },
    { key: "amount", header: "Agreed amount", align: "right", hideBelow: "lg", cell: (b) => (b.agreedAmountBdt === null ? <span className="text-ink-subtle">Not agreed</span> : formatBdt(b.agreedAmountBdt)) },
    {
      key: "dispute",
      header: "Dispute",
      hideBelow: "lg",
      cell: (b) => (b.dispute ? <Link href={`/admin/disputes/${b.dispute.id}`} className="font-semibold text-brand-700 hover:underline"><Badge tone="danger">{DISPUTE_STATUS[b.dispute.status]?.label ?? b.dispute.status}</Badge></Link> : <span className="text-ink-subtle">None</span>),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <SearchInput id="booking-search" label="Search" placeholder="Customer or professional name, or a full booking id" value={search} onChange={(e) => reset(setSearch)(e.target.value)} maxLength={100} />
        </div>
        {can("catalog.read") && <CategoryFilter value={categoryId} onChange={reset(setCategoryId)} />}
      </div>
      <DateRangeFields idPrefix="booking" label="Appointment" from={from} to={to} onFrom={reset(setFrom)} onTo={reset(setTo)} error={dateProblem} />
      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-64" />}>
        {(data) => {
          const total = Object.values(data.statusCounts).reduce((n, c) => n + c, 0);
          const tabs = [{ value: "", label: "All", count: total }, ...STATUS_ORDER.map((s) => ({ value: s, label: bookingStatus[s]?.label ?? s, count: data.statusCounts[s] ?? 0 }))];
          return (
            <Tabs label="Booking status" tabs={tabs} value={status} onChange={reset(setStatus)}>
              {dateProblem ? null : data.bookings.length === 0 ? (
                <EmptyState headingLevel={2} icon={CalendarX2} title="No bookings found">Nothing matches these filters. Try a different status, name or date range.</EmptyState>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-ink-muted" aria-live="polite">{data.total} booking{data.total === 1 ? "" : "s"}{stale ? " (updating…)" : ""}</p>
                  <DataTable caption="Bookings" columns={columns} rows={data.bookings} rowKey={(b) => b.id} busy={stale} />
                  <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} label="Bookings pages" />
                </div>
              )}
            </Tabs>
          );
        }}
      </ApiView>
    </div>
  );
}
