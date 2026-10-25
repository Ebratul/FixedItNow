"use client";

import { HardHat } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AdminPage, ApiView, buildQuery, DataTable, StatusBadge, useDebounced, type Column } from "@/components/admin/kit";
import { Pager } from "@/components/community/community-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { SelectInput } from "@/components/ui/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { VERIFICATION_STATUS_MAP, type AdminWorkerList, type AdminWorkerRow } from "./worker-types";

const TABS = [
  { id: "PENDING", label: "Awaiting review" },
  { id: "RESUBMISSION_REQUIRED", label: "Changes requested" },
  { id: "VERIFIED", label: "Approved" },
  { id: "REJECTED", label: "Rejected" },
  { id: "NOT_SUBMITTED", label: "Not submitted" },
  { id: "ALL", label: "All" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const EMPTY_COPY: Record<Tab, string> = {
  PENDING: "No worker applications are waiting for review. New submissions appear here.",
  RESUBMISSION_REQUIRED: "No worker has been asked for changes right now.",
  VERIFIED: "No approved workers match these filters.",
  REJECTED: "No rejected applications match these filters.",
  NOT_SUBMITTED: "No worker profiles in progress match these filters.",
  ALL: "No worker profiles match these filters.",
};

/** Worker applications queue: filter by review state, search, paginate. Opening a row shows the review page. */
export function WorkerList() {
  const [status, setStatus] = useState<Tab>("PENDING");
  const [search, setSearch] = useState("");
  const [published, setPublished] = useState("");
  const [suspended, setSuspended] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());

  const { state, reload, stale } = useApi<AdminWorkerList>(
    `/admin/workers${buildQuery({ status, q: q || undefined, published: published || undefined, suspended: suspended || undefined, page, pageSize: 25 })}`,
  );

  const columns: Column<AdminWorkerRow>[] = [
    {
      key: "name",
      header: "Worker",
      cell: (w) => (
        <Link href={`/admin/workers/${w.id}`} className="text-brand-700 underline-offset-2 hover:underline">
          {w.displayName ?? "(no display name)"}
        </Link>
      ),
    },
    { key: "email", header: "Account email", hideBelow: "md", cell: (w) => <span className="break-all">{w.email}</span> },
    { key: "status", header: "Review", cell: (w) => <StatusBadge value={w.verificationStatus} map={VERIFICATION_STATUS_MAP} /> },
    {
      key: "listing",
      header: "Listing",
      cell: (w) => (
        <span className="flex flex-wrap gap-1">
          {w.suspended && <Badge tone="danger">Suspended</Badge>}
          <Badge tone={w.published ? "success" : "neutral"}>{w.published ? "Published" : "Not published"}</Badge>
        </span>
      ),
    },
    { key: "services", header: "Services", hideBelow: "lg", cell: (w) => (w.categories.length ? w.categories.join(", ") : "None") },
    { key: "docs", header: "Documents", align: "right", cell: (w) => w.documentCount },
    { key: "submitted", header: "Submitted", hideBelow: "md", cell: (w) => (w.submittedAt ? formatDateTime(w.submittedAt) : "Not yet") },
  ];

  return (
    <AdminPage
      title="Worker applications"
      description="Review worker profiles before they can be listed publicly. Every decision, suspension and document view is recorded in the audit log."
      permission="workers.read"
    >
      <div role="group" aria-label="Review state" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={status === t.id}
            onClick={() => {
              setStatus(t.id);
              setPage(1);
            }}
            className={cn(
              "min-h-11 rounded-control border px-4 text-sm font-semibold",
              status === t.id ? "border-brand-700 bg-brand-700 text-white" : "border-line-strong bg-canvas text-ink hover:bg-brand-50",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SearchInput
          id="worker-search"
          label="Search"
          placeholder="Name or email"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          maxLength={100}
        />
        <SelectInput
          id="worker-published"
          label="Public listing"
          placeholder="Any"
          options={[{ value: "true", label: "Published" }, { value: "false", label: "Not published" }]}
          value={published}
          onChange={(e) => {
            setPublished(e.target.value);
            setPage(1);
          }}
        />
        <SelectInput
          id="worker-suspended"
          label="Suspension"
          placeholder="Any"
          options={[{ value: "true", label: "Suspended" }, { value: "false", label: "Not suspended" }]}
          value={suspended}
          onChange={(e) => {
            setSuspended(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-64" />}>
        {(data) =>
          data.workers.length === 0 ? (
            <EmptyState icon={HardHat} title="No workers found" headingLevel={2}>
              {q || published || suspended ? "Nothing matches the search and filters. Try clearing some." : EMPTY_COPY[status]}
            </EmptyState>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-ink-muted" aria-live="polite">
                {data.total} {data.total === 1 ? "profile" : "profiles"}
              </p>
              <DataTable caption="Worker profiles" columns={columns} rows={data.workers} rowKey={(w) => w.id} busy={stale} />
              <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} label="Worker pages" />
            </div>
          )
        }
      </ApiView>
    </AdminPage>
  );
}
