"use client";

import { MailCheck } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import { authClient } from "@/lib/auth-client";
import { focusFirstInvalid } from "@/lib/focus";
import { fieldErrorsOf, formValues, forgotPasswordSchema } from "@/lib/validation";

export function ForgotPasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [sent, setSent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = forgotPasswordSchema.safeParse(formValues(event.currentTarget));
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      focusFirstInvalid(formRef.current);
      return;
    }
    setErrors({});
    setFormError(undefined);
    setPending(true);
    const { error } = await authClient.requestPasswordReset({
      email: parsed.data.email,
      redirectTo: "/reset-password",
    });
    setPending(false);
    if (error) {
      setFormError(
        error.status === 429
          ? "Too many requests. Please wait a few minutes and try again."
          : "We couldn't send the request. Please try again.",
      );
      return;
    }
    setSent(true); // identical outcome whether or not the account exists
  }

  if (sent) {
    return (
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent-50 text-accent-700">
          <MailCheck className="size-7" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl font-bold">Check your email</h2>
        <p className="mt-2 text-ink-muted">
          If an account exists for that address, we&apos;ve sent a link to reset your password. It
          expires in 1 hour.
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      <TextInput
        id="forgot-email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        inputMode="email"
        error={errors.email}
        disabled={pending}
      />
      {formError && <Alert tone="error">{formError}</Alert>}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
