export type CategorySummary = {
  slug: string;
  name: string;
  description: string;
  /** Computed by the backend from publicly listed workers. */
  workerCount: number;
  /** Active subcategories (top-level categories only). Absent on a subcategory. */
  subcategories?: CategorySummary[];
};
