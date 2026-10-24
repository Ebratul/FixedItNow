import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { WorkerDirectory } from "@/components/workers/worker-directory";
import { ErrorState } from "@/components/ui/error-state";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/lib/category-icons";
import { getCategory } from "@/lib/discovery";
import { parseDirectoryParams } from "@/lib/search-params";

export async function generateMetadata({ params }: PageProps<"/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  try {
    const category = await getCategory(slug);
    if (!category) return { title: "Service not found", robots: { index: false } };
    return {
      title: category.name,
      description: `Find ${category.name.toLowerCase()} professionals in Bangladesh. ${category.description}`,
    };
  } catch {
    return { title: "Services" };
  }
}

export default function CategoryPage({ params, searchParams }: PageProps<"/services/[slug]">) {
  return (
    <Suspense fallback={<Fallback />}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({
  params,
  searchParams,
}: Pick<PageProps<"/services/[slug]">, "params" | "searchParams">) {
  const { slug } = await params;
  let category;
  try {
    category = await getCategory(slug);
  } catch {
    return (
      <div className="container-page section-y">
        <ErrorState title="We couldn't load this service" action={<LinkButton href={`/services/${slug}`}>Try again</LinkButton>}>
          The service is temporarily unavailable. Please try again in a moment.
        </ErrorState>
      </div>
    );
  }
  if (!category) notFound();

  const { params: query, hadInvalid } = parseDirectoryParams(await searchParams);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Services", href: "/services" }, { label: category.name }]}
        title={category.name}
        description={category.description}
      >
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-ink-muted">
          <CategoryIcon slug={category.slug} className="size-4 text-brand-600" />
          {category.workerCount > 0
            ? `${category.workerCount} listed ${category.workerCount === 1 ? "professional" : "professionals"}`
            : "No professionals listed yet"}
        </p>
      </PageHeader>
      <section className="section-y" aria-label="Professionals">
        <div className="container-page">
          <WorkerDirectory
            basePath={`/services/${category.slug}`}
            params={query}
            hadInvalid={hadInvalid}
            fixedCategory={category.slug}
          />
        </div>
      </section>
    </>
  );
}

function Fallback() {
  return (
    <div className="container-page section-y" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-10 w-1/2" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    </div>
  );
}
