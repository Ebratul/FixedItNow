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
      "Not yet. The public website is live in preview, but accounts, professional listings, and bookings are being released in stages. Pages that depend on those features say so clearly.",
  },
  {
    question: "How will professionals be verified?",
    answer:
      "Workers will submit identity documents that are stored privately and reviewed by authorised staff. A Verified badge will appear only after a reviewer approves the worker. Verification does not mean a government check unless an approved process says so.",
  },
  {
    question: "How will pricing work?",
    answer:
      "Professionals will list the services they offer with a base price and pricing notes. Final prices for a job are agreed through the booking and quote flow before work begins.",
  },
  {
    question: "How can I join as a professional?",
    answer:
      "Worker registration is not open yet. The Become a worker page explains what to expect and will link to sign-up when it is available.",
  },
  {
    question: "Which payment methods will be supported?",
    answer:
      "Payment support is planned and depends on provider approval. We will not show a payment option as available until it works end to end.",
  },
];
