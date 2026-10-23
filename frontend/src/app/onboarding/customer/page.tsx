import type { Metadata } from "next";
import { CustomerOnboarding } from "@/components/onboarding/customer-form";

export const metadata: Metadata = {
  title: "Customer profile",
  robots: { index: false },
};

export default function CustomerOnboardingPage() {
  return (
    <div className="container-page section-y">
      <CustomerOnboarding />
    </div>
  );
}
