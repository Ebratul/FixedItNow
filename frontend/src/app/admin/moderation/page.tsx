import type { Metadata } from "next";
import { ModerationView } from "@/components/admin/moderation-view";

export const metadata: Metadata = { title: "Moderation" };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default function ModerationPage() {
  return <ModerationView />;
}
