import type { Metadata } from "next";
import { FaqList } from "@/components/home/faq-section";
import { PageHeader } from "@/components/layout/page-header";
import { LinkButton } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description: "Answers to common questions about FixedItNow.",
};

export default function HelpPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Help" }]}
        title="Help & FAQ"
        description="Answers to common questions, including what works today and what is still on the way."
      />
      <section className="section-y" aria-label="Frequently asked questions">
        <div className="container-page max-w-3xl">
          <FaqList />
          <p className="mt-8 text-ink-muted">
            Can’t find your answer?{" "}
            <LinkButton href="/contact" variant="ghost" size="sm" className="-ml-1">
              Contact us
            </LinkButton>
          </p>
        </div>
      </section>
    </>
  );
}
