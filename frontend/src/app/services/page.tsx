import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ServiceDirectory } from "@/components/services/service-directory";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Browse the home and repair service categories FixedItNow is built around, from electrical work and plumbing to AC servicing and cleaning.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Services" }]}
        title="Browse services"
        description="Explore the categories FixedItNow is being built around. Professional listings for each category will appear as workers join."
      />
      <section className="section-y" aria-label="Service categories">
        <div className="container-page">
          <ServiceDirectory />
        </div>
      </section>
    </>
  );
}
