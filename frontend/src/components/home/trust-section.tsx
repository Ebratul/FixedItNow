import {
  BadgeCheck,
  Banknote,
  LifeBuoy,
  MessageSquareText,
  Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const TRUST_PRINCIPLES = [
  {
    icon: Banknote,
    title: "Transparent service information",
    text: "Professionals publish their services, base prices, and pricing notes up front.",
  },
  {
    icon: BadgeCheck,
    title: "Honest verification status",
    text: "A Verified badge is shown only after a reviewer approves a worker. Pending and rejected states are never dressed up.",
  },
  {
    icon: MessageSquareText,
    title: "Booking-linked messaging",
    text: "Conversations stay attached to the booking they relate to.",
  },
  {
    icon: Star,
    title: "Reviews from completed jobs",
    text: "Ratings are calculated from real reviews, never invented.",
  },
  {
    icon: LifeBuoy,
    title: "Support and dispute handling",
    text: "A defined process for resolving problems between customers and professionals.",
  },
];

export function TrustSection() {
  return (
    <section
      aria-labelledby="trust-heading"
      className="section-y bg-brand-950 text-white"
    >
      <div className="container-page">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-2 text-sm font-semibold tracking-wide text-accent-300 uppercase">
              Trust & safety
            </p>
            <h2
              id="trust-heading"
              className="text-h2 font-extrabold text-balance"
            >
              Our commitments to customers and professionals
            </h2>
            <p className="mt-3 text-lg text-brand-200 text-pretty">
              These are the principles FixedItNow is built on. Features are
              being released in stages.
            </p>
          </div>
          <Badge tone="warning" className="self-start lg:self-auto">
            In development
          </Badge>
        </div>
        <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {TRUST_PRINCIPLES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-white/10 text-accent-300">
                <Icon className="size-6" aria-hidden />
              </span>
              <div>
                <h3 className="font-bold">{title}</h3>
                <p className="mt-1 text-sm text-brand-200">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

