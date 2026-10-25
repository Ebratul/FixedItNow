"use client";

import Link from "next/link";
import { Receipt } from "lucide-react";
import { useState } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBdt, formatDateTime } from "@/lib/format";
import { PROVIDER_LABELS } from "@/lib/payment-status";
import type { PaymentList } from "@/lib/payment-types";
import { useApi } from "@/lib/use-api";
import { PaymentBadge } from "./payment-badge";

export function PaymentListView() {
  return <AuthGate>{() => <List />}</AuthGate>;
}

function List() {
  const [page, setPage] = useState(1);
  const { state, reload } = useApi<PaymentList>(`/payments?page=${page}`);
  return (
    <div className="space-y-6">
      <h1 className="text-h1 font-extrabold text-brand-950">Your payments</h1>
      {state.status === "loading" || state.status === "unauthenticated" ? (
        <div aria-busy="true" aria-label="Loading payments" className="space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : state.status === "error" ? (
        <ErrorState action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>
      ) : state.data.payments.length === 0 ? (
        <EmptyState icon={Receipt} title="No payments yet">When you pay for a finished job, the payment and its verified status will appear here.</EmptyState>
      ) : (
        <>
          <ul className="space-y-3">
            {state.data.payments.map((p) => (
              <li key={p.reference}>
                <Link href={`/payments/${p.reference}`} className="block rounded-card focus-visible:outline-2">
                  <Card interactive className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="font-bold">{p.booking.serviceName} with {p.booking.workerName}</p>
                      <p className="text-sm text-ink-muted">{formatDateTime(p.createdAt)} · {PROVIDER_LABELS[p.provider]}{p.mode === "sandbox" ? " · test" : ""}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-extrabold">{formatBdt(p.amountBdt)}</span>
                      <PaymentBadge payment={p} />
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
          {state.data.totalPages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-center gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
              <span className="text-sm text-ink-muted">Page {state.data.page} of {state.data.totalPages}</span>
              <Button variant="secondary" size="sm" disabled={page >= state.data.totalPages} onClick={() => setPage(page + 1)}>Next</Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
