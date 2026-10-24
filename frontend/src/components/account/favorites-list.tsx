"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { ProfessionalCard } from "@/components/professional/professional-card";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { WorkerCardData } from "@/lib/discovery-types";
import { useApi } from "@/lib/use-api";

type Page = { workers: WorkerCardData[]; page: number; totalPages: number; total: number };

function List() {
  const [page, setPage] = useState(1);
  const { state, reload } = useApi<Page>(`/me/favorites?page=${page}&pageSize=12`);

  if (state.status === "loading" || state.status === "unauthenticated") {
    return (
      <div aria-busy="true" aria-label="Loading favorites" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    );
  }
  if (state.status === "error") {
    return <ErrorState action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>;
  }
  const { workers, totalPages, total } = state.data;
  if (total === 0) {
    return (
      <EmptyState
        icon={Heart}
        headingLevel={2}
        title="No favorites yet"
        action={<LinkButton href="/workers">Find professionals</LinkButton>}
      >
        Tap the heart on a professional to save them here. Professionals who are no longer listed are hidden.
      </EmptyState>
    );
  }
  return (
    <>
      <p className="mb-4 text-sm font-medium text-ink-muted">
        {total} saved {total === 1 ? "professional" : "professionals"}
      </p>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workers.map((pro) => (
          <li key={pro.id}>
            <ProfessionalCard pro={pro} headingLevel={2} />
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-ink-muted" aria-live="polite">
            Page {page} of {totalPages}
          </span>
          <Button variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </>
  );
}

export function FavoritesList() {
  return (
    <AuthGate>
      {() => (
        <div>
          <h1 className="text-h1 font-extrabold text-brand-950">Favorites</h1>
          <p className="mt-3 text-lg text-ink-muted">Professionals you saved. Only you can see this list.</p>
          <div className="mt-8">
            <List />
          </div>
        </div>
      )}
    </AuthGate>
  );
}
