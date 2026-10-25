import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/kit";
import { FinanceView } from "@/components/admin/ops/finance-view";

export const metadata: Metadata = { title: "Financial reports", robots: { index: false, follow: false } };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default function AdminFinancePage() {
  return (
    <AdminPage title="Financial reports" description="Money collected and refunded, built only from provider-confirmed payments." permission="finance.reports">
      <FinanceView />
    </AdminPage>
  );
}
