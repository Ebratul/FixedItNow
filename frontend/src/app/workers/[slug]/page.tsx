import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { ErrorState } from "@/components/ui/error-state";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkerProfileView } from "@/components/workers/worker-profile-view";
import { getAcceptingBookings, getWorker } from "@/lib/discovery";

export async function generateMetadata({ params }: PageProps<"/workers/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const worker = await getWorker(slug);
    if (!worker) return { title: "Professional not found", robots: { index: false } };
    const where = worker.serviceAreas.length ? ` in ${worker.serviceAreas.join(", ")}` : "";
    return {
      title: worker.displayName,
      description: `${worker.headline ?? worker.primaryCategory?.name ?? "Service professional"}${where}. View services, pricing, and experience on FixedItNow.`,
    };
  } catch {
    return { title: "Professional" };
  }
}

export default function WorkerPage({ params }: PageProps<"/workers/[slug]">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Profile params={params} />
    </Suspense>
  );
}

async function Profile({ params }: Pick<PageProps<"/workers/[slug]">, "params">) {
  const { slug } = await params;
  let worker;
  try {
    worker = await getWorker(slug);
  } catch {
    return (
      <div className="container-page section-y">
        <ErrorState title="We couldn't load this profile" action={<LinkButton href={`/workers/${slug}`}>Try again</LinkButton>}>
          The service is temporarily unavailable. Please try again in a moment.
        </ErrorState>
      </div>
    );
  }
  // Hidden, unpublished, suspended and unknown profiles are indistinguishable.
  if (!worker) notFound();

  return (
    <div className="container-page py-8 md:py-12">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Professionals", href: "/workers" },
          { label: worker.displayName },
        ]}
      />
      <div className="mt-6">
        <WorkerProfileView worker={worker} acceptingBookings={await getAcceptingBookings(worker.slug)} />
      </div>
    </div>
  );
}

function Fallback() {
  return (
    <div className="container-page py-12" aria-busy="true" aria-label="Loading profile">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="mt-6 h-56" />
    </div>
  );
}
