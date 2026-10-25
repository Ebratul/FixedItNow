import type { Metadata } from "next";
import { DashboardView } from "@/components/admin/dashboard/dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default function AdminDashboardPage() {
  return <DashboardView />;
}
