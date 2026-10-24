import type { CategorySummary } from "./category-types";

/** Case-insensitive match on a category's name or description. */
export function filterCategories<T extends Pick<CategorySummary, "name" | "description">>(
  categories: readonly T[],
  query: string,
): T[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...categories];
  return categories.filter((c) => `${c.name} ${c.description}`.toLowerCase().includes(needle));
}
