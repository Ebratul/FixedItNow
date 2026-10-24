import { DIVISIONS, isDivision, type Division } from "./locations";

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "experience", label: "Most experienced" },
  { value: "price_asc", label: "Lowest starting price" },
  { value: "price_desc", label: "Highest starting price" },
] as const;
export type Sort = (typeof SORT_OPTIONS)[number]["value"];

export const EXPERIENCE_OPTIONS = [1, 3, 5, 10] as const;

export type DirectoryParams = {
  q?: string;
  category?: string;
  location?: Division;
  maxPrice?: number;
  minExperience?: number;
  sort: Sort;
  page: number;
};

type Raw = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function intInRange(value: string | undefined, min: number, max: number): number | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  if (!/^-?\d+$/.test(value.trim())) return undefined;
  const n = Number(value);
  return n >= min && n <= max ? n : undefined;
}

/**
 * Turn raw URL query params into trusted ones. Invalid values are DROPPED (the
 * page then shows defaults and a notice) so a bad/shared link never errors out.
 * The backend validates strictly again; this mirrors its bounds.
 */
export function parseDirectoryParams(raw: Raw): { params: DirectoryParams; hadInvalid: boolean } {
  let hadInvalid = false;
  const take = <T,>(value: T | undefined, present: string | undefined) => {
    if (value === undefined && present !== undefined && present.trim() !== "") hadInvalid = true;
    return value;
  };

  const qRaw = first(raw.q)?.trim();
  const catRaw = first(raw.category);
  const locRaw = first(raw.location);
  const sortRaw = first(raw.sort);

  const params: DirectoryParams = {
    q: take(qRaw && qRaw.length <= 80 ? qRaw : undefined, qRaw),
    category: take(catRaw && /^[a-z0-9-]{1,50}$/.test(catRaw) ? catRaw : undefined, catRaw),
    location: take(isDivision(locRaw) ? locRaw : undefined, locRaw),
    maxPrice: take(intInRange(first(raw.maxPrice), 50, 1_000_000), first(raw.maxPrice)),
    minExperience: take(intInRange(first(raw.minExperience), 0, 60), first(raw.minExperience)),
    sort: take(SORT_OPTIONS.find((o) => o.value === sortRaw)?.value, sortRaw) ?? "newest",
    page: take(intInRange(first(raw.page), 1, 500), first(raw.page)) ?? 1,
  };
  return { params, hadInvalid };
}

/**
 * Build a query string from params (+ overrides, where `null` removes a key).
 * Defaults (sort=newest, page=1) are omitted for clean, shareable URLs.
 */
export function toQueryString(
  params: DirectoryParams,
  overrides: Partial<Record<keyof DirectoryParams, string | number | null>> = {},
  options: { keepDefaults?: boolean } = {},
): string {
  const merged: Record<string, string | number | undefined | null> = { ...params, ...overrides };
  const out = new URLSearchParams();
  for (const key of ["q", "category", "location", "maxPrice", "minExperience", "sort", "page"] as const) {
    const value = merged[key];
    if (value === undefined || value === null || value === "") continue;
    if (!options.keepDefaults) {
      if (key === "sort" && value === "newest") continue;
      if (key === "page" && value === 1) continue;
    }
    out.set(key, String(value));
  }
  return out.toString();
}

export function hrefWith(
  basePath: string,
  params: DirectoryParams,
  overrides: Partial<Record<keyof DirectoryParams, string | number | null>> = {},
): string {
  const qs = toQueryString(params, overrides);
  return qs ? `${basePath}?${qs}` : basePath;
}

export type ActiveFilter = { key: keyof DirectoryParams; label: string };

/** Human-readable chips for the filters currently applied (excludes sort/page). */
export function activeFilters(
  params: DirectoryParams,
  categoryName: (slug: string) => string | undefined,
  opts: { includeCategory: boolean },
): ActiveFilter[] {
  const chips: ActiveFilter[] = [];
  if (params.q) chips.push({ key: "q", label: `“${params.q}”` });
  if (opts.includeCategory && params.category) {
    chips.push({ key: "category", label: categoryName(params.category) ?? params.category });
  }
  if (params.location) chips.push({ key: "location", label: params.location });
  if (params.maxPrice !== undefined) chips.push({ key: "maxPrice", label: `Up to ৳${params.maxPrice.toLocaleString("en-BD")}` });
  if (params.minExperience !== undefined) chips.push({ key: "minExperience", label: `${params.minExperience}+ years` });
  return chips;
}

export { DIVISIONS };
