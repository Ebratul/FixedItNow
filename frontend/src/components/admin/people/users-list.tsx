"use client";

import { Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AdminPage, ApiView, buildQuery, DataTable, useDebounced, type Column } from "@/components/admin/kit";
import { Pager } from "@/components/community/community-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { SelectInput } from "@/components/ui/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import type { UserList, UserRow } from "./types";

const PAGE_SIZE = 20;

export const VERIFICATION_LABELS: Record<string, string> = {
  NOT_SUBMITTED: "not submitted",
  PENDING: "pending review",
  VERIFIED: "verified",
  REJECTED: "rejected",
  RESUBMISSION_REQUIRED: "resubmission required",
};

export function UserBadges({ user }: { user: UserRow }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {user.role === "ADMIN" && <Badge tone="brand">Admin{user.adminRole ? `: ${user.adminRole.name}` : ""}</Badge>}
      {user.isCustomer && <Badge>Customer</Badge>}
      {user.worker && <Badge tone={user.worker.verificationStatus === "VERIFIED" ? "success" : "neutral"}>Worker: {VERIFICATION_LABELS[user.worker.verificationStatus] ?? user.worker.verificationStatus.toLowerCase()}</Badge>}
      {!user.isCustomer && !user.worker && user.role !== "ADMIN" && <Badge>No profile yet</Badge>}
    </div>
  );
}

const columns: Column<UserRow>[] = [
  {
    key: "name",
    header: "User",
    cell: (u) => (
      <Link href={`/admin/users/${u.id}`} className="text-brand-800 underline-offset-2 hover:underline focus-visible:underline">
        {u.name || "(no name)"}
      </Link>
    ),
  },
  {
    key: "email",
    header: "Email",
    hideBelow: "md",
    cell: (u) => (
      <span className="break-all">
        {u.email}
        {!u.emailVerified && <span className="ml-2 text-xs text-ink-subtle">(not verified)</span>}
      </span>
    ),
  },
  { key: "kind", header: "Type", cell: (u) => <UserBadges user={u} /> },
  { key: "status", header: "Status", cell: (u) => (u.suspended ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>) },
  { key: "joined", header: "Joined", hideBelow: "lg", cell: (u) => formatDate(u.createdAt) },
];

/** Searchable, filterable, paginated list of every account (`GET /admin/users`). */
export function UsersList() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebounced(q.trim());
  const path = `/admin/users${buildQuery({ q: search, role, status, kind, page, pageSize: PAGE_SIZE })}`;
  const { state, reload, stale } = useApi<UserList>(path);
  const filtered = Boolean(search || role || status || kind);

  return (
    <AdminPage title="Users" description="Every account on the platform. Open a user to see their activity and, with the right permission, suspend them or manage their admin access." permission="users.read">
      <form role="search" aria-label="Filter users" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => e.preventDefault()}>
        <div className="sm:col-span-2 lg:col-span-4">
          <SearchInput id="user-search" label="Search by name, email or user id" placeholder="Name, email or id" value={q} maxLength={100} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <SelectInput id="user-role" label="Account role" placeholder="All roles" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} options={[{ value: "USER", label: "Regular users" }, { value: "ADMIN", label: "Administrators" }]} />
        <SelectInput id="user-status" label="Status" placeholder="Any status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} options={[{ value: "active", label: "Active" }, { value: "suspended", label: "Suspended" }]} />
        <SelectInput id="user-kind" label="Profile" placeholder="Any profile" value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} options={[{ value: "customer", label: "Customers" }, { value: "worker", label: "Workers" }]} />
      </form>

      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-64" />}>
        {(data) =>
          data.users.length === 0 ? (
            <EmptyState icon={Users} title={filtered ? "No users match these filters" : "No users yet"} headingLevel={2}>
              {filtered ? "Try a different search term or clear a filter." : "Accounts appear here as people sign up."}
            </EmptyState>
          ) : (
            <section aria-label="Results" className="space-y-4">
              <p className="text-sm text-ink-muted" aria-live="polite">
                {data.total} {data.total === 1 ? "user" : "users"}
                {stale && " (updating…)"}
              </p>
              <DataTable caption="Users" columns={columns} rows={data.users} rowKey={(u) => u.id} busy={stale} />
              <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} label="Users pages" />
            </section>
          )
        }
      </ApiView>
    </AdminPage>
  );
}
