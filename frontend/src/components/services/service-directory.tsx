"use client";

import { SearchX } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { filterCategories } from "@/lib/categories";
import type { CategorySummary } from "@/lib/category-types";
import { CategoryCard } from "./category-card";

/** Searchable category grid. Categories come from the API (server-rendered). */
export function ServiceDirectory({ categories }: { categories: CategorySummary[] }) {
  const [query, setQuery] = useState("");
  const results = filterCategories(categories, query);

  return (
    <div>
      <div className="max-w-xl">
        <SearchInput
          id="service-filter"
          label="Search service categories"
          placeholder="e.g. plumbing, laptop, painting"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={80}
        />
      </div>

      <p className="mt-4 text-sm text-ink-subtle" role="status">
        {results.length === 1 ? "1 category" : `${results.length} categories`}
        {query.trim() && ` match “${query.trim()}”`}
      </p>

      {results.length > 0 ? (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((category) => (
            <li key={category.slug}>
              <CategoryCard category={category} headingLevel={2} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          className="mt-6"
          icon={SearchX}
          headingLevel={2}
          title="No matching categories"
          action={
            <Button variant="secondary" onClick={() => setQuery("")}>
              Clear search
            </Button>
          }
        >
          Try a different word, like “electrician” or “cleaning”.
        </EmptyState>
      )}
    </div>
  );
}
