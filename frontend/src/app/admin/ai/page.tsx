import type { Metadata } from "next";
import { AiAdminView } from "@/components/admin/ai/ai-view";

export const metadata: Metadata = { title: "AI assistant" };

export const instant = false; // renders after the admin sign-in check; see ../layout.tsx

export default function AdminAiPage() {
  return <AiAdminView />;
}
