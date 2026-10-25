import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkerDetail } from "@/components/admin/workers/worker-detail";
import { isUuid } from "@/lib/route-params";

export const metadata: Metadata = { title: "Worker review", robots: { index: false, follow: false } };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default async function AdminWorkerPage({ params }: PageProps<"/admin/workers/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <WorkerDetail id={id} />;
}
