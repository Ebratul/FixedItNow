import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password">
      <Suspense fallback={<Skeleton className="h-40" />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
