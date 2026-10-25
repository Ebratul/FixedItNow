"use client";

import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { useState } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { Pager } from "@/components/community/community-shell";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SelectInput } from "@/components/ui/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { CATEGORY_LABELS, TICKET_STATUSES, USER_STATUS, type OwnTicketList } from "@/lib/support";
import { useApi } from "@/lib/use-api";

export function SupportInfo() {
  return (
    <p className="text-sm text-ink-muted">
      Requests are answered here in the app, and you get a notification when we reply. Our team can see the booking and the conversation you attach to a request, but not your password or payment details.
    </p>
  );
}

function List() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { state, reload, stale } = useApi<OwnTicketList>(`/support/tickets?page=${page}&pageSize=10${status ? `&status=${status}` : ""}`);

  return (
    <div className="space-y-4">
      <SelectInput id="support-status" label="Show" placeholder="All requests" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        options={TICKET_STATUSES.map((s) => ({ value: s, label: USER_STATUS[s].label }))} className="max-w-xs" />
      {state.status === "loading" || state.status === "unauthenticated" ? (
        <div aria-busy="true" aria-label="Loading your requests" className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : state.status === "error" ? (
        <ErrorState action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>
      ) : state.data.total === 0 ? (
        <EmptyState icon={LifeBuoy} headingLevel={2} title={status ? "No requests with this status" : "No requests yet"} action={<LinkButton href="/account/support/new">New request</LinkButton>}>
          {status ? "Try another status, or show all requests." : "Have a question or a problem? Send us a request and we will answer it here."}
        </EmptyState>
      ) : (
        <div className={stale ? "space-y-4 opacity-60" : "space-y-4"} aria-busy={stale || undefined}>
          <p className="text-sm font-medium text-ink-muted" aria-live="polite">{state.data.total} {state.data.total === 1 ? "request" : "requests"}</p>
          <ul className="space-y-3">
            {state.data.tickets.map((t) => (
              <li key={t.id}>
                <Card interactive>
                  <Link href={`/account/support/${t.id}`} className="flex flex-wrap items-start justify-between gap-3 p-5">
                    <div className="min-w-0">
                      <h2 className="text-base font-bold break-words text-ink">{t.subject}</h2>
                      <p className="mt-0.5 text-sm text-ink-muted">#{t.number} · {CATEGORY_LABELS[t.category] ?? t.category} · Last activity {formatDateTime(t.lastMessageAt)}</p>
                    </div>
                    <Badge tone={USER_STATUS[t.status]?.tone ?? "neutral"}>{USER_STATUS[t.status]?.label ?? t.status}</Badge>
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
          <Pager page={state.data.page} totalPages={state.data.totalPages} onPage={setPage} label="Request pages" />
        </div>
      )}
    </div>
  );
}

export function SupportList() {
  return (
    <AuthGate>
      {() => (
        <div className="space-y-6">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Help and support" }]} />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-h1 font-extrabold text-brand-950">Help and support</h1>
              <p className="mt-3 max-w-2xl text-lg text-ink-muted">Ask a question or report a problem. Only you and our support team can see your requests.</p>
            </div>
            <LinkButton href="/account/support/new">New request</LinkButton>
          </div>
          <SupportInfo />
          <List />
        </div>
      )}
    </AuthGate>
  );
}
