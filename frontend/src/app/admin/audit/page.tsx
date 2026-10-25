import type { Metadata } from "next";
import { AuditView } from "@/components/admin/people/audit-view";

export const metadata: Metadata = { title: "Audit log", robots: { index: false, follow: false } };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default function AdminAuditPage() {
  return <AuditView />;
}
