import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { CategorySummary } from "@/lib/category-types";
import { CategoryIcon } from "@/lib/category-icons";

/** Links to the category page. The count is computed from real listings. */
export function CategoryCard({
  category,
  headingLevel = 3,
}: {
  category: CategorySummary;
  headingLevel?: 2 | 3;
}) {
  const { name, description, slug, workerCount } = category;
  const Heading = `h${headingLevel}` as const;
  return (
    <Card interactive className="h-full overflow-hidden">
      <Link href={`/services/${slug}`} className="group flex h-full flex-col p-5">
        <span className="flex size-12 items-center justify-center rounded-card bg-gradient-to-br from-brand-50 to-brand-200 text-brand-700 shadow-card ring-1 ring-brand-200/70 transition-all duration-200 group-hover:from-brand-600 group-hover:to-brand-800 group-hover:text-white group-hover:ring-brand-700">
          <CategoryIcon slug={slug} className="size-6" />
        </span>
        <Heading className="mt-4 text-base font-bold text-ink">{name}</Heading>
        <p className="mt-1 flex-1 text-sm text-ink-muted">{description}</p>
        <span className="mt-4 flex items-center justify-between text-sm">
          <span className="text-ink-subtle">
            {workerCount > 0
              ? `${workerCount} ${workerCount === 1 ? "professional" : "professionals"}`
              : "No professionals yet"}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-brand-700">
            Browse
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </span>
      </Link>
    </Card>
  );
}
