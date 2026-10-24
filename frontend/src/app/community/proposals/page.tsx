import type { Metadata } from "next";
import { ProposalsView } from "@/components/community/proposals";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Feature proposals", description: "Suggest and vote on features for FixedItNow.", robots: { index: false } };

export default function ProposalsPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Community", href: "/community" }, { label: "Feature proposals" }]}
        title="Feature proposals"
        description="Vote for what you would like to see next. The team reviews proposals and publishes its decision."
      />
      <section className="section-y" aria-label="Proposals">
        <div className="container-page max-w-3xl"><ProposalsView /></div>
      </section>
    </>
  );
}
