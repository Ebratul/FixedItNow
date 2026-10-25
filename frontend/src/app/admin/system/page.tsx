import type { Metadata } from "next";
import { SystemView } from "@/components/admin/system/system-view";

export const metadata: Metadata = { title: "Operations" };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default function AdminSystemPage() {
  return <SystemView />;
}
