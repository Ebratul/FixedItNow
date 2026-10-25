import type { Metadata } from "next";
import { RolesView } from "@/components/admin/people/roles-view";

export const metadata: Metadata = { title: "Admin roles", robots: { index: false, follow: false } };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default function AdminRolesPage() {
  return <RolesView />;
}
