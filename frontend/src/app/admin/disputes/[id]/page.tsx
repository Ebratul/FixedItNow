import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin/kit";
import { DisputeDetail } from "@/components/admin/ops/dispute-detail";
import { isUuid } from "@/lib/route-params";

export const metadata: Metadata = { title: "Dispute", robots: { index: false, follow: false } };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default async function AdminDisputePage({ params }: PageProps<"/admin/disputes/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return (
    <AdminPage title="Dispute" description="Review the evidence, talk to the parties, then decide." permission="disputes.read">
      <DisputeDetail id={id} />
    </AdminPage>
  );
}
