import type { Metadata } from "next";
import { PaymentListView } from "@/components/payments/payment-list";

export const metadata: Metadata = { title: "Your payments", robots: { index: false } };

export default function PaymentsPage() {
  return (
    <div className="container-page section-y">
      <PaymentListView />
    </div>
  );
}
