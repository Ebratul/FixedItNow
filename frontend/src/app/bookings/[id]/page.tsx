import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BookingDetailView } from "@/components/bookings/booking-detail";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { isUuid } from "@/lib/route-params";

export const metadata: Metadata = { title: "Booking", robots: { index: false } };

export default function BookingPage({ params }: PageProps<"/bookings/[id]">) {
  return (
    <div className="container-page section-y">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Bookings", href: "/bookings" }, { label: "Booking" }]} />
      <div className="mt-6 max-w-3xl">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <Detail params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Detail({ params }: Pick<PageProps<"/bookings/[id]">, "params">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <BookingDetailView id={id} />;
}
