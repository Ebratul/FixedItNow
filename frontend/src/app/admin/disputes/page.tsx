import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/kit";
import { DisputesList } from "@/components/admin/ops/disputes-list";

export const metadata: Metadata = { title: "Disputes", robots: { index: false, follow: false } };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default function AdminDisputesPage() {
  return (
    <AdminPage title="Disputes" description="Disputes opened by customers and professionals, oldest first." permission="disputes.read">
      <DisputesList />
    </AdminPage>
  );
}
