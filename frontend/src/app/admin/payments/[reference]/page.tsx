import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/kit";
import { PaymentDetail } from "@/components/admin/ops/payment-detail";
import { isPaymentReference } from "@/lib/route-params";

export const metadata: Metadata = { title: "Payment", robots: { index: false, follow: false } };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default async function AdminPaymentPage({ params }: PageProps<"/admin/payments/[reference]">) {
  const { reference } = await params;
  if (!isPaymentReference(reference)) notFound();
  return (
    <AdminPage title="Payment" description="Facts, verification history and refunds for one payment." permission="payments.read">
      <PaymentDetail reference={reference} />
    </AdminPage>
  );
}
