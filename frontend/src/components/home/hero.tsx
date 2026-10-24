import { BadgeCheck, Banknote, Search, ShieldCheck } from "lucide-react";
import { CategoryIcon, FEATURED_CATEGORIES } from "@/lib/category-icons";
import { SearchForm } from "./search-form";

const HIGHLIGHTS = [
  { icon: Banknote, label: "Transparent pricing" },
  { icon: BadgeCheck, label: "Verification you can see" },
  { icon: ShieldCheck, label: "Booking-linked support" },
];

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden bg-surface"
    >
      {/* Soft grid texture, decorative only */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] [background-size:48px_48px] opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
      />
      <div className="container-page relative grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="animate-fade-up">
          <p className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-accent-50 px-3 py-1 text-sm font-semibold text-accent-800">
            <span className="size-1.5 rounded-full bg-accent-500" aria-hidden />
            Built for Bangladesh
          </p>
          <h1 className="mt-5 text-display font-extrabold text-balance text-brand-950">
            Find trusted professionals for every job.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-muted text-pretty">
            From everyday home repairs to essential services, discover local
            professionals who can help you get the job done.
          </p>

          <div className="mt-8 max-w-2xl">
            <SearchForm />
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2 text-sm font-semibold text-ink-muted"
              >
                <Icon className="size-5 text-accent-600" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Decorative service preview; it contains no listings or claims. */}
        <div aria-hidden className="hidden lg:block">
          <div className="rounded-panel border border-line bg-canvas p-5 shadow-pop">
            <div className="flex items-center gap-2 rounded-control bg-surface px-3 py-2.5 text-sm text-ink-subtle">
              <Search className="size-4" />
              Search services
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {FEATURED_CATEGORIES.map(({ slug, name }) => (
                <div
                  key={slug}
                  className="flex items-center gap-3 rounded-card border border-line p-3"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-brand-100 text-brand-700">
                    <CategoryIcon slug={slug} className="size-5" />
                  </span>
                  <span className="text-sm font-semibold text-ink">{name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
