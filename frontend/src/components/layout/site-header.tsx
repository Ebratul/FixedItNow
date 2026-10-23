import { LinkButton } from "@/components/ui/button";
import { AUTH_LINKS, PRIMARY_NAV } from "@/lib/site";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { NavLink } from "./nav-link";
import { ServicesMenu } from "./services-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/85">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {PRIMARY_NAV.map((link) =>
            link.href === "/services" ? (
              <ServicesMenu key={link.href} />
            ) : (
              <NavLink
                key={link.href}
                href={link.href}
                className="inline-flex min-h-11 items-center rounded-control px-3 text-sm font-semibold text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink"
                activeClassName="text-brand-800"
              >
                {link.label}
              </NavLink>
            ),
          )}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            <LinkButton href={AUTH_LINKS.login.href} variant="ghost">
              {AUTH_LINKS.login.label}
            </LinkButton>
            <LinkButton href={AUTH_LINKS.signup.href}>
              {AUTH_LINKS.signup.label}
            </LinkButton>
          </div>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
