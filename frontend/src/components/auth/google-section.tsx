"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { authClient } from "@/lib/auth-client";
import { useAuthConfig } from "@/lib/use-api";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.4Z" />
      <path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6l3.8-3Z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3A12 12 0 0 0 1.8 7.1l3.8 3C6.5 6.8 9 4.8 12 4.8Z" />
    </svg>
  );
}

/**
 * "Continue with Google". Rendered only when the backend reports Google OAuth
 * is configured. In development, an unconfigured server shows setup guidance;
 * in production the button is simply absent.
 */
export function GoogleSection({ next }: { next: string }) {
  const { state } = useAuthConfig();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();

  if (state.status === "loading") {
    return (
      <div aria-hidden>
        <div className="h-11 animate-pulse rounded-control bg-surface-strong" />
        <OrDivider />
      </div>
    );
  }
  if (state.status !== "ready" || !state.data.googleEnabled) {
    if (process.env.NODE_ENV !== "development") return null;
    return (
      <Alert tone="info" title="Google sign-in is not configured" className="mb-6">
        Development only: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env
        (see docs/DEPLOYMENT.md) to enable it.
      </Alert>
    );
  }

  async function start() {
    setPending(true);
    setError(undefined);
    const { error: signInError } = await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
      newUserCallbackURL: "/onboarding",
      errorCallbackURL: "/login",
    });
    // On success the browser is redirected to Google, so we only get here on failure.
    if (signInError) {
      setError("We couldn't start Google sign-in. Please try again.");
      setPending(false);
    }
  }

  return (
    <div>
      <div className="space-y-3">
        <Button variant="secondary" size="lg" className="w-full" onClick={start} loading={pending}>
          {!pending && <GoogleMark />}
          Continue with Google
        </Button>
        {error && <Alert tone="error">{error}</Alert>}
      </div>
      <OrDivider />
    </div>
  );
}

function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
