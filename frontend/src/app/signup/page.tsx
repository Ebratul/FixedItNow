import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = {
  title: "Sign up",
  robots: { index: false },
};

export default function SignupPage() {
  return (
    <ComingSoon icon={UserPlus} title="Sign up is not open yet">
      Account registration is being built and will be released in an upcoming
      step. No data is collected on this page.
    </ComingSoon>
  );
}
