import type { Metadata } from "next";
import { FeedView } from "@/components/community/feed";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Community", description: "Discussions between FixedItNow members.", robots: { index: false } };

export default function CommunityPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Community" }]}
        title="Community"
        description="Ask questions, share tips, and suggest features. Sign-in required; content is moderated."
      />
      <section className="section-y" aria-label="Discussions">
        <div className="container-page max-w-3xl"><FeedView /></div>
      </section>
    </>
  );
}
