"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, LinkButton } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { authClient } from "@/lib/auth-client";
import { focusFirstInvalid } from "@/lib/focus";
import { fieldErrorsOf, formValues, MIN_PASSWORD_LENGTH, resetPasswordSchema } from "@/lib/validation";

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();

  if (!token || params.get("error")) {
    return (
      <div className="space-y-4">
        <Alert tone="error" title="This link is invalid or has expired">
          Password reset links work once and expire after an hour.
        </Alert>
        <LinkButton href="/forgot-password" className="w-full">
          Request a new link
        </LinkButton>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !token) return;
    const parsed = resetPasswordSchema.safeParse(formValues(event.currentTarget));
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      focusFirstInvalid(formRef.current);
      return;
    }
    setErrors({});
    setFormError(undefined);
    setPending(true);
    const { error } = await authClient.resetPassword({ newPassword: parsed.data.password, token });
    if (!error) {
      router.replace("/login?reset=1");
      return;
    }
    setPending(false);
    setFormError(
      error.status === 429
        ? "Too many attempts. Please wait a minute and try again."
        : "We couldn't reset your password. The link may have expired.",
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-4">
      <PasswordInput
        id="reset-password"
        name="password"
        label="New password"
        autoComplete="new-password"
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={errors.password}
        disabled={pending}
      />
      <PasswordInput
        id="reset-confirm"
        name="confirmPassword"
        label="Confirm new password"
        autoComplete="new-password"
        error={errors.confirmPassword}
        disabled={pending}
      />
      {formError && (
        <Alert tone="error">
          {formError}{" "}
          <Link href="/forgot-password" className="font-semibold underline">
            Request a new link
          </Link>
        </Alert>
      )}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? "Updating…" : "Update password"}
      </Button>
    </form>
  );
}
