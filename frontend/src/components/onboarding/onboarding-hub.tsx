"use client";

import Link from "next/link";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Search } from "lucide-react";
import { AuthGate } from "@/components/account/auth-gate";
import { VerificationBadge } from "@/components/account/worker-status";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function OnboardingHub() {
  return (
    <AuthGate>
      {(me) => (
        <div>
          <h1 className="text-h1 font-extrabold text-brand-950">Welcome, {me.user.name.split(" ")[0]}</h1>
          <p className="mt-3 max-w-2xl text-lg text-ink-muted">
            How do you want to use FixedItNow? One account can do both. You can set up either now
            and the other any time.
          </p>
          <ul className="mt-10 grid gap-5 md:grid-cols-2">
            <li>
              <Card interactive className="h-full">
                <Link href="/onboarding/customer" className="flex h-full flex-col p-6">
                  <span className="flex size-12 items-center justify-center rounded-control bg-brand-100 text-brand-700">
                    <Search className="size-6" aria-hidden />
                  </span>
                  <h2 className="mt-4 text-xl font-bold">I want to hire professionals</h2>
                  <p className="mt-2 flex-1 text-ink-muted">
                    Set up a customer profile to save your preferences.
                  </p>
                  <span className="mt-4 flex items-center justify-between">
                    {me.customer.onboarded ? (
                      <Badge tone="success">
                        <CheckCircle2 className="size-3.5" aria-hidden /> Set up
                      </Badge>
                    ) : (
                      <Badge>Not set up</Badge>
                    )}
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                      {me.customer.onboarded ? "Edit" : "Get started"}
                      <ArrowRight className="size-4" aria-hidden />
                    </span>
                  </span>
                </Link>
              </Card>
            </li>
            <li>
              <Card interactive className="h-full">
                <Link href="/onboarding/worker" className="flex h-full flex-col p-6">
                  <span className="flex size-12 items-center justify-center rounded-control bg-accent-100 text-accent-700">
                    <BriefcaseBusiness className="size-6" aria-hidden />
                  </span>
                  <h2 className="mt-4 text-xl font-bold">I want to offer my services</h2>
                  <p className="mt-2 flex-1 text-ink-muted">
                    Build a worker profile. Submitted profiles are reviewed before they are approved.
                  </p>
                  <span className="mt-4 flex items-center justify-between">
                    {me.worker.profile ? (
                      me.worker.profile.onboardingStatus === "SUBMITTED" ? (
                        <VerificationBadge status={me.worker.profile.verificationStatus} />
                      ) : (
                        <Badge tone="brand">Draft saved</Badge>
                      )
                    ) : (
                      <Badge>Not started</Badge>
                    )}
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                      {me.worker.started ? "Continue" : "Get started"}
                      <ArrowRight className="size-4" aria-hidden />
                    </span>
                  </span>
                </Link>
              </Card>
            </li>
          </ul>
        </div>
      )}
    </AuthGate>
  );
}
