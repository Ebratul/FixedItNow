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
    text: "A “Profile reviewed” label is shown only after an administrator approves a worker. Pending and rejected states are never dressed up.",
  },
  {
    icon: MessageSquareText,
    title: "Problems stay with the booking",
    text: "If something goes wrong, open a dispute on the booking. The messages about it stay attached to that booking.",
  },
  {
    icon: Star,
    title: "Reviews from completed jobs",
    text: "Ratings are calculated from real reviews, never invented.",
  },
  {
    icon: LifeBuoy,
    title: "Dispute handling",
    text: "A defined process, with an administrator review, for resolving problems between customers and professionals.",
  },
];

export function TrustSection() {
  return (
    <section
      aria-labelledby="trust-heading"
      className="section-y relative overflow-hidden bg-brand-950 text-white"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-0 size-[28rem] rounded-full bg-accent-500/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-24 size-[28rem] rounded-full bg-brand-500/20 blur-3xl"
      />
      <div className="container-page relative">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow mb-3 text-accent-300">
              <span
                aria-hidden
                className="h-0.5 w-6 rounded-full bg-accent-400"
              />
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
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TRUST_PRINCIPLES.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="flex gap-4 rounded-card border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-accent-400/40 hover:bg-white/[0.08]"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-gradient-to-br from-accent-400/30 to-accent-600/20 text-accent-300 ring-1 ring-accent-300/20">
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

