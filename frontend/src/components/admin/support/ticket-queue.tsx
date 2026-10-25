"use client";

import Link from "next/link";
import { Inbox } from "lucide-react";
import { useState } from "react";
import { AdminPage, ApiView, buildQuery, DataTable, StatusBadge, useDebounced, type Column } from "@/components/admin/kit";
import { Pager } from "@/components/community/community-shell";
import { SearchInput } from "@/components/ui/search-input";
import { SelectInput } from "@/components/ui/select-input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import {
  CATEGORY_LABELS, PRIORITY, STAFF_STATUS, TICKET_CATEGORIES, TICKET_PRIORITIES, TICKET_STATUSES,
  type AdminTicketList, type AdminTicketRow, type TicketStatus,
} from "@/lib/support";
import { useApi } from "@/lib/use-api";

const columns: Column<AdminTicketRow>[] = [
  { key: "number", header: "No.", cell: (t) => <span className="tabular-nums">#{t.number}</span> },
  {
    key: "subject",
    header: "Subject",
    cell: (t) => (
      <Link href={`/admin/support/${t.id}`} className="font-semibold break-words text-brand-800 hover:underline">
        {t.subject}
      </Link>
    ),
    className: "min-w-48",
  },
  { key: "category", header: "Category", cell: (t) => CATEGORY_LABELS[t.category] ?? t.category, hideBelow: "lg" },
  { key: "priority", header: "Priority", cell: (t) => <StatusBadge value={t.priority} map={PRIORITY} /> },
  { key: "status", header: "Status", cell: (t) => <StatusBadge value={t.status} map={STAFF_STATUS} /> },
  { key: "requester", header: "Requester", cell: (t) => t.requester.name, hideBelow: "md" },
  { key: "assignee", header: "Assignee", cell: (t) => t.assignee?.name ?? <span className="text-ink-subtle">Unassigned</span>, hideBelow: "md" },
  { key: "last", header: "Last activity", cell: (t) => <span className="whitespace-nowrap">{formatDateTime(t.lastMessageAt)}</span>, hideBelow: "lg" },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-control border px-4 text-sm font-semibold transition-colors",
        active ? "border-brand-700 bg-brand-700 text-white" : "border-line-strong bg-canvas text-ink-muted hover:border-brand-300",
      )}
    >
      {children}
    </button>
  );
}

/** The support queue: status tabs with counts, filters, search by subject or #number, pagination. */
export function TicketQueue() {
  return (
    <AdminPage title="Support tickets" description="Requests from customers and professionals, oldest activity first." permission="support.read">
      <QueueBody />
    </AdminPage>
  );
}

function QueueBody() {
  const [status, setStatus] = useState<TicketStatus | "">("");
  const [priority, setPriority] = useState("");
  const [category, setCategory] = useState("");
  const [assignee, setAssignee] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim());
  const path = `/admin/support/tickets${buildQuery({ status, priority, category, assignee, q, page })}`;
  const { state, reload, stale } = useApi<AdminTicketList>(path);

  const reset = (fn: () => void) => { fn(); setPage(1); };
  const counts = state.status === "ready" ? state.data.statusCounts : {};
  const all = TICKET_STATUSES.reduce((sum, s) => sum + (counts[s] ?? 0), 0);
  const filtered = Boolean(priority || category || assignee || q);

  return (
    <>
      <section aria-label="Filters" className="space-y-4">
        <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
          <Chip active={status === ""} onClick={() => reset(() => setStatus(""))}>
            All{state.status === "ready" && <>{" "}<span className="tabular-nums">({all})</span></>}
          </Chip>
          {TICKET_STATUSES.map((s) => (
            <Chip key={s} active={status === s} onClick={() => reset(() => setStatus(s))}>
              {STAFF_STATUS[s].label}
              {state.status === "ready" && <>{" "}<span className="tabular-nums">({counts[s] ?? 0})</span></>}
            </Chip>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SearchInput id="ticket-search" label="Search" placeholder="Subject or #number" value={search} onChange={(e) => reset(() => setSearch(e.target.value))} maxLength={100} />
          <SelectInput id="ticket-priority" label="Priority" placeholder="Any priority" value={priority} onChange={(e) => reset(() => setPriority(e.target.value))}
            options={TICKET_PRIORITIES.map((p) => ({ value: p, label: PRIORITY[p].label }))} />
          <SelectInput id="ticket-category" label="Category" placeholder="Any category" value={category} onChange={(e) => reset(() => setCategory(e.target.value))}
            options={TICKET_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))} />
          <SelectInput id="ticket-assignee" label="Assignee" placeholder="Anyone" value={assignee} onChange={(e) => reset(() => setAssignee(e.target.value))}
            options={[{ value: "me", label: "Assigned to me" }, { value: "unassigned", label: "Unassigned" }]} />
        </div>
      </section>

      <section aria-label="Tickets" aria-live="polite">
        <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-64" />}>
          {(data) =>
            data.tickets.length === 0 ? (
              <EmptyState icon={Inbox} headingLevel={2} title="No tickets found">
                {status || filtered ? "No tickets match these filters. Try clearing a filter or the search box." : "Nobody has raised a support request yet."}
              </EmptyState>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-medium text-ink-muted">{data.total} {data.total === 1 ? "ticket" : "tickets"}</p>
                <DataTable caption="Support tickets" columns={columns} rows={data.tickets} rowKey={(t) => t.id} busy={stale} />
                <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} label="Ticket pages" />
              </div>
            )
          }
        </ApiView>
      </section>
    </>
  );
}
