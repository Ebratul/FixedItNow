import { ArrowRight } from "lucide-react";
import { LinkButton } from "@/components/ui/button";

export function WorkerCta() {
  return (
    <section aria-labelledby="worker-cta-heading" className="section-y">
      <div className="container-page">
        <div className="flex flex-col items-start justify-between gap-6 rounded-panel border border-accent-200 bg-accent-50 p-8 md:flex-row md:items-center md:p-12">
          <div className="max-w-xl">
            <h2
              id="worker-cta-heading"
              className="text-h2 font-extrabold text-balance text-accent-900"
            >
              Are you a skilled professional?
            </h2>
            <p className="mt-3 text-lg text-accent-800 text-pretty">
              FixedItNow is being built so skilled workers can publish their
              services, set clear prices, and build a reputation. See how it
              will work.
            </p>
          </div>
          <LinkButton href="/become-a-worker" variant="accent" size="lg">
            Become a worker
            <ArrowRight className="size-5" aria-hidden />
          </LinkButton>
        </div>
      </div>
    </section>
  );
}
