import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { CheckCircle2, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Become a worker",
  description:
    "Create a worker profile on FixedItNow, submit it for review, and get ready to offer your services.",
};

const AVAILABLE_NOW = [
  "Create an account and set up a worker profile with your skills, experience, and service areas.",
  "List the services you offer with a pricing model and base price.",
  "Submit your profile for review. A reviewer approves it, asks for changes, or declines it.",
];

const COMING_LATER = [
  "Identity document verification and the public Verified badge.",
  "Public worker listings and search.",
  "Availability, booking requests, messaging, and payments.",
];

export default function BecomeAWorkerPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Become a worker" }]}
        title="Grow your service business"
        description="You can set up a worker profile today. Public listings and bookings come in later releases."
      >
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href="/onboarding/worker" size="lg">
            Start worker profile
          </LinkButton>
          <LinkButton href="/register" variant="secondary" size="lg">
            Create an account
          </LinkButton>
        </div>
      </PageHeader>
      <section className="section-y" aria-label="What is available">
        <div className="container-page grid max-w-5xl gap-12 md:grid-cols-2">
          <div>
            <h2 className="flex items-center gap-3 text-h2 font-extrabold">
              Available now <Badge tone="success">Live</Badge>
            </h2>
            <ul className="mt-8 space-y-4">
              {AVAILABLE_NOW.map((item) => (
                <li key={item} className="flex gap-3 text-ink-muted">
                  <CheckCircle2 className="mt-1 size-5 shrink-0 text-accent-600" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="flex items-center gap-3 text-h2 font-extrabold">
              Coming later <Badge tone="warning">Not yet</Badge>
            </h2>
            <ul className="mt-8 space-y-4">
              {COMING_LATER.map((item) => (
                <li key={item} className="flex gap-3 text-ink-muted">
                  <Clock className="mt-1 size-5 shrink-0 text-ink-subtle" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
