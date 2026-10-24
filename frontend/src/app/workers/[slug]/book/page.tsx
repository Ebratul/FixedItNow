import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookingForm } from "@/components/bookings/booking-form";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ErrorState } from "@/components/ui/error-state";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getWorker } from "@/lib/discovery";

export const metadata: Metadata = {
  title: "Request a booking",
  robots: { index: false },
};

export default function BookPage({ params }: PageProps<"/workers/[slug]/book">) {
  return (
    <Suspense fallback={<div className="container-page py-12"><Skeleton className="h-96 max-w-2xl" /></div>}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: Pick<PageProps<"/workers/[slug]/book">, "params">) {
  const { slug } = await params;
  let worker;
  try {
    worker = await getWorker(slug);
  } catch {
    return (
      <div className="container-page section-y">
        <ErrorState title="We couldn't load this professional" action={<LinkButton href={`/workers/${slug}/book`}>Try again</LinkButton>}>
          The service is temporarily unavailable. Please try again in a moment.
        </ErrorState>
      </div>
    );
  }
  if (!worker) notFound();

  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Professionals", href: "/workers" }, { label: worker.displayName, href: `/workers/${worker.slug}` }, { label: "Request a booking" }]} />
      <h1 className="mt-6 text-h1 font-extrabold text-brand-950">Request {worker.displayName}</h1>
      <p className="mt-2 max-w-2xl text-lg text-ink-muted">Tell them what you need and pick a time. They will accept, decline, or send a quote.</p>
      <div className="mt-8">
        <BookingForm
          worker={{
            id: worker.id,
            slug: worker.slug,
            displayName: worker.displayName,
            serviceAreas: worker.serviceAreas,
            services: worker.services.map((s) => ({ category: s.category, pricingModel: s.pricingModel, basePriceBdt: s.basePriceBdt })),
          }}
        />
      </div>
    </div>
  );
}
