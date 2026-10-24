export type CategorySummary = {
  slug: string;
  name: string;
  description: string;
  /** Computed by the backend from publicly listed workers. */
  workerCount: number;
};
