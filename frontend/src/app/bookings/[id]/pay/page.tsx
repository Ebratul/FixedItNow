import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutView } from "@/components/payments/checkout";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Pay for your booking", robots: { index: false } };

export default function PayPage({ params }: PageProps<"/bookings/[id]/pay">) {
  return (
    <div className="container-page section-y">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Bookings", href: "/bookings" }, { label: "Pay" }]} />
      <div className="mt-6 max-w-3xl">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <Checkout params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Checkout({ params }: Pick<PageProps<"/bookings/[id]/pay">, "params">) {
  const { id } = await params;
  return <CheckoutView bookingId={id} />;
}
