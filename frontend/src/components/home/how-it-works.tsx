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
    text: "Send a request for a time that suits you. The professional accepts it or sends a quote. Once it is accepted you can message them about the job.",
  },
  {
    icon: Star,
    title: "Complete and review",
    text: "When the professional reports the work finished, you pay through bKash. After the payment is verified, you can rate and review the job.",
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-heading"
      className="section-y border-y border-line bg-gradient-to-b from-surface to-brand-50/60"
    >
      <div className="container-page">
        <SectionHeading
          id="how-heading"
          align="center"
          eyebrow="How it works"
          title="From problem to solved in four steps"
          description="Booking, quotes, a private chat for accepted bookings, bKash payment after the work is done, in-app notifications and reviews are available. Email and SMS notifications are not."
        />
        <ol className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <li
              key={title}
              className="group relative overflow-hidden rounded-card border border-line bg-canvas p-6 shadow-card transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lift"
            >
              {/* Large step number, decorative */}
              <span
                aria-hidden
                className="absolute -top-3 right-3 text-7xl font-extrabold text-brand-100 transition-colors group-hover:text-accent-100"
              >
                0{index + 1}
              </span>
              <span className="relative flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-lift">
                <Icon className="size-6" aria-hidden />
              </span>
              <h3 className="relative mt-5 text-lg font-bold text-ink">{title}</h3>
              <p className="relative mt-2 text-sm text-ink-muted">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
