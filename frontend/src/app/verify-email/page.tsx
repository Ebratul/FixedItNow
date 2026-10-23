import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailResult } from "@/components/auth/verify-email-result";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Verify email",
  robots: { index: false },
};

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Email verification">
      <Suspense fallback={<Skeleton className="h-32" />}>
        <VerifyEmailResult />
      </Suspense>
    </AuthShell>
  );
}
