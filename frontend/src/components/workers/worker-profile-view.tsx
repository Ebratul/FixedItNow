import { BadgeCheck, CalendarClock, Clock, Languages, MapPin, ShieldCheck, Star } from "lucide-react";
import { FavoriteButton } from "@/components/professional/favorite-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Price } from "@/components/ui/price";
import { Rating } from "@/components/ui/rating";
import type { WorkerProfileData } from "@/lib/discovery-types";

const PRICING_LABELS = { FIXED: "Fixed price", HOURLY: "Per hour", QUOTE: "Quote after inspection" } as const;

/**
 * Public profile. All worker-provided text is rendered as plain React text
 * (escaped); there are no links, HTML, or images from user input.
 */
export function WorkerProfileView({ worker }: { worker: WorkerProfileData }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-8">
        <Card className="p-6">
          <div className="flex items-start gap-5">
            <Avatar name={worker.displayName} className="size-20 text-xl" />
            <div className="min-w-0">
              <h1 className="text-h1 font-extrabold break-words text-brand-950">{worker.displayName}</h1>
              {worker.headline && <p className="mt-1 text-lg text-ink-muted">{worker.headline}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {worker.verification === "VERIFIED" && (
                  <Badge tone="success">
                    <BadgeCheck className="size-3.5" aria-hidden /> Profile reviewed
                  </Badge>
                )}
                {worker.categories.map((c) => (
                  <Badge key={c.slug} tone="brand">{c.name}</Badge>
                ))}
              </div>
            </div>
          </div>
          <dl className="mt-6 grid gap-4 border-t border-line pt-5 text-sm sm:grid-cols-3">
            <div>
              <dt className="flex items-center gap-1.5 text-ink-subtle"><MapPin className="size-4" aria-hidden /> Service areas</dt>
              <dd className="mt-1 font-semibold">{worker.serviceAreas.join(", ") || "—"}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-ink-subtle"><Clock className="size-4" aria-hidden /> Experience</dt>
              <dd className="mt-1 font-semibold">
                {worker.experienceYears !== null ? `${worker.experienceYears} ${worker.experienceYears === 1 ? "year" : "years"}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-ink-subtle"><Languages className="size-4" aria-hidden /> Languages</dt>
              <dd className="mt-1 font-semibold">{worker.languages.join(", ") || "—"}</dd>
            </div>
          </dl>
        </Card>

        {worker.bio && (
          <section aria-labelledby="about-heading">
            <h2 id="about-heading" className="text-h2 font-extrabold">About</h2>
            <p className="mt-3 max-w-prose text-lg whitespace-pre-line text-ink-muted">{worker.bio}</p>
          </section>
        )}

        <section aria-labelledby="services-heading">
          <h2 id="services-heading" className="text-h2 font-extrabold">Services and pricing</h2>
          <ul className="mt-4 divide-y divide-line rounded-card border border-line">
            {worker.services.map((service) => (
              <li key={service.category.slug} className="flex flex-wrap items-start justify-between gap-3 p-4">
                <div>
                  <h3 className="font-bold">{service.category.name}</h3>
                  {service.pricingNotes && <p className="mt-1 text-sm text-ink-muted">{service.pricingNotes}</p>}
                </div>
                <div className="text-right text-sm">
                  {service.basePriceBdt !== null ? (
                    <Price amount={service.basePriceBdt} prefix="From" />
                  ) : (
                    <span className="font-semibold text-ink-muted">Price on request</span>
                  )}
                  <p className="text-ink-subtle">{PRICING_LABELS[service.pricingModel]}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-ink-subtle">
            Prices are the professional&apos;s own starting rates. The final price is agreed before work begins.
          </p>
        </section>

        <section aria-labelledby="reviews-heading">
          <h2 id="reviews-heading" className="text-h2 font-extrabold">Reviews</h2>
          <div className="mt-3 flex items-start gap-3 rounded-card border border-dashed border-line-strong bg-surface p-4">
            <Star className="mt-0.5 size-5 shrink-0 text-ink-subtle" aria-hidden />
            <div className="text-sm text-ink-muted">
              <Rating value={worker.rating} reviewCount={worker.reviewCount} />
              <p className="mt-1">
                Reviews will appear here after customers complete jobs. We never show invented ratings.
              </p>
            </div>
          </div>
        </section>
      </div>

      <aside aria-label="Actions" className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="p-5">
          <p className="text-sm text-ink-subtle">Starting price</p>
          <p className="mt-1 text-2xl font-extrabold">
            {worker.startingPriceBdt !== null ? <Price amount={worker.startingPriceBdt} /> : "On request"}
          </p>
          <div className="mt-5 space-y-3">
            <Button disabled className="w-full" size="lg" aria-describedby="booking-note">
              <CalendarClock className="size-5" aria-hidden /> Booking not available yet
            </Button>
            <p id="booking-note" className="text-sm text-ink-subtle">
              Booking requests are coming in a later release. You can save this professional in the meantime.
            </p>
            <FavoriteButton workerId={worker.id} workerName={worker.displayName} showLabel className="w-full [&>button]:w-full" />
          </div>
        </Card>
        <Card className="p-5 text-sm text-ink-muted">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <ShieldCheck className="size-4 text-accent-600" aria-hidden /> About &ldquo;Profile reviewed&rdquo;
          </p>
          <p className="mt-2">
            A FixedItNow reviewer approved this profile. Identity documents are not collected yet, so this is
            not an identity check.
          </p>
        </Card>
      </aside>
    </div>
  );
}
