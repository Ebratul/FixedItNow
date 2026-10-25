import type { Metadata } from "next";
import { TicketQueue } from "@/components/admin/support/ticket-queue";

export const metadata: Metadata = { title: "Support tickets" };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default function AdminSupportPage() {
  return <TicketQueue />;
}
