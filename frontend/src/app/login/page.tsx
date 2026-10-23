import type { Metadata } from "next";
import { LogIn } from "lucide-react";
import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata: Metadata = {
  title: "Log in",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <ComingSoon icon={LogIn} title="Log in is not available yet">
      Accounts are being built and will be released in an upcoming step. There
      is nothing to sign in to right now, and no data is collected on this
      page.
    </ComingSoon>
  );
}
