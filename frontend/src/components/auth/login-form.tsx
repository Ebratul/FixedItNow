"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { TextInput } from "@/components/ui/text-input";
import { authClient } from "@/lib/auth-client";
import { fieldErrorsOf, formValues, loginSchema } from "@/lib/validation";
import { focusFirstInvalid } from "@/lib/focus";
import { safeNext } from "@/lib/safe-redirect";
import { GoogleSection } from "./google-section";

const OAUTH_ERRORS: Record<string, string> = {
  access_denied: "Google sign-in was cancelled.",
  account_not_linked:
    "An account with this email already exists. Log in with your password first, then connect Google from your account page.",
  state_mismatch: "Your sign-in session expired. Please try again.",
  invalid_state: "Your sign-in session expired. Please try again.",
};

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const formRef = useRef<HTMLFormElement>(null);

  const oauthCode = params.get("error");
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: "error" | "info"; text: string }>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = loginSchema.safeParse(formValues(event.currentTarget));
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      setNotice(undefined);
      focusFirstInvalid(formRef.current);
      return;
    }
    setErrors({});
    setNotice(undefined);
    setPending(true);

    const { error } = await authClient.signIn.email(parsed.data);
    if (!error) {
      router.replace(next);
      router.refresh();
      return; // keep the button disabled while navigating
    }

    if (error.status === 403) {
      // Only reachable with the CORRECT password, so this reveals nothing new.
      const { error: resendError } = await authClient.sendVerificationEmail({
        email: parsed.data.email,
        callbackURL: "/verify-email",
      });
      setNotice({
        tone: resendError ? "error" : "info",
        text: resendError
          ? "Your email isn't verified yet, and we couldn't send a new link right now. Please wait a few minutes and try again."
          : "Your email isn't verified yet. We've sent you a fresh verification link, so check your inbox.",
      });
    } else if (error.status === 429) {
      setNotice({ tone: "error", text: "Too many attempts. Please wait a minute and try again." });
    } else if (error.status === 401) {
      // Deliberately identical for "no such user" and "wrong password".
      setNotice({ tone: "error", text: "Incorrect email or password." });
    } else {
      setNotice({ tone: "error", text: "We couldn't log you in. Please try again." });
    }
    setPending(false);
  }

  return (
    <div>
      {params.get("reset") === "1" && (
        <Alert tone="success" className="mb-4">
          Your password was updated. Log in with your new password.
        </Alert>
      )}
      {oauthCode && (
        <Alert tone="error" className="mb-4">
          {OAUTH_ERRORS[oauthCode] ?? "Sign-in failed. Please try again."}
        </Alert>
      )}

      <GoogleSection next={next} />

      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
        <TextInput
          id="login-email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          inputMode="email"
          error={errors.email}
          disabled={pending}
        />
        <PasswordInput
          id="login-password"
          name="password"
          label="Password"
          autoComplete="current-password"
          error={errors.password}
          disabled={pending}
        />
        <div className="text-right">
          <Link href="/forgot-password" className="text-sm font-semibold text-brand-700 hover:underline">
            Forgot password?
          </Link>
        </div>
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {pending ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </div>
  );
}
