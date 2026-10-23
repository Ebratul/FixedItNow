import Link from "next/link";
import { BadgeCheck, Clock, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Price } from "@/components/ui/price";
import { Rating } from "@/components/ui/rating";

/** Mirrors the SRS verification statuses (FR-WRK-05). */
export type VerificationStatus =
  | "NOT_SUBMITTED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "RESUBMISSION_REQUIRED";

/**
 * Public-safe professional summary. It intentionally has no NID, phone, email,
 * or document fields: only data that is allowed on public pages (FR-WRK-08).
 */
export type ProfessionalSummary = {
  id: string;
  name: string;
  category: string;
  location: string;
  photoUrl?: string | null;
  /** Real aggregates only (FR-SVC-07). `null` when there are no reviews. */
  rating: number | null;
  reviewCount: number;
  experienceYears?: number;
  startingPrice?: number;
  verification: VerificationStatus;
  available?: boolean;
};

/**
 * Professional card. The "Verified" badge appears only when the backend status
 * is exactly VERIFIED. Nothing here fabricates data: every field is a prop.
 */
export function ProfessionalCard({ pro }: { pro: ProfessionalSummary }) {
  return (
    <Card interactive className="flex h-full flex-col p-5">
      <div className="flex items-start gap-4">
        <Avatar name={pro.name} src={pro.photoUrl} className="size-14" />
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-ink">{pro.name}</h3>
          <p className="text-sm text-ink-muted">{pro.category}</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-ink-subtle">
            <MapPin className="size-3.5" aria-hidden />
            {pro.location}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {pro.verification === "VERIFIED" && (
          <Badge tone="success">
            <BadgeCheck className="size-3.5" aria-hidden />
            Verified
          </Badge>
        )}
        {pro.available !== undefined && (
          <Badge tone={pro.available ? "brand" : "neutral"}>
            {pro.available ? "Available" : "Unavailable"}
          </Badge>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
        <div>
          <dt className="sr-only">Rating</dt>
          <dd>
            <Rating value={pro.rating} reviewCount={pro.reviewCount} />
          </dd>
        </div>
        {pro.experienceYears !== undefined && (
          <div>
            <dt className="sr-only">Experience</dt>
            <dd className="flex items-center gap-1 text-ink-muted">
              <Clock className="size-4" aria-hidden />
              {pro.experienceYears} yrs experience
            </dd>
          </div>
        )}
        {pro.startingPrice !== undefined && (
          <div className="col-span-2">
            <dt className="sr-only">Starting price</dt>
            <dd>
              <Price amount={pro.startingPrice} prefix="From" />
            </dd>
          </div>
        )}
      </dl>

      <Link
        href={`/workers/${pro.id}`}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-control border border-line-strong text-sm font-semibold text-ink hover:border-brand-300 hover:bg-brand-50"
      >
        View profile
      </Link>
    </Card>
  );
}
