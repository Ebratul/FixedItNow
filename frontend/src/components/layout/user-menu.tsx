"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CalendarDays, ChevronDown, Heart, LifeBuoy, LogOut, Receipt, ShieldCheck, UserRound } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { LinkButton } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { AUTH_LINKS } from "@/lib/site";
import { useDismiss } from "@/lib/use-dismiss";
import { useMe } from "@/lib/use-api";

/**
 * Header account area. Reflects the session for convenience only; it grants no
 * access, since the backend authorises every request.
 */
export function UserMenu() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, rootRef);

  async function logOut() {
    setSigningOut(true);
    await authClient.signOut();
    setOpen(false);
    router.replace("/");
    router.refresh();
    setSigningOut(false);
  }

  if (isPending) {
    return <div aria-hidden className="hidden h-11 w-40 animate-pulse rounded-control bg-surface-strong sm:block" />;
  }

  if (!session) {
    return (
      <div className="hidden items-center gap-2 sm:flex">
        <LinkButton href={AUTH_LINKS.login.href} variant="ghost">
          {AUTH_LINKS.login.label}
        </LinkButton>
        <LinkButton href={AUTH_LINKS.signup.href}>{AUTH_LINKS.signup.label}</LinkButton>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative hidden items-center gap-1 sm:flex">
      <NotificationBell />
      <button
        type="button"
        aria-expanded={open}
        aria-controls="user-menu-panel"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 hover:bg-surface-strong"
      >
        <Avatar name={session.user.name} className="size-8 text-xs" />
        <span className="max-w-32 truncate text-sm font-semibold text-ink">{session.user.name}</span>
        <ChevronDown className={cn("size-4 text-ink-subtle transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div
          id="user-menu-panel"
          className="absolute top-full right-0 z-50 mt-2 w-56 rounded-card border border-line bg-canvas p-2 shadow-pop"
        >
          <p className="truncate px-3 py-2 text-xs text-ink-subtle">{session.user.email}</p>
          <Link
            href="/account"
            onClick={close}
            className="flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium text-ink hover:bg-brand-50"
          >
            <UserRound className="size-4 text-brand-600" aria-hidden />
            My account
          </Link>
          <Link
            href="/bookings"
            onClick={close}
            className="flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium text-ink hover:bg-brand-50"
          >
            <CalendarDays className="size-4 text-brand-600" aria-hidden />
            My bookings
          </Link>
          <Link
            href="/payments"
            onClick={close}
            className="flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium text-ink hover:bg-brand-50"
          >
            <Receipt className="size-4 text-brand-600" aria-hidden />
            Payments
          </Link>
          <Link
            href="/account/favorites"
            onClick={close}
            className="flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium text-ink hover:bg-brand-50"
          >
            <Heart className="size-4 text-brand-600" aria-hidden />
            Favorites
          </Link>
          <Link
            href="/account/notifications"
            onClick={close}
            className="flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium text-ink hover:bg-brand-50"
          >
            <Bell className="size-4 text-brand-600" aria-hidden />
            Notifications
          </Link>
          <Link
            href="/account/support"
            onClick={close}
            className="flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium text-ink hover:bg-brand-50"
          >
            <LifeBuoy className="size-4 text-brand-600" aria-hidden />
            Support
          </Link>
          <AdminPanelLink onNavigate={close} />
          <button
            type="button"
            onClick={logOut}
            disabled={signingOut}
            className="flex min-h-11 w-full items-center gap-3 rounded-control px-3 text-sm font-medium text-ink hover:bg-brand-50 disabled:opacity-60"
          >
            <LogOut className="size-4 text-brand-600" aria-hidden />
            {signingOut ? "Logging out…" : "Log out"}
          </button>
        </div>
      )}
    </div>
  );
}

/** "Admin panel" entry for administrators. Mounted only while the menu is open for a signed-in user, so /me is fetched then. */
function AdminPanelLink({ onNavigate }: { onNavigate: () => void }) {
  const { state } = useMe();
  if (state.status !== "ready" || !state.data.isAdmin) return null;
  return (
    <Link
      href="/admin"
      onClick={onNavigate}
      className="flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium text-ink hover:bg-brand-50"
    >
      <ShieldCheck className="size-4 text-brand-600" aria-hidden />
      Admin panel
    </Link>
  );
}
