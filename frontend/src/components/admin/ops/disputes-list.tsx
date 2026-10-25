"use client";

import Link from "next/link";
import { Gavel } from "lucide-react";
import { useState } from "react";
import { Pager } from "@/components/community/community-shell";
import { ApiView, DataTable, StatusBadge, buildQuery, type Column } from "@/components/admin/kit";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectInput } from "@/components/ui/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, STATUS_LABELS } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { DISPUTE_STATUS, humanize, type Paged } from "./shared";

type DisputeRow = {
  id: string;
  status: string;
  category: string;
  openedByRole: string;
  createdAt: string;
  assignedAdminId: string | null;
  booking: { id: string; status: string; startAt: string; category: { name: string } };
};
type DisputeList = Paged & { disputes: DisputeRow[] };
const bookingStatus = STATUS_LABELS as Record<string, { label: string; tone: "neutral" | "brand" | "success" | "warning" | "danger" }>;

export function DisputesList() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { state, reload, stale } = useApi<DisputeList>(`/admin/disputes${buildQuery({ status, page, pageSize: 20 })}`);

  const columns: Column<DisputeRow>[] = [
    {
      key: "dispute",
      header: "Dispute",
      cell: (d) => (
        <Link href={`/admin/disputes/${d.id}`} className="font-semibold text-brand-700 hover:underline">
          {humanize(d.category)}
          <span className="sr-only"> dispute {d.id}</span>
        </Link>
      ),
    },
    { key: "status", header: "Status", cell: (d) => <StatusBadge value={d.status} map={DISPUTE_STATUS} /> },
    { key: "service", header: "Booking", cell: (d) => <><Link href={`/admin/bookings/${d.booking.id}`} className="text-brand-700 hover:underline">{d.booking.category.name}</Link><span className="block text-xs text-ink-subtle"><StatusBadge value={d.booking.status} map={bookingStatus} /></span></> },
    { key: "by", header: "Opened by", hideBelow: "md", cell: (d) => humanize(d.openedByRole) },
    { key: "opened", header: "Opened", hideBelow: "md", cell: (d) => formatDateTime(d.createdAt) },
    { key: "assigned", header: "Reviewer", hideBelow: "lg", cell: (d) => (d.assignedAdminId ? "Assigned" : <span className="text-ink-subtle">Unassigned</span>) },
  ];

  return (
    <div className="space-y-4">
      <SelectInput
        id="dispute-status"
        label="Status"
        placeholder="All statuses"
        value={status}
        onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        options={Object.entries(DISPUTE_STATUS).map(([value, v]) => ({ value, label: v.label }))}
        className="w-64"
      />
      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-64" />}>
        {(data) =>
          data.disputes.length === 0 ? (
            <EmptyState headingLevel={2} icon={Gavel} title="No disputes found">{status ? "No disputes have this status." : "No disputes have been opened."}</EmptyState>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-ink-muted" aria-live="polite">{data.total} dispute{data.total === 1 ? "" : "s"}, oldest first{stale ? " (updating…)" : ""}</p>
              <DataTable caption="Disputes" columns={columns} rows={data.disputes} rowKey={(d) => d.id} busy={stale} />
              <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} label="Disputes pages" />
            </div>
          )
        }
      </ApiView>
    </div>
  );
}
