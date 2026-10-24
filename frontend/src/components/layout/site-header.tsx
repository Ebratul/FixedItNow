import Link from "next/link";
import { Suspense } from "react";
import { PRIMARY_NAV } from "@/lib/site";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { NavLink } from "./nav-link";
import { ServicesMenu } from "./services-menu";
import { UserMenu } from "./user-menu";

const linkClasses =
  "inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink";

/**
 * Active-link styling needs the current pathname, which is unknown when
 * prerendering routes with dynamic segments. The nav therefore sits in a
 * Suspense boundary; until it resolves, the same links render without the
 * active state.
 */
function StaticNav() {
  return (
    <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
      {PRIMARY_NAV.map((link) => (
        <Link key={link.href} href={link.href} className={linkClasses}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/85">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />

        <Suspense fallback={<StaticNav />}>
          <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
            {PRIMARY_NAV.map((link) =>
              link.href === "/services" ? (
                <ServicesMenu key={link.href} />
              ) : (
                <NavLink
                  key={link.href}
                  href={link.href}
                  className={linkClasses}
                  activeClassName="text-brand-800"
                >
                  {link.label}
                </NavLink>
              ),
            )}
          </nav>
        </Suspense>

        <div className="flex items-center gap-2">
          <UserMenu />
          <Suspense fallback={<div aria-hidden className="size-11 lg:hidden" />}>
            <MobileNav />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
