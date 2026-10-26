"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, CalendarDays, Bell, Heart, KeyRound, LifeBuoy, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { VerificationBadge } from "@/components/account/worker-status";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { useAuthConfig, type Me } from "@/lib/use-api";

export function AccountOverview() {
  return <AuthGate>{(me) => <Overview me={me} />}</AuthGate>;
}

function Overview({ me }: { me: Me }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"logout" | "others" | null>(null);
  const [notice, setNotice] = useState<string>();
  // The demo identities are shared by every visitor, so their sign-in settings and "other devices" are off limits.
  const demo = Boolean(me.demo);

  async function logOut() {
    setBusy("logout");
    await authClient.signOut();
    router.replace("/");
    router.refresh();
  }

  async function logOutOthers() {
    setBusy("others");
    const { error } = await authClient.revokeOtherSessions();
    setNotice(error ? "We couldn't log out your other devices. Please try again." : "You've been logged out of all other devices.");
    setBusy(null);
  }

  return (
    <div>
      <h1 className="text-h1 font-extrabold text-brand-950">My account</h1>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <UserRound className="size-5 text-brand-600" aria-hidden /> Profile
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-ink-subtle">Name</dt>
              <dd className="font-semibold">{me.user.name}</dd>
            </div>
            <div>
              <dt className="text-ink-subtle">Email</dt>
              <dd className="flex flex-wrap items-center gap-2 font-semibold">
                {me.user.email}
                {me.user.emailVerified && <Badge tone="success">Verified</Badge>}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <ShieldCheck className="size-5 text-brand-600" aria-hidden /> Your roles
          </h2>
          <ul className="mt-4 space-y-4">
            <li className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Customer</p>
                <p className="text-sm text-ink-muted">
                  {me.customer.onboarded ? "Profile set up" : "Not set up yet"}
                </p>
              </div>
              <LinkButton href="/onboarding/customer" variant="secondary" size="sm">
                {me.customer.onboarded ? "Edit" : "Set up"}
              </LinkButton>
            </li>
            <li className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-semibold">
                  <BriefcaseBusiness className="size-4 text-accent-600" aria-hidden /> Worker
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {me.worker.profile ? (
                    me.worker.profile.onboardingStatus === "SUBMITTED" ? (
                      <VerificationBadge status={me.worker.profile.verificationStatus} />
                    ) : (
                      "Draft in progress"
                    )
                  ) : (
                    "Not started"
                  )}
                </p>
              </div>
              <LinkButton href="/onboarding/worker" variant="secondary" size="sm">
                {me.worker.started ? "Open" : "Get started"}
              </LinkButton>
            </li>
          </ul>
        </Card>
      </div>

      <Card className="mt-5 flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <CalendarDays className="size-5 text-brand-600" aria-hidden /> Bookings
          </h2>
          <p className="mt-1 text-sm text-ink-muted">Requests, quotes, and appointments.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LinkButton href="/bookings" variant="secondary" size="sm">My bookings</LinkButton>
          <LinkButton href="/payments" variant="secondary" size="sm">Payments</LinkButton>
          {me.worker.started && <LinkButton href="/account/availability" variant="secondary" size="sm">Set availability</LinkButton>}
        </div>
      </Card>

      {me.isAdmin && (
        <Card className="mt-5 flex items-center justify-between gap-4 p-6">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <ShieldCheck className="size-5 text-brand-600" aria-hidden /> Admin panel
            </h2>
            <p className="mt-1 text-sm text-ink-muted">Users, bookings, payments, support, moderation and platform settings.</p>
          </div>
          <LinkButton href="/admin" variant="secondary" size="sm">Open admin panel</LinkButton>
        </Card>
      )}

      <Card className="mt-5 flex items-center justify-between gap-4 p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Bell className="size-5 text-brand-600" aria-hidden /> Notifications
          </h2>
          <p className="mt-1 text-sm text-ink-muted">Updates about your bookings, support requests and account.</p>
        </div>
        <LinkButton href="/account/notifications" variant="secondary" size="sm">View notifications</LinkButton>
      </Card>

      <Card className="mt-5 flex items-center justify-between gap-4 p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <LifeBuoy className="size-5 text-brand-600" aria-hidden /> Support
          </h2>
          <p className="mt-1 text-sm text-ink-muted">Ask for help or follow up on a request.</p>
        </div>
        <LinkButton href="/account/support" variant="secondary" size="sm">Get support</LinkButton>
      </Card>

      <Card className="mt-5 flex items-center justify-between gap-4 p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Heart className="size-5 text-brand-600" aria-hidden /> Favorites
          </h2>
          <p className="mt-1 text-sm text-ink-muted">Professionals you saved.</p>
        </div>
        <LinkButton href="/account/favorites" variant="secondary" size="sm">
          View favorites
        </LinkButton>
      </Card>

      {!demo && <SignInMethods />}

      <Card className="mt-5 p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <LogOut className="size-5 text-brand-600" aria-hidden /> Sessions
        </h2>
        {demo ? (
          <p className="mt-2 text-sm text-ink-muted">
            This is a shared demo account — sign-in settings are disabled. Logging out ends your demo session.
          </p>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">
            Logging out ends this device&apos;s session. To end sessions on other devices, use the
            second button.
          </p>
        )}
        {notice && <Alert tone="info" className="mt-4">{notice}</Alert>}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={logOut} loading={busy === "logout"}>
            Log out
          </Button>
          {!demo && (
            <Button variant="secondary" onClick={logOutOthers} loading={busy === "others"}>
              Log out other devices
            </Button>
          )}
        </div>
      </Card>

      <p className="mt-6 text-sm text-ink-subtle">
        Looking for professionals?{" "}
        <Link href="/services" className="font-semibold text-brand-700 hover:underline">
          Browse services
        </Link>
      </p>
    </div>
  );
}

type LinkedAccount = { providerId: string };

function SignInMethods() {
  const { state: config } = useAuthConfig();
  const [accounts, setAccounts] = useState<LinkedAccount[] | null>(null);
  const [error, setError] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authClient.listAccounts().then(({ data, error: listError }) => {
      if (cancelled) return;
      if (listError || !data) setError(true);
      else setAccounts(data as LinkedAccount[]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasGoogle = accounts?.some((a) => a.providerId === "google") ?? false;
  const hasPassword = accounts?.some((a) => a.providerId === "credential") ?? false;
  const googleEnabled = config.status === "ready" && config.data.googleEnabled;

  async function linkGoogle() {
    setLinking(true);
    const { error: linkError } = await authClient.linkSocial({ provider: "google", callbackURL: "/account" });
    if (linkError) setLinking(false);
  }

  return (
    <Card className="mt-5 p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <KeyRound className="size-5 text-brand-600" aria-hidden /> Sign-in methods
      </h2>
      {error ? (
        <Alert tone="error" className="mt-4">We couldn&apos;t load your sign-in methods.</Alert>
      ) : accounts === null ? (
        <div aria-hidden className="mt-4 h-10 animate-pulse rounded-control bg-surface-strong" />
      ) : (
        <ul className="mt-4 space-y-3 text-sm">
          {hasPassword && (
            <li className="flex items-center justify-between">
              <span className="font-semibold">Email and password</span>
              <Badge tone="success">Connected</Badge>
            </li>
          )}
          {hasGoogle && (
            <li className="flex items-center justify-between">
              <span className="font-semibold">Google</span>
              <Badge tone="success">Connected</Badge>
            </li>
          )}
          {!hasGoogle && googleEnabled && (
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-muted">Google is not connected</span>
              <Button variant="secondary" size="sm" onClick={linkGoogle} loading={linking}>
                Connect Google
              </Button>
            </li>
          )}
        </ul>
      )}
    </Card>
  );
}
