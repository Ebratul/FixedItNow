import type { Metadata } from "next";
import { AnnouncementsView } from "@/components/admin/comms/announcements-view";

export const metadata: Metadata = { title: "Announcements" };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default function AnnouncementsPage() {
  return <AnnouncementsView />;
}
