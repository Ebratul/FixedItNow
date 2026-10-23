"use client";

import { useSearchParams } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";

/**
 * Landing page for email verification links. The backend has already verified
 * (or rejected) the token and redirected here; this page only reports the
 * outcome. On success the backend also started a session.
 */
export function VerifyEmailResult() {
  const error = useSearchParams().get("error");

  if (error) {
    return (
      <div className="space-y-4">
        <Alert tone="error" title="This verification link is invalid or has expired">
          Log in and we&apos;ll send you a new one.
        </Alert>
        <LinkButton href="/login" className="w-full">
          Go to log in
        </LinkButton>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Alert tone="success" title="Email verified">
        Your account is ready. Next, tell us how you plan to use FixedItNow.
      </Alert>
      <LinkButton href="/onboarding" size="lg" className="w-full">
        Continue
      </LinkButton>
    </div>
  );
}
