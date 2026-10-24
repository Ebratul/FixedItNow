import Link from "next/link";
import { Search, SearchX, UserSearch } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button, LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { controlClasses, Field } from "@/components/ui/field";
import { Pagination } from "@/components/ui/pagination";
import { ProfessionalCard } from "@/components/professional/professional-card";
import { SelectInput } from "@/components/ui/select-input";
import { cn } from "@/lib/cn";
import { getCategories, searchWorkers } from "@/lib/discovery";
import type { WorkerSearchResult } from "@/lib/discovery-types";
import {
  activeFilters,
  DIVISIONS,
  EXPERIENCE_OPTIONS,
  hrefWith,
  SORT_OPTIONS,
  type DirectoryParams,
} from "@/lib/search-params";
import { FiltersToggle } from "./filters-toggle";

/**
 * Server-rendered professional directory: filter form (plain GET, so URLs are
 * shareable and it works without JS), active-filter chips, result count,
 * grid, and pagination. Used by /workers and /services/[slug].
 */
export async function WorkerDirectory({
  basePath,
  params,
  hadInvalid,
  fixedCategory,
}: {
  basePath: string;
  params: DirectoryParams;
  hadInvalid: boolean;
  /** When set (category pages), the category filter is fixed and hidden. */
  fixedCategory?: string;
}) {
  const effective: DirectoryParams = fixedCategory ? { ...params, category: fixedCategory } : params;

  let categories: Awaited<ReturnType<typeof getCategories>> = [];
  let result: WorkerSearchResult | undefined;
  let failed = false;
  try {
    [categories, result] = await Promise.all([getCategories(), searchWorkers(effective)]);
  } catch {
    failed = true;
  }

  const nameOf = (slug: string) => categories.find((c) => c.slug === slug)?.name;
  const chips = activeFilters(effective, nameOf, { includeCategory: !fixedCategory });
  const hasFilters = chips.length > 0;
  const clearHref = basePath;
  // Category pages already carry the category in the path; keep it out of the query string.
  const linkParams: DirectoryParams = fixedCategory ? { ...effective, category: undefined } : effective;
  const sortChanged = effective.sort !== "newest";

  return (
    <div>
      {hadInvalid && (
        <Alert tone="warning" className="mb-6">
          Some filters in the link were not valid and were ignored.
        </Alert>
      )}

      <form action={basePath} method="get" role="search" aria-label="Find professionals" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field id="dir-q" label="Search professionals" className="flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
              <input
                id="dir-q"
                name="q"
                type="search"
                defaultValue={effective.q ?? ""}
                maxLength={80}
                placeholder="Name, skill, or service"
                autoComplete="off"
                className={cn(controlClasses, "pl-10")}
              />
            </div>
          </Field>
          <Button type="submit" size="lg" variant="accent" className="sm:w-auto">
            <Search className="size-5" aria-hidden /> Search
          </Button>
        </div>

        <FiltersToggle activeCount={chips.filter((c) => c.key !== "q").length}>
          <div className="grid gap-4 rounded-card border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-5">
            {!fixedCategory && (
              <SelectInput
                id="dir-category"
                name="category"
                label="Service"
                placeholder="All services"
                options={categories.map((c) => ({ value: c.slug, label: c.name }))}
                defaultValue={effective.category ?? ""}
              />
            )}
            <SelectInput
              id="dir-location"
              name="location"
              label="Location"
              placeholder="All of Bangladesh"
              options={DIVISIONS}
              defaultValue={effective.location ?? ""}
            />
            <Field id="dir-price" label="Max starting price (৳)" hint="Quote-only workers have no price.">
              <input
                id="dir-price"
                name="maxPrice"
                type="number"
                inputMode="numeric"
                min={50}
                max={1000000}
                step={50}
                defaultValue={effective.maxPrice ?? ""}
                placeholder="Any"
                className={controlClasses}
              />
            </Field>
            <SelectInput
              id="dir-exp"
              name="minExperience"
              label="Experience"
              placeholder="Any"
              options={EXPERIENCE_OPTIONS.map((n) => ({ value: String(n), label: `${n}+ years` }))}
              defaultValue={effective.minExperience !== undefined ? String(effective.minExperience) : ""}
            />
            <SelectInput
              id="dir-sort"
              name="sort"
              label="Sort by"
              placeholder="Newest first"
              options={SORT_OPTIONS.filter((o) => o.value !== "newest")}
              defaultValue={sortChanged ? effective.sort : ""}
            />
            <div className="flex items-end gap-3 sm:col-span-2 lg:col-span-5">
              <Button type="submit" variant="primary">Apply filters</Button>
              {(hasFilters || sortChanged) && (
                <Link href={clearHref} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
                  Clear all
                </Link>
              )}
            </div>
          </div>
        </FiltersToggle>
      </form>

      {hasFilters && (
        <ul aria-label="Active filters" className="mt-4 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <li key={chip.key}>
              <Link
                href={hrefWith(basePath, linkParams, { [chip.key]: null, page: null })}
                aria-label={`Remove filter ${chip.label}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 text-sm font-medium text-brand-800 hover:bg-brand-100"
              >
                {chip.label}
                <span aria-hidden>×</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-8" aria-live="polite">
        {failed || !result ? (
          <ErrorState
            title="We couldn't load professionals"
            action={<LinkButton href={hrefWith(basePath, linkParams)}>Try again</LinkButton>}
          >
            The service is temporarily unavailable. Please try again in a moment.
          </ErrorState>
        ) : result.total === 0 ? (
          hasFilters ? (
            <EmptyState
              icon={SearchX}
              headingLevel={2}
              title="No professionals match these filters"
              action={<LinkButton href={clearHref} variant="secondary">Clear all filters</LinkButton>}
            >
              Try removing a filter or searching for something broader.
            </EmptyState>
          ) : (
            <EmptyState
              icon={UserSearch}
              headingLevel={2}
              title="No professionals are listed yet"
              action={<LinkButton href="/become-a-worker" variant="secondary">Learn about joining as a professional</LinkButton>}
            >
              Professionals appear here after they complete their profile, a reviewer approves it, and
              they choose to publish it. We never show sample profiles or ratings.
            </EmptyState>
          )
        ) : (
          <>
            <p className="mb-4 text-sm font-medium text-ink-muted">
              {result.total} {result.total === 1 ? "professional" : "professionals"}
              {result.totalPages > 1 && ` · page ${result.page} of ${result.totalPages}`}
            </p>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.workers.map((pro) => (
                <li key={pro.id}>
                  <ProfessionalCard pro={pro} headingLevel={2} />
                </li>
              ))}
            </ul>
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              hrefFor={(page) => hrefWith(basePath, linkParams, { page })}
            />
          </>
        )}
      </div>
    </div>
  );
}
