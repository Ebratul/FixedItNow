import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PaymentDetailView } from "@/components/payments/payment-detail";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { isPaymentReference } from "@/lib/route-params";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

export default function PaymentPage({ params }: PageProps<"/payments/[reference]">) {
  return (
    <div className="container-page section-y">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Payments", href: "/payments" }, { label: "Payment" }]} />
      <div className="mt-6 max-w-3xl">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <Detail params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Detail({ params }: Pick<PageProps<"/payments/[reference]">, "params">) {
  const { reference } = await params;
  if (!isPaymentReference(reference)) notFound();
  return <PaymentDetailView reference={reference} />;
}
