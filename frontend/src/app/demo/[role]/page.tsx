import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { DemoRoleView } from "@/components/auth/demo-role-view";
import { Skeleton } from "@/components/ui/skeleton";
import { isDemoKey } from "@/lib/demo";

// Props are spelled out (not `PageProps<"/demo/[role]">`) so type-checking does not depend on generated route types.
type Props = { params: Promise<{ role: string }> };

export const metadata: Metadata = {
  title: "Explore the demo",
  robots: { index: false },
};

export default function DemoRolePage({ params }: Props) {
  return (
    <Suspense fallback={<AuthShell title="Explore the demo"><Skeleton className="h-40" /></AuthShell>}>
      <Role params={params} />
    </Suspense>
  );
}

async function Role({ params }: Props) {
  const { role } = await params;
  if (!isDemoKey(role)) notFound();
  return (
    <AuthShell title="Explore the demo" description="No account or password needed. Everything you see is fictional and nothing is real.">
      <DemoRoleView role={role} />
    </AuthShell>
  );
}
