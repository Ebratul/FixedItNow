export type Faq = { question: string; answer: string };

/** Honest, status-aware answers. Update as features ship. */
export const FAQS: Faq[] = [
  {
    question: "What is FixedItNow?",
    answer:
      "FixedItNow is a Bangladesh-focused marketplace that connects customers with local service professionals for home repairs, maintenance, and everyday services.",
  },
  {
    question: "Can I book a professional today?",
    answer:
      "Yes, where professionals are listed. Search for a service, open a profile, and send a booking request for a time the professional has published. The professional accepts it (or sends a quote), and only then is the time reserved. Availability is confirmed through the booking, not through search.",
  },
  {
    question: "What does \"Profile reviewed\" mean?",
    answer:
      "A FixedItNow reviewer approved the professional's profile before it was published. It is not an identity or government check: identity-document verification is not available yet.",
  },
  {
    question: "How does pricing work?",
    answer:
      "Professionals list the services they offer with a fixed price, an hourly rate, or a quote. The price shown on search is a starting price. The final price is fixed when the booking is confirmed or a quote is accepted, before work begins.",
  },
  {
    question: "How can I join as a professional?",
    answer:
      "Create an account, then complete the worker profile steps and submit it for review. A reviewer approves it, asks for changes, or declines it. Once approved you choose when to publish, and set your working hours to receive booking requests. Identity-document verification is not available yet.",
  },
  {
    question: "Which payment methods are supported?",
    answer:
      "bKash and SSLCOMMERZ, when the platform has enabled them. The checkout page shows which methods are available and marks a method as unavailable if it is not configured. A payment is recorded as successful only after we verify it directly with the provider. Paying is optional for confirming a booking; refunds for cancelled bookings are reviewed by our team.",
  },
];
