import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DemoCheckoutView } from "@/components/payments/demo-checkout";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { isPaymentReference } from "@/lib/route-params";

// Props are spelled out (not `PageProps<"/payments/demo/[reference]">`) so type-checking does not depend on generated route types.
type Props = { params: Promise<{ reference: string }> };

export const metadata: Metadata = { title: "Simulated payment", robots: { index: false } };

export default function DemoPaymentPage({ params }: Props) {
  return (
    <div className="container-page section-y">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Payments", href: "/payments" }, { label: "Simulated payment" }]} />
      <div className="mt-6 max-w-3xl">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <Checkout params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Checkout({ params }: Props) {
  const { reference } = await params;
  if (!isPaymentReference(reference)) notFound();
  return <DemoCheckoutView reference={reference} />;
}
