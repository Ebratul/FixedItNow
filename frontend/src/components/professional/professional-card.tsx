import Link from "next/link";
import { BadgeCheck, Clock, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Price } from "@/components/ui/price";
import { Rating } from "@/components/ui/rating";
import type { WorkerCardData } from "@/lib/discovery-types";
import { FavoriteButton } from "./favorite-button";

/**
 * Public listing card. It renders only the explicit public projection the API
 * returns. The "Profile reviewed" badge is shown only when the server says the
 * profile is VERIFIED; there are no invented ratings (rating is null until
 * reviews exist) and no availability claims (no availability data yet).
 */
export function ProfessionalCard({
  pro,
  headingLevel = 3,
}: {
  pro: WorkerCardData;
  headingLevel?: 2 | 3;
}) {
  const Heading = `h${headingLevel}` as const;
  return (
    <Card interactive className="relative flex h-full flex-col p-5">
      <FavoriteButton workerId={pro.id} workerName={pro.displayName} className="absolute top-4 right-4" />
      <div className="flex items-start gap-4 pr-12">
        <Avatar name={pro.displayName} className="size-14" />
        <div className="min-w-0">
          <Heading className="truncate text-base font-bold text-ink">{pro.displayName}</Heading>
          {pro.headline && <p className="line-clamp-2 text-sm text-ink-muted">{pro.headline}</p>}
          {pro.serviceAreas.length > 0 && (
            <p className="mt-1 flex items-center gap-1 text-sm text-ink-subtle">
              <MapPin className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{pro.serviceAreas.join(", ")}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {pro.verification === "VERIFIED" && (
          <Badge tone="success">
            <BadgeCheck className="size-3.5" aria-hidden />
            Profile reviewed
          </Badge>
        )}
        {pro.categories.slice(0, 2).map((c) => (
          <Badge key={c.slug} tone="brand">
            {c.name}
          </Badge>
        ))}
        {pro.categories.length > 2 && <Badge>+{pro.categories.length - 2} more</Badge>}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
        <div>
          <dt className="sr-only">Rating</dt>
          <dd>
            <Rating value={pro.rating} reviewCount={pro.reviewCount} />
          </dd>
        </div>
        {pro.experienceYears !== null && (
          <div>
            <dt className="sr-only">Experience</dt>
            <dd className="flex items-center gap-1 text-ink-muted">
              <Clock className="size-4" aria-hidden />
              {pro.experienceYears} {pro.experienceYears === 1 ? "yr" : "yrs"} experience
            </dd>
          </div>
        )}
        <div className="col-span-2">
          <dt className="sr-only">Starting price</dt>
          <dd>
            {pro.startingPriceBdt !== null ? (
              <Price amount={pro.startingPriceBdt} prefix="From" />
            ) : (
              <span className="text-ink-subtle">Price on request</span>
            )}
          </dd>
        </div>
      </dl>

      <Link
        href={`/workers/${pro.slug}`}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-control border border-line-strong text-sm font-semibold text-ink hover:border-brand-300 hover:bg-brand-50"
      >
        View profile <span className="sr-only">of {pro.displayName}</span>
      </Link>
    </Card>
  );
}
