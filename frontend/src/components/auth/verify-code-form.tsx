"use client";

import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { TextInput } from "@/components/ui/text-input";
import { authClient } from "@/lib/auth-client";
import { focusFirstInvalid } from "@/lib/focus";
import { safeNext } from "@/lib/safe-redirect";
import { cleanCode, fieldErrorsOf, OTP_LENGTH, RESEND_SECONDS, verifyEmailSchema } from "@/lib/validation";

type Notice = { tone: "error" | "info" | "success"; text: string };

/** Maps the server's error to words a person can act on. No code, address or account detail is echoed. */
function describe(error: { status?: number; code?: string }): Notice & { needsNewCode?: boolean } {
  if (error.status === 429) return { tone: "error", text: "Too many attempts. Please wait a few minutes and try again." };
  if (error.code === "OTP_EXPIRED") return { tone: "error", text: "That code has expired. Request a new one below.", needsNewCode: true };
  if (error.code === "TOO_MANY_ATTEMPTS") return { tone: "error", text: "Too many wrong codes. Request a new code below.", needsNewCode: true };
  if (error.code === "INVALID_OTP") {
    return { tone: "error", text: "That code or password isn't right, or the code has expired. Check them and try again, or request a new code." };
  }
  return { tone: "error", text: "We couldn't verify your email. Please try again." };
}

/**
 * Enter the one-time code from the verification email. The server decides
 * everything: this form only sends what the person typed. The password the
 * person chose is sent along because the server requires it to accept a code
 * (it stops a stranger's pre-registration of your address from being "completed" by you).
 *
 * `email` + `password` given -> embedded after sign-up / login. Omitted -> standalone page.
 */
export function VerifyCodeForm({
  email: knownEmail,
  password: knownPassword,
  sendOnMount = false,
  startCooldown = false,
  next,
  onBack,
}: {
  email?: string;
  password?: string;
  sendOnMount?: boolean;
  startCooldown?: boolean;
  next?: string | null;
  onBack?: () => void;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState(knownEmail ?? "");
  const [code, setCode] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice>();
  const [pending, setPending] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(startCooldown ? RESEND_SECONDS : 0);
  const [needsNewCode, setNeedsNewCode] = useState(false);
  const embedded = knownEmail !== undefined && knownPassword !== undefined;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const requestCode = useCallback(
    async (address: string) => {
      setSending(true);
      const { error } = await authClient.emailOtp.sendVerificationOtp({ email: address, type: "email-verification" });
      setSending(false);
      setCooldown(RESEND_SECONDS);
      if (error?.status === 429) {
        setNotice({ tone: "error", text: "Too many requests. Please wait a few minutes before asking for another code." });
      } else if (error) {
        setNotice({ tone: "error", text: "We couldn't send a code right now. Please try again in a moment." });
      } else {
        // Deliberately the same whether or not an account is waiting for this address.
        setNotice({ tone: "info", text: "If this address is waiting to be verified, a new code is on its way. It can take a minute to arrive." });
        setNeedsNewCode(false);
        setCode("");
      }
    },
    [],
  );

  // Login of an unverified account: ask for a code once (StrictMode runs effects twice in development).
  // The cooldown already starts via `startCooldown`; the server enforces its own per-address limits.
  const sentOnMount = useRef(false);
  useEffect(() => {
    if (!sendOnMount || !knownEmail || sentOnMount.current) return;
    sentOnMount.current = true;
    void authClient.emailOtp.sendVerificationOtp({ email: knownEmail, type: "email-verification" }).catch(() => undefined);
  }, [sendOnMount, knownEmail]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const parsed = verifyEmailSchema.safeParse({
      email: knownEmail ?? email,
      password: knownPassword ?? String(form.get("password") ?? ""),
      code,
    });
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      setNotice(undefined);
      focusFirstInvalid(formRef.current);
      return;
    }
    setErrors({});
    setNotice(undefined);
    setPending(true);
    const { error } = await authClient.$fetch("/email-otp/verify-email", {
      method: "POST",
      body: { email: parsed.data.email, otp: parsed.data.code, password: parsed.data.password },
    });
    if (!error) {
      // The server verified the code and started the session; nothing else to store here.
      router.replace(safeNext(next, "/onboarding"));
      router.refresh();
      return;
    }
    const message = describe(error as { status?: number; code?: string });
    setNotice(message);
    setNeedsNewCode(Boolean(message.needsNewCode));
    setCode("");
    setPending(false);
  }

  return (
    <div>
      <div className="text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent-50 text-accent-700">
          <MailCheck className="size-7" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl font-bold">Enter your verification code</h2>
        <p className="mt-2 text-ink-muted">
          {embedded ? (
            <>
              If <strong className="text-ink">{knownEmail}</strong> can be used for an account, we&apos;ve emailed a{" "}
              {OTP_LENGTH}-digit code. It expires in 10 minutes.
            </>
          ) : (
            <>Enter the {OTP_LENGTH}-digit code we emailed you. Codes expire after 10 minutes.</>
          )}
        </p>
      </div>

      <form ref={formRef} onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        {!embedded && (
          <>
            <TextInput id="verify-email-address" name="email" type="email" label="Email" autoComplete="email" inputMode="email"
              value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} disabled={pending} />
            <PasswordInput id="verify-password" name="password" label="Password" autoComplete="current-password"
              hint="The password you chose when you signed up." error={errors.password} disabled={pending} />
          </>
        )}
        <TextInput
          id="verify-code"
          name="code"
          label={`${OTP_LENGTH}-digit code`}
          value={code}
          onChange={(e) => setCode(cleanCode(e.target.value))}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={OTP_LENGTH + 2}
          error={errors.code}
          disabled={pending}
          autoFocus={embedded}
          className="text-center font-mono text-2xl tracking-[0.5em]"
        />
        <div aria-live="polite" className="space-y-3">
          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
        </div>
        {process.env.NODE_ENV === "development" && (
          <Alert tone="info">Development only: with the console mail transport, the code is printed in the backend terminal.</Alert>
        )}
        <Button type="submit" size="lg" className="w-full" loading={pending} disabled={code.length !== OTP_LENGTH}>
          {pending ? "Verifying…" : "Verify email"}
        </Button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
        <Button
          variant={needsNewCode ? "secondary" : "ghost"}
          size="sm"
          onClick={() => void requestCode((knownEmail ?? email).trim().toLowerCase())}
          disabled={sending || cooldown > 0 || !(knownEmail ?? email).includes("@")}
          loading={sending}
        >
          {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
        </Button>
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} disabled={pending}>
            Use a different email
          </Button>
        )}
      </div>
    </div>
  );
}
