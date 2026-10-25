import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminTicketDetailView } from "@/components/admin/support/ticket-detail";
import { isUuid } from "@/lib/route-params";

export const metadata: Metadata = { title: "Support ticket" };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default async function AdminSupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <AdminTicketDetailView id={id} />;
}
