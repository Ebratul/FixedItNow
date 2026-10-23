import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      description="Enter your email and we'll send you a link to choose a new password."
      footer={
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Back to log in
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
