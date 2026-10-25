"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShieldCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { IconButton, LinkButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ADMIN_NAV, activeItem } from "@/lib/admin/nav";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe } from "@/lib/use-api";
import { AdminProvider, useAdmin } from "./admin-context";
import { AdminLogin } from "./admin-login";

/** Renders the admin sections the signed-in administrator may open. */
function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useAdmin();
  const current = activeItem(pathname);
  const groups = ADMIN_NAV.map((g) => ({ ...g, items: g.items.filter((i) => can(i.permission)) })).filter((g) => g.items.length > 0);
  return (
    <nav aria-label="Admin sections" className="space-y-5">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-3 text-xs font-bold tracking-wide text-ink-subtle uppercase">{group.title}</p>
          <ul className="mt-1.5 space-y-0.5">
            {group.items.map((item) => {
              const active = current?.href === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-semibold transition-colors",
                      active ? "bg-brand-700 text-white" : "text-ink-muted hover:bg-surface-strong hover:text-ink",
                    )}
                  >
                    <item.icon className="size-4 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { roleName } = useAdmin();
  const here = activeItem(pathname);
  return (
    <div className="container-page py-6 lg:flex lg:gap-8 lg:py-8">
      <aside className="hidden w-60 shrink-0 lg:block" aria-label="Admin navigation">
        <div className="sticky top-24 space-y-5">
          <div className="flex items-center gap-2 px-3">
            <ShieldCheck className="size-5 text-brand-700" aria-hidden />
            <div>
              <p className="text-sm font-extrabold text-brand-950">Admin panel</p>
              <p className="text-xs text-ink-subtle">{roleName ?? "No role"}</p>
            </div>
          </div>
          <NavList />
        </div>
      </aside>

      <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
        <p className="flex items-center gap-2 text-sm font-bold text-brand-950">
          <ShieldCheck className="size-5 text-brand-700" aria-hidden /> Admin panel{here ? ` · ${here.label}` : ""}
        </p>
        <IconButton label="Open admin menu" aria-haspopup="dialog" onClick={() => setOpen(true)}>
          <Menu className="size-6" aria-hidden />
        </IconButton>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Admin sections" className="lg:hidden">
        <div className="max-h-[75dvh] overflow-y-auto p-4">
          <NavList onNavigate={() => setOpen(false)} />
        </div>
      </Dialog>

      <div className="min-w-0 flex-1" id="admin-content">
        {children}
      </div>
    </div>
  );
}

/**
 * Frame for every /admin page. It needs a signed-in administrator (the backend's `/me` is the source of
 * truth). Visitors who are not signed in get the admin log-in form (email and password only); a signed-in
 * non-administrator gets a plain message. Hiding sections here is only convenience: the API refuses
 * what the role does not allow, whatever this page shows.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { state, reload } = useMe();
  if (state.status === "loading") {
    return (
      <div className="container-page space-y-4 py-8" aria-busy="true" aria-label="Loading the admin panel">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (state.status === "unauthenticated") return <AdminLogin onSignedIn={reload} />;
  if (state.status === "error") {
    return <ErrorState action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>;
  }
  const me = state.data;
  return me.isAdmin ? (
    <AdminProvider me={me}>
      <Frame>{children}</Frame>
    </AdminProvider>
  ) : (
    <div className="container-page py-16">
      <Alert tone="error" title="Administrators only">
        This area is for FixedItNow administrators.
      </Alert>
      <div className="mt-6">
        <LinkButton href="/account" variant="secondary">Back to my account</LinkButton>
      </div>
    </div>
  );
}
