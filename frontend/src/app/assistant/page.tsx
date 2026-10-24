import type { Metadata } from "next";
import { AssistantView } from "@/components/assistant/assistant-view";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "AI assistant",
  description: "Describe the service you need in English or Bangla and get matching professionals from the FixedItNow directory.",
  robots: { index: false },
};

export default function AssistantPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "AI assistant" }]}
        title="Describe what you need"
        description="Tell the assistant the service, where you are and your budget. It searches the same directory as the normal search."
      />
      <section className="section-y" aria-label="Assistant">
        <div className="container-page">
          <AssistantView />
        </div>
      </section>
    </>
  );
}
