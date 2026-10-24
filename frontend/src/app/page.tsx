import { Suspense } from "react";
import { CategorySection } from "@/components/home/category-section";
import { FaqSection } from "@/components/home/faq-section";
import { FeaturedProfessionals } from "@/components/home/featured-professionals";
import { Hero } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { TrustSection } from "@/components/home/trust-section";
import { WorkerCta } from "@/components/home/worker-cta";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Suspense fallback={<CategoriesFallback />}>
        <CategorySection />
      </Suspense>
      <HowItWorks />
      <Suspense fallback={<FeaturedFallback />}>
        <FeaturedProfessionals />
      </Suspense>
      <TrustSection />
      <WorkerCta />
      <FaqSection />
    </>
  );
}

function CategoriesFallback() {
  return (
    <section aria-busy="true" aria-label="Loading services" className="section-y">
      <div className="container-page grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    </section>
  );
}

function FeaturedFallback() {
  return (
    <section aria-busy="true" aria-label="Loading professionals" className="section-y">
      <div className="container-page grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="hidden h-64 sm:block" />
        <Skeleton className="hidden h-64 lg:block" />
      </div>
    </section>
  );
}
