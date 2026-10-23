import { CalendarCheck, Search, Star, Users } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";

export const STEPS = [
  {
    icon: Search,
    title: "Search for a service",
    text: "Tell us what you need and where you are in Bangladesh.",
  },
  {
    icon: Users,
    title: "Compare professionals",
    text: "Review profiles, service areas, and pricing information side by side.",
  },
  {
    icon: CalendarCheck,
    title: "Request or book",
    text: "Send a request, agree on the details, and keep the conversation in one place.",
  },
  {
    icon: Star,
    title: "Complete and review",
    text: "Once the job is done, share feedback to help other customers decide.",
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-heading"
      className="section-y border-y border-line bg-surface"
    >
      <div className="container-page">
        <SectionHeading
          id="how-heading"
          align="center"
          eyebrow="How it works"
          title="From problem to solved in four steps"
          description="This is the experience FixedItNow is being built to deliver. Booking and reviews are rolling out in stages."
        />
        <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="relative">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-full bg-brand-700 text-white">
                  <Icon className="size-6" aria-hidden />
                </span>
                <span
                  aria-hidden
                  className="text-sm font-bold tracking-widest text-accent-700"
                >
                  0{index + 1}
                </span>
              </div>
              <h3 className="mt-4 text-lg font-bold text-ink">{title}</h3>
              <p className="mt-2 text-ink-muted">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
