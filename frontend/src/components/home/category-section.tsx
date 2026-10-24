import { LinkButton } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { CategoryCard } from "@/components/services/category-card";
import { getCategories } from "@/lib/discovery";

export async function CategorySection() {
  let categories: Awaited<ReturnType<typeof getCategories>> = [];
  try {
    categories = await getCategories();
  } catch {
    // The section simply shows the "view all" link when the API is unavailable.
  }
  return (
    <section aria-labelledby="categories-heading" className="section-y">
      <div className="container-page">
        <SectionHeading
          id="categories-heading"
          eyebrow="Popular services"
          title="Whatever needs fixing, start here"
          description="Browse service categories and see the professionals listed in each."
          action={
            <LinkButton href="/services" variant="secondary">
              View all services
            </LinkButton>
          }
        />
        {categories.length > 0 && (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {categories.slice(0, 8).map((category) => (
              <li key={category.slug}>
                <CategoryCard category={category} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
