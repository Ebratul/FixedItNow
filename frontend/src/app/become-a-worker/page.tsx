import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Become a worker",
  description:
    "Learn how skilled professionals will be able to join FixedItNow, publish services, and get verified.",
};

const EXPECT = [
  "Create a public profile with your skills, experience, and service area.",
  "List the services you offer with a base price and pricing notes.",
  "Set your availability and manage incoming requests.",
  "Submit identity documents privately for review. They are never shown publicly.",
  "Earn a Verified badge once a reviewer approves your documents.",
];

export default function BecomeAWorkerPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Become a worker" }]}
        title="Grow your service business"
        description="Worker registration is not open yet. Here is what joining FixedItNow is designed to look like."
      >
        <Badge tone="warning" className="mt-5">
          Registration not open
        </Badge>
      </PageHeader>
      <section className="section-y" aria-labelledby="expect-heading">
        <div className="container-page max-w-3xl">
          <h2 id="expect-heading" className="text-h2 font-extrabold">
            What to expect
          </h2>
          <ul className="mt-8 space-y-4">
            {EXPECT.map((item) => (
              <li key={item} className="flex gap-3 text-lg text-ink-muted">
                <CheckCircle2
                  className="mt-1 size-5 shrink-0 text-accent-600"
                  aria-hidden
                />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-10">
            <LinkButton href="/help" variant="secondary">
              Read the FAQ
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
