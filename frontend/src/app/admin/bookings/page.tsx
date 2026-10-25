import type { Metadata } from "next";
import { BookingsList } from "@/components/admin/ops/bookings-list";
import { AdminPage } from "@/components/admin/kit";

export const metadata: Metadata = { title: "Bookings", robots: { index: false, follow: false } };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default function AdminBookingsPage() {
  return (
    <AdminPage title="Bookings" description="Monitor every booking on the platform. This view is read-only." permission="bookings.read">
      <BookingsList />
    </AdminPage>
  );
}
