export type AdminCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
  parentId: string | null;
  workers: number;
  bookings: number;
  subcategories: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminCategoryNode = AdminCategory & { children: AdminCategory[] };
export type AdminCategoryTree = { categories: AdminCategoryNode[] };

/** Mirrors the backend slug rule so the form can explain a problem before sending. */
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
