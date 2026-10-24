import type { Metadata } from "next";
import { AvailabilityEditor } from "@/components/bookings/availability-editor";

export const metadata: Metadata = { title: "Availability", robots: { index: false } };

export default function AvailabilityPage() {
  return (
    <div className="container-page section-y">
      <AvailabilityEditor />
    </div>
  );
}
