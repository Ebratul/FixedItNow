"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { IconButton, LinkButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AUTH_LINKS, PRIMARY_NAV } from "@/lib/site";
import { NavLink } from "./nav-link";

/** Mobile/tablet navigation: a native modal dialog with all primary links. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

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
        <div className="grid grid-cols-2 gap-3 border-t border-line p-4">
          <LinkButton href={AUTH_LINKS.login.href} variant="secondary" onClick={close}>
            {AUTH_LINKS.login.label}
          </LinkButton>
          <LinkButton href={AUTH_LINKS.signup.href} onClick={close}>
            {AUTH_LINKS.signup.label}
          </LinkButton>
        </div>
      </Dialog>
    </>
  );
}
