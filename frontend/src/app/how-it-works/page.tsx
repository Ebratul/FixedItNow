import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { STEPS } from "@/components/home/how-it-works";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "See how FixedItNow is designed to help you search for, compare, and book trusted service professionals in Bangladesh.",
};

const STATUS: Record<string, { label: string; tone: "success" | "warning" }> = {
  "Search for a service": { label: "Preview available", tone: "success" },
  "Compare professionals": { label: "Coming soon", tone: "warning" },
  "Request or book": { label: "Coming soon", tone: "warning" },
  "Complete and review": { label: "Coming soon", tone: "warning" },
};

export default function HowItWorksPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "How it works" }]}
        title="How FixedItNow works"
        description="The customer journey we are building, and where each step stands today."
      />
      <section className="section-y" aria-label="Steps">
        <div className="container-page">
          <ol className="grid gap-6 md:grid-cols-2">
            {STEPS.map(({ icon: Icon, title, text }, index) => (
              <li
                key={title}
                className="rounded-card border border-line bg-canvas p-6 shadow-card"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex size-12 items-center justify-center rounded-full bg-brand-700 text-white">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <Badge tone={STATUS[title].tone}>{STATUS[title].label}</Badge>
                </div>
                <h2 className="mt-5 text-xl font-bold">
                  <span className="text-accent-700">Step {index + 1}.</span>{" "}
                  {title}
                </h2>
                <p className="mt-2 text-ink-muted">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <LinkButton href="/services" size="lg">
              Browse services
            </LinkButton>
          </div>
        </div>
      </section>
    </>
  );
}
