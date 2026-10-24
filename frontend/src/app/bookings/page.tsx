import type { Metadata } from "next";
import { BookingListView } from "@/components/bookings/booking-list";

export const metadata: Metadata = { title: "My bookings", robots: { index: false } };

export default function BookingsPage() {
  return (
    <div className="container-page section-y">
      <BookingListView />
    </div>
  );
}
