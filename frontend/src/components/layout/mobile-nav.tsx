"use client";

import { Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, IconButton, LinkButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useMe } from "@/lib/use-api";
import { authClient } from "@/lib/auth-client";
import { AUTH_LINKS, PRIMARY_NAV } from "@/lib/site";
import { NavLink } from "./nav-link";

/** Mobile/tablet navigation: a native modal dialog with all primary links. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();
  const close = () => setOpen(false);

  async function logOut() {
    await authClient.signOut();
    close();
    router.replace("/");
    router.refresh();
  }

  return (
    <>
      <IconButton
        label="Open menu"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="lg:hidden"
      >
        <Menu className="size-6" aria-hidden />
      </IconButton>
      <Dialog open={open} onClose={close} title="Menu" className="lg:hidden">
        <nav aria-label="Mobile" className="flex flex-col gap-1 p-4">
          {PRIMARY_NAV.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              onNavigate={close}
              className="flex min-h-12 items-center rounded-control px-3 text-base font-semibold text-ink-muted hover:bg-surface-strong"
              activeClassName="bg-brand-50 text-brand-800"
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line p-4">
          {isPending ? null : session ? (
            <div className="grid grid-cols-2 gap-3">
              <LinkButton href="/account" variant="secondary" onClick={close}>
                My account
              </LinkButton>
              <LinkButton href="/account/notifications" variant="secondary" onClick={close}>
                Notifications
              </LinkButton>
              <LinkButton href="/account/support" variant="secondary" onClick={close}>
                Support
              </LinkButton>
              {open && <MobileAdminLink onNavigate={close} />}
              <Button onClick={logOut}>Log out</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <LinkButton href={AUTH_LINKS.login.href} variant="secondary" onClick={close}>
                {AUTH_LINKS.login.label}
              </LinkButton>
              <LinkButton href={AUTH_LINKS.signup.href} onClick={close}>
                {AUTH_LINKS.signup.label}
              </LinkButton>
            </div>
          )}
        </div>
      </Dialog>
    </>
  );
}

/** Admin entry for administrators; mounted only while the menu is open for a signed-in user. */
function MobileAdminLink({ onNavigate }: { onNavigate: () => void }) {
  const { state } = useMe();
  if (state.status !== "ready" || !state.data.isAdmin) return null;
  return (
    <LinkButton href="/admin" variant="secondary" onClick={onNavigate}>
      Admin panel
    </LinkButton>
  );
}
