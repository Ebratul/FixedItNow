import { ArrowRight, BadgeCheck, Banknote, Star } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

const PERKS = [
  { icon: Banknote, label: "Publish clear prices" },
  { icon: BadgeCheck, label: "Admin-reviewed profile" },
  { icon: Star, label: "Reviews from real jobs" },
];

export function WorkerCta() {
  return (
    <section aria-labelledby="worker-cta-heading" className="section-y">
      <div className="container-page">
        <div className="relative overflow-hidden rounded-panel bg-gradient-to-br from-accent-700 via-accent-800 to-brand-900 p-8 text-white shadow-pop md:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgb(255_255_255/0.14)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_left,black,transparent_70%)]"
          />
          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-xl">
              <h2
                id="worker-cta-heading"
                className="text-h2 font-extrabold text-balance"
              >
                Are you a skilled professional?
              </h2>
              <p className="mt-3 text-lg text-accent-100 text-pretty">
                Create a worker profile, publish your services with clear
                prices, and build a reputation through reviews from completed
                jobs. An administrator reviews each profile before it appears
                publicly.
              </p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {PERKS.map(({ icon: Icon, label }) => (
                  <li
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-semibold"
                  >
                    <Icon className="size-4 text-accent-200" aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            <LinkButton
              href="/become-a-worker"
              variant="light"
              size="lg"
            >
              Become a worker
              <ArrowRight className="size-5" aria-hidden />
            </LinkButton>
          </div>
        </div>
      </div>
    </section>
  );
}
