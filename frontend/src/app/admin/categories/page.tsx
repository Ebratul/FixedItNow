import type { Metadata } from "next";
import { CategoryManager } from "@/components/admin/categories/category-manager";

export const metadata: Metadata = { title: "Service categories", robots: { index: false, follow: false } };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default function AdminCategoriesPage() {
  return <CategoryManager />;
}
