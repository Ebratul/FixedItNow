import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { ServiceCategory } from "@/lib/categories";

/** Links to /workers?category=… — the future discovery results page. */
export function CategoryCard({
  category,
  headingLevel = 3,
}: {
  category: ServiceCategory;
  headingLevel?: 2 | 3;
}) {
  const { icon: Icon, name, description, slug } = category;
  const Heading = `h${headingLevel}` as const;
  return (
    <Card interactive className="h-full">
      <Link
        href={`/workers?category=${slug}`}
        className="group flex h-full flex-col p-5"
      >
        <span className="flex size-11 items-center justify-center rounded-control bg-brand-100 text-brand-700 transition-colors group-hover:bg-brand-700 group-hover:text-white">
          <Icon className="size-6" aria-hidden />
        </span>
        <Heading className="mt-4 text-base font-bold text-ink">{name}</Heading>
        <p className="mt-1 flex-1 text-sm text-ink-muted">{description}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
          Find professionals
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      </Link>
    </Card>
  );
}
