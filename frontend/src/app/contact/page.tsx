import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach the FixedItNow team.",
};

export default function ContactPage() {
  return (
    <ComingSoon icon={MessageCircle} title="Support channels are being set up">
      We have not published a support email, phone number, or contact form yet.
      In the meantime, the Help page answers the most common questions.
    </ComingSoon>
  );
}
