import "server-only";
import { cache } from "react";
import { ServerApiError, serverApi } from "./server-api";
import type { CategorySummary } from "./category-types";
import { toQueryString, type DirectoryParams } from "./search-params";

export type { CategorySummary, WorkerCardData, WorkerProfileData, WorkerSearchResult } from "./discovery-types";
import type { WorkerProfileData, WorkerSearchResult } from "./discovery-types";

export const DEFAULT_PAGE_SIZE = 12;

export const getCategories = cache(async () =>
  (await serverApi<{ categories: CategorySummary[] }>("/categories")).categories,
);

/** Returns undefined for unknown or inactive categories. */
export const getCategory = cache(async (slug: string) => {
  try {
    return (await serverApi<{ category: CategorySummary }>(`/categories/${encodeURIComponent(slug)}`)).category;
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) return undefined;
    throw error;
  }
});

export async function searchWorkers(params: DirectoryParams, pageSize = DEFAULT_PAGE_SIZE) {
  const qs = toQueryString({ ...params }, {}, { keepDefaults: true });
  const sep = qs ? "&" : "";
  return serverApi<WorkerSearchResult>(`/workers?${qs}${sep}pageSize=${pageSize}`);
}

/** Returns undefined when the profile is not publicly visible. */
export const getWorker = cache(async (slug: string) => {
  try {
    return (await serverApi<{ worker: WorkerProfileData }>(`/workers/${encodeURIComponent(slug)}`)).worker;
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) return undefined;
    throw error;
  }
});

/** Does this professional currently accept booking requests (have working hours)? */
export const getAcceptingBookings = cache(async (slug: string) => {
  try {
    const result = await serverApi<{ acceptingBookings: boolean }>(`/workers/${encodeURIComponent(slug)}/availability?days=1`);
    return result.acceptingBookings;
  } catch {
    return false;
  }
});
