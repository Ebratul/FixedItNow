import type { Metadata } from "next";
import { WorkerList } from "@/components/admin/workers/worker-list";

export const metadata: Metadata = { title: "Worker applications", robots: { index: false, follow: false } };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default function AdminWorkersPage() {
  return <WorkerList />;
}
