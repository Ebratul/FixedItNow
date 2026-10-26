import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { DemoLoginSection } from "@/components/auth/demo-login-section";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Log in",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      description="Log in to your FixedItNow account."
      footer={
        <>
          New to FixedItNow?{" "}
          <Link href="/register" className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<Skeleton className="h-64" />}>
        <LoginForm />
      </Suspense>
      <DemoLoginSection />
    </AuthShell>
  );
}
