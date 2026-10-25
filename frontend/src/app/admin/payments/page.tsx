import type { Metadata } from "next";
import { AdminPage } from "@/components/admin/kit";
import { PaymentsView } from "@/components/admin/ops/payments-view";

export const metadata: Metadata = { title: "Payments and refunds", robots: { index: false, follow: false } };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default function AdminPaymentsPage() {
  return (
    <AdminPage title="Payments & refunds" description="Payment status always comes from the payment provider. Refunds are complete only when the provider confirms them." permission="payments.read">
      <PaymentsView />
    </AdminPage>
  );
}
