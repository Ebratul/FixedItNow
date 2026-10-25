import { ChevronDown } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { FAQS } from "@/lib/faqs";

/** FAQ list using native <details>, so it works without client JavaScript. */
export function FaqList() {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-card border border-line bg-canvas shadow-card">
      {FAQS.map(({ question, answer }) => (
        <details key={question} className="group open:bg-brand-50/40">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-card px-5 py-3 font-semibold text-ink hover:bg-surface group-open:text-brand-800">
            {question}
            <ChevronDown
              className="size-5 shrink-0 text-ink-subtle transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <p className="border-l-2 border-accent-400 mx-5 mb-5 pl-4 text-ink-muted">{answer}</p>
        </details>
      ))}
    </div>
  );
}

export function FaqSection() {
  return (
    <section
      aria-labelledby="faq-heading"
      className="section-y border-t border-line bg-surface"
    >
      <div className="container-page grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHeading
          id="faq-heading"
          eyebrow="FAQ"
          title="Questions, answered honestly"
          description="What works today, and what is still on the way."
        />
        <FaqList />
      </div>
    </section>
  );
}
