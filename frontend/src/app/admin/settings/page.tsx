import type { Metadata } from "next";
import { SettingsView } from "@/components/admin/people/settings-view";

export const metadata: Metadata = { title: "Platform settings", robots: { index: false, follow: false } };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default function AdminSettingsPage() {
  return <SettingsView />;
}
