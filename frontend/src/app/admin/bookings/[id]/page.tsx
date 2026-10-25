import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/kit";
import { BookingDetail } from "@/components/admin/ops/booking-detail";
import { isUuid } from "@/lib/route-params";

export const metadata: Metadata = { title: "Booking", robots: { index: false, follow: false } };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default async function AdminBookingPage({ params }: PageProps<"/admin/bookings/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return (
    <AdminPage title="Booking" description="A read-only view of one booking and everything attached to it." permission="bookings.read">
      <BookingDetail id={id} />
    </AdminPage>
  );
}
