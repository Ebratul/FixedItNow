import type { Metadata } from "next";
import { Suspense } from "react";
import { BookingListView } from "@/components/bookings/booking-list";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "My bookings", robots: { index: false } };

export default function BookingsPage({ searchParams }: PageProps<"/bookings">) {
  return (
    <div className="container-page section-y">
      <Suspense fallback={<Skeleton className="h-64" />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ searchParams }: Pick<PageProps<"/bookings">, "searchParams">) {
  // `?role=worker` opens the professional's side first (the demo worker lands there); anything else is the customer's.
  const { role } = await searchParams;
  return <BookingListView initialRole={role === "worker" ? "worker" : "customer"} />;
}
