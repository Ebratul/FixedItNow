"use client";

import { ShieldCheck } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { TextInput } from "@/components/ui/text-input";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { focusFirstInvalid } from "@/lib/focus";
import { fieldErrorsOf, formValues, loginSchema } from "@/lib/validation";
import type { Me } from "@/lib/use-api";

/**
 * Sign-in for /admin: email and password only. There is no Google button, no sign-up link and no
 * password-reset link here. An account that is not an administrator is signed straight back out and
 * gets the same message as a wrong password, so this form does not reveal which emails are admins.
 */
export function AdminLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string>();

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
    if (error) {
      setNotice(
        error.status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : error.status === 403 && error.code === "ACCOUNT_SUSPENDED"
            ? "This account has been suspended."
            : "Incorrect email or password.",
      );
      setPending(false);
      return;
    }

    let isAdmin = false;
    try {
      isAdmin = (await api<Me>("/me")).isAdmin;
    } catch {
      isAdmin = false;
    }
    if (!isAdmin) {
      await authClient.signOut();
      setNotice("Incorrect email or password.");
      setPending(false);
      return;
    }
    onSignedIn(); // keep the button disabled while the panel loads
  }

  return (
    <div className="bg-surface">
      <div className="container-page flex min-h-[calc(100dvh-4rem)] items-start justify-center py-10 md:items-center md:py-16">
        <div className="w-full max-w-md">
          <Card className="p-6 shadow-lift sm:p-8">
            <div className="flex items-center gap-2 text-brand-700">
              <ShieldCheck className="size-6" aria-hidden />
              <span className="text-sm font-bold tracking-wide uppercase">Administrators</span>
            </div>
            <h1 className="mt-3 text-2xl font-extrabold text-brand-950">Admin log in</h1>
            <p className="mt-2 text-ink-muted">Sign in with your administrator email and password.</p>
            <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
              <TextInput id="admin-email" name="email" type="email" label="Email" autoComplete="username" inputMode="email" error={errors.email} disabled={pending} />
              <PasswordInput id="admin-password" name="password" label="Password" autoComplete="current-password" error={errors.password} disabled={pending} />
              {notice && <Alert tone="error">{notice}</Alert>}
              <Button type="submit" size="lg" className="w-full" loading={pending}>
                {pending ? "Logging in…" : "Log in"}
              </Button>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
