import Link from "next/link";
import {
  BadgeCheck,
  Banknote,
  CalendarCheck,
  Search,
  ShieldCheck,
} from "lucide-react";
import { CategoryIcon, FEATURED_CATEGORIES } from "@/lib/category-icons";
import { SearchForm } from "./search-form";

const HIGHLIGHTS = [
  { icon: Banknote, label: "Transparent pricing" },
  { icon: BadgeCheck, label: "Verification you can see" },
  { icon: ShieldCheck, label: "Disputes handled on the booking" },
];

/** Shortcuts into the search page; they only prefill the query. */
const POPULAR_SEARCHES = ["Electrician", "Plumber", "AC servicing", "Cleaning"];

export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-surface to-canvas"
    >
      {/* Decorative background: glows and a soft grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-32 size-[28rem] rounded-full bg-brand-300/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-10 -right-24 size-[26rem] rounded-full bg-accent-200/60 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] [background-size:48px_48px] opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_80%)]"
      />

      <div className="container-page relative grid items-center gap-14 py-14 md:py-24 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="animate-fade-up">
          <p className="inline-flex items-center gap-2 rounded-full border border-accent-200 bg-canvas/80 px-3.5 py-1.5 text-sm font-semibold text-accent-800 shadow-card backdrop-blur">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent-400 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-accent-500" />
            </span>
            Built for Bangladesh
          </p>
          <h1
            id="hero-heading"
            className="mt-6 text-display font-extrabold text-balance text-brand-950"
          >
            Find <span className="text-gradient">trusted professionals</span>{" "}
            for every job.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-muted text-pretty">
            From everyday home repairs to essential services, discover local
            professionals who can help you get the job done.
          </p>

          <div className="mt-8 max-w-2xl">
            <SearchForm />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-ink-subtle">Popular:</span>
            {POPULAR_SEARCHES.map((term) => (
              <Link
                key={term}
                href={`/workers?q=${encodeURIComponent(term)}`}
                className="rounded-full border border-line-strong bg-canvas/80 px-3 py-1 font-semibold text-ink-muted transition-colors hover:border-accent-300 hover:bg-accent-50 hover:text-accent-800"
              >
                {term}
              </Link>
            ))}
          </div>

          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-t border-line pt-6">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2 text-sm font-semibold text-ink-muted"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                  <Icon className="size-4" aria-hidden />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Decorative service preview; it contains no listings or claims. */}
        <div aria-hidden className="relative hidden lg:block">
          <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand-200/60 to-accent-200/60 blur-2xl" />
          <div className="relative rounded-panel border border-line bg-canvas p-5 shadow-pop">
            <div className="flex items-center gap-2 rounded-control border border-line bg-surface px-3 py-2.5 text-sm text-ink-subtle">
              <Search className="size-4" />
              Search services
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {FEATURED_CATEGORIES.map(({ slug, name }) => (
                <div
                  key={slug}
                  className="flex items-center gap-3 rounded-card border border-line p-3 transition-colors hover:border-brand-300"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-control bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700">
                    <CategoryIcon slug={slug} className="size-5" />
                  </span>
                  <span className="text-sm font-semibold text-ink">{name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -bottom-5 -left-8 flex animate-float items-center gap-3 rounded-card border border-line bg-canvas px-4 py-3 shadow-lift">
            <span className="flex size-9 items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <CalendarCheck className="size-5" />
            </span>
            <span className="text-sm font-bold text-ink">Request a time</span>
          </div>
          <div className="absolute -top-4 -right-4 flex animate-float-slow items-center gap-2 rounded-full border border-accent-200 bg-canvas px-3.5 py-2 shadow-lift">
            <BadgeCheck className="size-5 text-accent-600" />
            <span className="text-sm font-bold text-ink">Profile reviewed</span>
          </div>
        </div>
      </div>
    </section>
  );
}
