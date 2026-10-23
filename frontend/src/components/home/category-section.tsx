import { LinkButton } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { CategoryCard } from "@/components/services/category-card";
import { SERVICE_CATEGORIES } from "@/lib/categories";

export function CategorySection() {
  return (
    <section aria-labelledby="categories-heading" className="section-y">
      <div className="container-page">
        <SectionHeading
          id="categories-heading"
          eyebrow="Popular services"
          title="Whatever needs fixing, start here"
          description="Browse the service categories FixedItNow is being built around."
          action={
            <LinkButton href="/services" variant="secondary">
              View all services
            </LinkButton>
          }
        />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICE_CATEGORIES.slice(0, 8).map((category) => (
            <li key={category.slug}>
              <CategoryCard category={category} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
