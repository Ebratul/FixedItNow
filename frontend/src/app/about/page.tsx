import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";

export const metadata: Metadata = {
  title: "About",
  description:
    "FixedItNow is a Bangladesh-focused service marketplace built around trust, transparency, and local relevance.",
};

const PRINCIPLES = [
  {
    title: "Truthful by default",
    text: "We show real data or an honest empty state. No invented ratings, profiles, or verification badges.",
  },
  {
    title: "Privacy first",
    text: "Identity documents and private conversations are never exposed publicly.",
  },
  {
    title: "Built for Bangladesh",
    text: "Local service categories, bKash payment support, and an assistant that understands questions in English and Bangla.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        crumbs={[{ label: "Home", href: "/" }, { label: "About" }]}
        title="About FixedItNow"
        description="A marketplace that connects customers with local service professionals across Bangladesh."
      />
      <section className="section-y" aria-label="About FixedItNow">
        <div className="container-page grid gap-12 lg:grid-cols-2">
          <div className="max-w-prose space-y-4 text-lg text-ink-muted">
            <p>
              Finding a reliable electrician, plumber, or cleaner should not
              depend on who you happen to know. FixedItNow is being built so
              customers can discover professionals, compare their services and
              prices, and book with confidence, while workers get a clear way
              to publish their skills and build a reputation.
            </p>
            <p>
              FixedItNow is in active development. We would rather tell you
              what is not ready yet than pretend it is.
            </p>
          </div>
          <ul className="space-y-6">
            {PRINCIPLES.map(({ title, text }) => (
              <li key={title} className="border-l-4 border-accent-500 pl-5">
                <h2 className="text-lg font-bold">{title}</h2>
                <p className="mt-1 text-ink-muted">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
