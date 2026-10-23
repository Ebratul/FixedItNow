import type { Metadata } from "next";
import { WorkerOnboarding } from "@/components/onboarding/worker-onboarding";

export const metadata: Metadata = {
  title: "Worker profile",
  robots: { index: false },
};

export default function WorkerOnboardingPage() {
  return (
    <div className="container-page section-y">
      <WorkerOnboarding />
    </div>
  );
}
