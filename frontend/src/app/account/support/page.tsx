import type { Metadata } from "next";
import { SupportList } from "@/components/support/support-list";

export const metadata: Metadata = { title: "Help and support", robots: { index: false } };

export default function SupportPage() {
  return (
    <div className="container-page section-y">
      <SupportList />
    </div>
  );
}
