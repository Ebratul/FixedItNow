import type { ProfessionalSummary } from "@/components/professional/professional-card";

/**
 * Data-access boundary for professionals.
 *
 * No worker API exists yet, so these return empty results. They never fabricate
 * profiles, ratings, or verification (docs/SRS.md FR-PUB-06). When the backend
 * lands, replace the bodies with calls to `GET /api/v1/workers` and keep the
 * signatures, so the UI does not change.
 */
export async function getFeaturedProfessionals(): Promise<ProfessionalSummary[]> {
  return [];
}

export type ProfessionalSearch = {
  q?: string;
  categorySlug?: string;
  location?: string;
};

export async function searchProfessionals(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for the API call
  _search: ProfessionalSearch,
): Promise<ProfessionalSummary[]> {
  return [];
}
