import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/shell/admin-shell";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: { default: "Admin", template: "%s | Admin | FixedItNow" }, robots: { index: false, follow: false } };

// The admin panel renders only after the browser has confirmed an administrator is signed in (or shows the
// log-in form), so its pages are never part of an instant navigation. Opt the whole section out of that check.
export const instant = false;

export default function AdminLayout({ children }: { children: ReactNode }) {
  // The shell reads the current path and the signed-in user at runtime, so it streams in behind a placeholder.
  return (
    <Suspense
      fallback={
        <div className="container-page space-y-4 py-8" aria-busy="true" aria-label="Loading the admin panel">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-48" />
        </div>
      }
    >
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
