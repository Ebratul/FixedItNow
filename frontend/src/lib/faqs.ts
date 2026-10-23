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
      "Not yet. You can create an account and set up a customer or worker profile, but public professional listings, search, and bookings are still being built. Pages that depend on those features say so clearly.",
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
      "Create an account, then complete the worker profile steps and submit it for review. A reviewer approves it, asks for changes, or declines it. Identity document verification and public listings are not available yet.",
  },
  {
    question: "Which payment methods will be supported?",
    answer:
      "Payment support is planned and depends on provider approval. We will not show a payment option as available until it works end to end.",
  },
];
