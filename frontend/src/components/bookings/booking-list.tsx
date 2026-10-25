"use client";

import Link from "next/link";
import { CalendarDays, CalendarX } from "lucide-react";
import { useState } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { BookingList as BookingListData } from "@/lib/booking-types";
import { cn } from "@/lib/cn";
import { formatBdt, formatRange } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { StatusBadge } from "./status-badge";

const GROUPS = [
  { value: "all", label: "All" },
  { value: "open", label: "Requests" },
  { value: "active", label: "Upcoming" },
  { value: "history", label: "History" },
  { value: "disputed", label: "Disputes" },
] as const;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 items-center rounded-control border px-4 text-sm font-semibold transition-colors",
        active ? "border-brand-700 bg-brand-700 text-white" : "border-line-strong bg-canvas text-ink-muted hover:border-brand-300",
      )}
    >
      {children}
    </button>
  );
}

function List({ role, group, page, onPage }: { role: "customer" | "worker"; group: string; page: number; onPage: (p: number) => void }) {
  const { state, reload } = useApi<BookingListData>(`/bookings?role=${role}&group=${group}&page=${page}&pageSize=10`);

  if (state.status === "loading" || state.status === "unauthenticated") {
    return (
      <div aria-busy="true" aria-label="Loading bookings" className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }
  if (state.status === "error") {
    return <ErrorState action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>;
  }
  const { bookings, total, totalPages } = state.data;
  if (total === 0) {
    return (
      <EmptyState
        icon={group === "all" ? CalendarDays : CalendarX}
        headingLevel={2}
        title={group === "all" ? (role === "customer" ? "No bookings yet" : "No booking requests yet") : "Nothing here"}
        action={role === "customer" && group === "all" ? <LinkButton href="/workers">Find a professional</LinkButton> : undefined}
      >
        {role === "customer"
          ? "When you request a professional, your bookings and quotes appear here."
          : "Requests from customers appear here once your profile is published and you have set your working hours."}
      </EmptyState>
    );
  }
  return (
    <>
      <p className="mb-3 text-sm font-medium text-ink-muted" aria-live="polite">{total} {total === 1 ? "booking" : "bookings"}</p>
      <ul className="space-y-3">
        {bookings.map((b) => (
          <li key={b.id}>
            <Card interactive>
              <Link href={`/bookings/${b.id}`} className="flex flex-wrap items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-ink">{b.category.name}</h2>
                  <p className="mt-0.5 text-sm text-ink-muted">{role === "customer" ? "with" : "for"} {b.counterpartyName} · {b.serviceArea}</p>
                  <p className="mt-2 text-sm font-medium text-ink">{formatRange(b.startAt, b.endAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <StatusBadge status={b.status} arrivedAt={b.arrivedAt} />
                  {b.agreedAmountBdt !== null ? (
                    <span className="text-sm font-semibold">{formatBdt(b.agreedAmountBdt)}</span>
                  ) : b.pricingModel === "QUOTE" ? (
                    <span className="text-sm text-ink-subtle">Quote-based</span>
                  ) : null}
                </div>
              </Link>
            </Card>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
          <span className="text-sm text-ink-muted" aria-live="polite">Page {page} of {totalPages}</span>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</Button>
        </div>
      )}
    </>
  );
}

export function BookingListView() {
  const [role, setRole] = useState<"customer" | "worker">("customer");
  const [group, setGroup] = useState<string>("all");
  const [page, setPage] = useState(1);
  return (
    <AuthGate>
      {(me) => (
        <div>
          <h1 className="text-h1 font-extrabold text-brand-950">Bookings</h1>
          {me.worker.started && (
            <div role="group" aria-label="View as" className="mt-6 flex flex-wrap gap-2">
              <Chip active={role === "customer"} onClick={() => { setRole("customer"); setGroup("all"); setPage(1); }}>My requests</Chip>
              <Chip active={role === "worker"} onClick={() => { setRole("worker"); setGroup("all"); setPage(1); }}>Jobs for me</Chip>
            </div>
          )}
          <div role="group" aria-label="Filter" className="mt-4 flex flex-wrap gap-2">
            {GROUPS.map((g) => (
              <Chip key={g.value} active={group === g.value} onClick={() => { setGroup(g.value); setPage(1); }}>{g.label}</Chip>
            ))}
          </div>
          <div className="mt-8">
            <List role={role} group={group} page={page} onPage={setPage} />
          </div>
        </div>
      )}
    </AuthGate>
  );
}
