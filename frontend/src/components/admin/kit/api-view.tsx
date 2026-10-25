"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiState } from "@/lib/use-api";

/** Loading, error (with retry) and ready states for a `useApi` result, so every page handles all three. */
export function ApiView<T>({
  state,
  reload,
  skeleton = <Skeleton className="h-40" />,
  children,
}: {
  state: ApiState<T>;
  reload: () => void;
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (state.status === "loading" || state.status === "unauthenticated") {
    return (
      <div aria-busy="true" aria-label="Loading">
        {skeleton}
      </div>
    );
  }
  if (state.status === "error") {
    return <ErrorState action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>;
  }
  return <>{children(state.data)}</>;
}
