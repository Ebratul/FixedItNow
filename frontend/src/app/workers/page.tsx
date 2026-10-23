import type { Metadata } from "next";
import { Suspense } from "react";
import { UserSearch } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ProfessionalCard } from "@/components/professional/professional-card";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getCategoryBySlug } from "@/lib/categories";
import { isDivision } from "@/lib/locations";
import { searchProfessionals } from "@/lib/professionals";

export const metadata: Metadata = {
  title: "Find professionals",
  description: "Search for service professionals by category and location in Bangladesh.",
};

type SearchParams = Awaited<PageProps<"/workers">["searchParams"]>;

function first(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.slice(0, 80);
}

export default function WorkersPage({ searchParams }: PageProps<"/workers">) {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Find professionals" }]}
        title="Find professionals"
        description="Search results will list verified professionals with real ratings and prices."
      />
      <section className="section-y" aria-label="Search results">
        <div className="container-page">
          <Suspense fallback={<ResultsFallback />}>
            <Results searchParams={searchParams} />
          </Suspense>
        </div>
      </section>
    </>
  );
}

async function Results({
  searchParams,
}: {
  searchParams: PageProps<"/workers">["searchParams"];
}) {
  const params: SearchParams = await searchParams;
  const q = first(params.q);
  const category = getCategoryBySlug(first(params.category));
  const rawLocation = first(params.location);
  const location = isDivision(rawLocation) ? rawLocation : undefined;

  const professionals = await searchProfessionals({
    q,
    categorySlug: category?.slug,
    location,
  });

  const filters = [
    q && `“${q}”`,
    category?.name,
    location,
  ].filter(Boolean);

  return (
    <>
      {filters.length > 0 && (
        <p className="mb-6 text-ink-muted">
          Searching for: <strong className="text-ink">{filters.join(" · ")}</strong>
        </p>
      )}
      {professionals.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {professionals.map((pro) => (
            <li key={pro.id}>
              <ProfessionalCard pro={pro} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={UserSearch}
          headingLevel={2}
          title="Professional listings are not live yet"
          action={
            <LinkButton href="/services" variant="secondary">
              Browse service categories
            </LinkButton>
          }
        >
          Search is not connected yet, so no results can be shown. We will not
          display sample professionals or ratings. Check back as workers join
          FixedItNow.
        </EmptyState>
      )}
    </>
  );
}

function ResultsFallback() {
  return (
    <div aria-busy="true" aria-label="Loading results" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton className="h-64" />
      <Skeleton className="hidden h-64 sm:block" />
      <Skeleton className="hidden h-64 lg:block" />
    </div>
  );
}
