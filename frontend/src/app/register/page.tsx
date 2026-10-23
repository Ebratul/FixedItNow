import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false },
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      description="One account for hiring professionals and, later, offering your services."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
