import type { Metadata } from "next";
import { OnboardingHub } from "@/components/onboarding/onboarding-hub";

export const metadata: Metadata = {
  title: "Get started",
  robots: { index: false },
};

export default function OnboardingPage() {
  return (
    <div className="container-page section-y">
      <OnboardingHub />
    </div>
  );
}
