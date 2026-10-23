"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, type Me } from "@/lib/use-api";

/**
 * Loads the signed-in user's account summary (the backend is the authority)
 * and renders children once it is available. Sends unauthenticated visitors to
 * /login and returns them here afterwards.
 */
export function AuthGate({
  children,
}: {
  children: (me: Me, reload: () => void) => ReactNode;
}) {
  const { state, reload } = useMe();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (state.status === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [state.status, router, pathname]);

  if (state.status === "loading" || state.status === "unauthenticated") {
    return (
      <div aria-busy="true" aria-label="Loading your account" className="space-y-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <ErrorState action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>
    );
  }
  return <>{children(state.data, reload)}</>;
}
