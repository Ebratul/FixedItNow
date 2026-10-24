import type { Metadata } from "next";
import { ModerationView } from "@/components/admin/moderation-view";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = { title: "Moderation", robots: { index: false, follow: false } };

export default function ModerationPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Moderation" }]}
        title="Moderation"
        description="Review reports, decide feature proposals, and see what moderators did. Every action is recorded."
      />
      <section className="section-y" aria-label="Moderation console">
        <div className="container-page"><ModerationView /></div>
      </section>
    </>
  );
}
