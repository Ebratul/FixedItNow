import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkerDirectory } from "@/components/workers/worker-directory";
import { parseDirectoryParams } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Find professionals",
  description:
    "Search service professionals in Bangladesh by service, location, price, and experience. Only approved, published profiles are listed.",
};

export default function WorkersPage({ searchParams }: PageProps<"/workers">) {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Find professionals" }]}
        title="Find professionals"
        description="Search by service, location, price, and experience. Every listed profile was reviewed and published by the professional."
      />
      <section className="section-y" aria-label="Directory">
        <div className="container-page">
          <Suspense fallback={<Fallback />}>
            <Directory searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
    </>
  );
}

async function Directory({ searchParams }: Pick<PageProps<"/workers">, "searchParams">) {
  const { params, hadInvalid } = parseDirectoryParams(await searchParams);
  return <WorkerDirectory basePath="/workers" params={params} hadInvalid={hadInvalid} />;
}

function Fallback() {
  return (
    <div aria-busy="true" aria-label="Loading professionals" className="space-y-6">
      <Skeleton className="h-12" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    </div>
  );
}
