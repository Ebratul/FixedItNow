"use client";

import { MailCheck } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { TextInput } from "@/components/ui/text-input";
import { authClient } from "@/lib/auth-client";
import { focusFirstInvalid } from "@/lib/focus";
import { fieldErrorsOf, formValues, MIN_PASSWORD_LENGTH, registerSchema } from "@/lib/validation";
import { GoogleSection } from "./google-section";

export function RegisterForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = registerSchema.safeParse(formValues(event.currentTarget));
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      setFormError(undefined);
      focusFirstInvalid(formRef.current);
      return;
    }
    setErrors({});
    setFormError(undefined);
    setPending(true);

    const { name, email, password } = parsed.data;
    const { error } = await authClient.signUp.email({
      name,
      email,
      password,
      callbackURL: "/verify-email",
    });
    setPending(false);

    if (!error) {
      // The server answers identically whether or not the email already exists,
      // so this message is true in both cases and reveals nothing.
      setSentTo(email);
      return;
    }
    if (error.status === 429) {
      setFormError("Too many attempts. Please wait a minute and try again.");
    } else if (error.status === 400 || error.status === 422) {
      setFormError(error.message || "Please check your details and try again.");
    } else {
      setFormError("We couldn't create your account. Please try again.");
    }
  }

  if (sentTo) {
    return (
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent-50 text-accent-700">
          <MailCheck className="size-7" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl font-bold">Check your email</h2>
        <p className="mt-2 text-ink-muted">
          If <strong className="text-ink">{sentTo}</strong> can be used to create an account, we&apos;ve
          sent a verification link. It expires in 1 hour. You can log in after confirming your
          email.
        </p>
        {process.env.NODE_ENV === "development" && (
          <Alert tone="info" className="mt-4 text-left">
            Development only: with the console mail transport, the link is printed in the backend
            terminal.
          </Alert>
        )}
      </div>
    );
  }

  return (
    <div>
      <GoogleSection next="/onboarding" />
      <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
        <TextInput
          id="register-name"
          name="name"
          label="Full name"
          autoComplete="name"
          error={errors.name}
          disabled={pending}
          maxLength={60}
        />
        <TextInput
          id="register-email"
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          inputMode="email"
          error={errors.email}
          disabled={pending}
        />
        <PasswordInput
          id="register-password"
          name="password"
          label="Password"
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          error={errors.password}
          disabled={pending}
        />
        <PasswordInput
          id="register-confirm"
          name="confirmPassword"
          label="Confirm password"
          autoComplete="new-password"
          error={errors.confirmPassword}
          disabled={pending}
        />
        {formError && <Alert tone="error">{formError}</Alert>}
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
