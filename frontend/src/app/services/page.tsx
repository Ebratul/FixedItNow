import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ServiceDirectory } from "@/components/services/service-directory";
import { ErrorState } from "@/components/ui/error-state";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCategories } from "@/lib/discovery";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Browse FixedItNow service categories, from electrical work and plumbing to AC servicing and cleaning, and find professionals in each.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Services" }]}
        title="Browse services"
        description="Pick a category to see the professionals listed for it. Counts are computed from real, published profiles."
      />
      <section className="section-y" aria-label="Service categories">
        <div className="container-page">
          <Suspense fallback={<CategoriesFallback />}>
            <Categories />
          </Suspense>
        </div>
      </section>
    </>
  );
}

async function Categories() {
  let categories: Awaited<ReturnType<typeof getCategories>> | undefined;
  try {
    categories = await getCategories();
  } catch {
    categories = undefined;
  }
  if (!categories) {
    return (
      <ErrorState
        title="We couldn't load services"
        action={<LinkButton href="/services">Try again</LinkButton>}
      >
        The service is temporarily unavailable. Please try again in a moment.
      </ErrorState>
    );
  }
  return <ServiceDirectory categories={categories} />;
}

function CategoriesFallback() {
  return (
    <div aria-busy="true" aria-label="Loading services" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="h-44" />
      ))}
    </div>
  );
}
