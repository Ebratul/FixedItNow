import Link from "next/link";
import {
  ArrowRight,
  ArrowUp,
  BadgeCheck,
  Banknote,
  ChevronRight,
  MessageCircleQuestion,
  Sparkles,
} from "lucide-react";
import { buttonClasses } from "@/components/ui/button";
import { FOOTER_GROUPS, SITE_NAME } from "@/lib/site";
import { Logo } from "./logo";

const TRUST_CHIPS = [
  { icon: Banknote, label: "Pay with bKash" },
  { icon: BadgeCheck, label: "Profiles reviewed by admins" },
];

export function SiteFooter() {
  return (
    <footer className="relative mt-auto overflow-hidden bg-brand-950 text-brand-200">
      {/* Gradient accent line along the top edge */}
      <div
        aria-hidden
        className="h-1 bg-gradient-to-r from-brand-500 via-accent-400 to-brand-500"
      />
      {/* Decorative glows, no content */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 size-96 rounded-full bg-brand-600/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 bottom-0 size-96 rounded-full bg-accent-500/15 blur-3xl"
      />

      <div className="container-page relative pt-14 pb-8">
        {/* Call to action */}
        <div className="flex flex-col items-start justify-between gap-6 rounded-panel border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03] p-6 shadow-pop backdrop-blur-sm md:flex-row md:items-center md:p-8">
          <div className="max-w-xl">
            <h2 className="text-h2 font-extrabold text-balance text-white">
              Something needs fixing?
            </h2>
            <p className="mt-2 text-brand-200 text-pretty">
              Search local professionals, or describe the job to the AI
              assistant and let it point you to the right category.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/services" className={buttonClasses("accent", "lg")}>
              Browse services
              <ArrowRight className="size-5" aria-hidden />
            </Link>
            <Link
              href="/assistant"
              className={buttonClasses(
                "ghost",
                "lg",
                "border border-white/20 text-white hover:bg-white/10 hover:text-white",
              )}
            >
              <Sparkles className="size-5 text-accent-300" aria-hidden />
              Ask the AI assistant
            </Link>
          </div>
        </div>

        {/* Brand + links */}
        <div className="mt-14 grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Logo tone="light" />
            <p className="mt-4 text-sm leading-relaxed text-brand-200">
              A Bangladesh-focused marketplace for finding trusted local
              service professionals. Currently in active development.
            </p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {TRUST_CHIPS.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-brand-100"
                >
                  <Icon className="size-3.5 text-accent-300" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>
          {FOOTER_GROUPS.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <h2 className="text-sm font-bold tracking-wide text-white uppercase">
                {group.title}
                <span
                  aria-hidden
                  className="mt-2 block h-0.5 w-8 rounded-full bg-accent-400"
                />
              </h2>
              <ul className="mt-4 space-y-0.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="group inline-flex min-h-9 items-center rounded text-sm text-brand-200 transition-colors hover:text-white"
                    >
                      <ChevronRight
                        className="size-3.5 w-0 text-accent-400 opacity-0 transition-all duration-200 group-hover:w-3.5 group-hover:opacity-100"
                        aria-hidden
                      />
                      <span>
                        {link.label}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-brand-300">
            © {SITE_NAME}. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <Link
              href="/help"
              className="inline-flex items-center gap-1.5 text-brand-200 transition-colors hover:text-white"
            >
              <MessageCircleQuestion className="size-4" aria-hidden />
              Need help?
            </Link>
            <a
              href="#main"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 font-semibold text-brand-100 transition-colors hover:bg-white/10 hover:text-white"
            >
              Back to top
              <ArrowUp className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
