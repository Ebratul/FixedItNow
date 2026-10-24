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
    <Card interactive className="h-full">
      <Link href={`/services/${slug}`} className="group flex h-full flex-col p-5">
        <span className="flex size-11 items-center justify-center rounded-control bg-brand-100 text-brand-700 transition-colors group-hover:bg-brand-700 group-hover:text-white">
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
