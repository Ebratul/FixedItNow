import type { Metadata } from "next";
import { NewRequestForm } from "@/components/support/new-request-form";

export const metadata: Metadata = { title: "New support request", robots: { index: false } };

export default function NewSupportRequestPage() {
  return (
    <div className="container-page section-y">
      <NewRequestForm />
    </div>
  );
}
