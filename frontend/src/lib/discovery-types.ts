import type { CategorySummary } from "./category-types";
export type { CategorySummary };

export type WorkerCardData = {
  id: string;
  slug: string;
  displayName: string;
  headline: string | null;
  primaryCategory: { slug: string; name: string } | null;
  categories: { slug: string; name: string }[];
  serviceAreas: string[];
  experienceYears: number | null;
  startingPriceBdt: number | null;
  /** Always "VERIFIED" for listed workers: the API only returns approved profiles. */
  verification: "VERIFIED";
  rating: number | null;
  reviewCount: number;
  publishedAt: string;
};

export type WorkerProfileData = WorkerCardData & {
  bio: string | null;
  languages: string[];
  updatedAt: string;
  services: {
    category: { slug: string; name: string };
    pricingModel: "FIXED" | "HOURLY" | "QUOTE";
    basePriceBdt: number | null;
    pricingNotes: string | null;
  }[];
};

export type WorkerSearchResult = {
  workers: WorkerCardData[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

