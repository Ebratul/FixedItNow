"use client";

import Link from "next/link";
import { CreditCard, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { StatusBadge } from "@/components/bookings/status-badge";
import { Alert } from "@/components/ui/alert";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import type { BookingDetail } from "@/lib/booking-types";
import { formatBdt, formatRange } from "@/lib/format";
import { isSafeCheckoutUrl, PROVIDER_LABELS, SIMULATED_NOTE } from "@/lib/payment-status";
import type { PaymentView, ProviderId, ProviderInfo } from "@/lib/payment-types";
import { useApi } from "@/lib/use-api";

export function CheckoutView({ bookingId }: { bookingId: string }) {
  return <AuthGate>{() => <Loader bookingId={bookingId} />}</AuthGate>;
}

function Loader({ bookingId }: { bookingId: string }) {
  const booking = useApi<BookingDetail>(`/bookings/${bookingId}`);
  const providers = useApi<{ providers: ProviderInfo[] }>("/payments/providers");
  if (booking.state.status === "loading" || providers.state.status === "loading") {
    return <div aria-busy="true" aria-label="Loading payment" className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-48" /></div>;
  }
  if (booking.state.status === "error" || providers.state.status === "error") {
    const message = booking.state.status === "error" ? booking.state.message : providers.state.status === "error" ? providers.state.message : "";
    return <ErrorState action={<Button onClick={() => { booking.reload(); providers.reload(); }}>Try again</Button>}>{message}</ErrorState>;
  }
  if (booking.state.status !== "ready" || providers.state.status !== "ready") return null;
  return <Checkout detail={booking.state.data} providers={providers.state.data.providers} />;
}

export function Checkout({ detail, providers }: { detail: BookingDetail; providers: ProviderInfo[] }) {
  const { booking, payment } = detail;
  const keys = useRef<Partial<Record<ProviderId, string>>>({});
  const [busy, setBusy] = useState<ProviderId | null>(null);
  const [error, setError] = useState<string>();
  const [staleRef, setStaleRef] = useState<string>();

  // Coming back from the provider with the browser's Back button can restore this page from the bfcache with the
  // button still "busy" (the script never got to reset it); unlock it.
  useEffect(() => {
    const unlock = (event: PageTransitionEvent) => {
      if (event.persisted) setBusy(null);
    };
    window.addEventListener("pageshow", unlock);
    return () => window.removeEventListener("pageshow", unlock);
  }, []);

  if (booking.viewerRole !== "CUSTOMER" || !("canPay" in payment)) {
    return <EmptyState icon={CreditCard} headingLevel={1} title="Only the customer pays" action={<LinkButton href={`/bookings/${booking.id}`}>Back to the booking</LinkButton>}>Payments for a booking are made by the customer who booked it.</EmptyState>;
  }

  const amount = payment.amountBdt;
  const anyAvailable = providers.some((p) => p.available);
  const paymentLink = (p: PaymentView | undefined) => p && <Link href={`/payments/${p.reference}`} className="font-semibold text-brand-700 hover:underline">View payment status</Link>;

  async function pay(provider: ProviderId) {
    if (busy) return;
    setBusy(provider);
    setError(undefined);
    setStaleRef(undefined);
    // One key per provider choice: a double click or retry of the same request is the same payment.
    keys.current[provider] ??= crypto.randomUUID();
    try {
      const res = await api<{ payment: PaymentView; checkoutUrl: string | null }>(`/bookings/${booking.id}/payments`, {
        method: "POST",
        body: { provider },
        headers: { "Idempotency-Key": keys.current[provider]! },
      });
      if (res.checkoutUrl && isSafeCheckoutUrl(res.checkoutUrl)) {
        window.location.assign(res.checkoutUrl); // the provider's own page; nothing is assumed paid
        return;
      }
      if (res.checkoutUrl) {
        // A URL we refuse to follow is a failure, not "already finished". The payment stays unpaid.
        keys.current[provider] = undefined;
        setError("We could not open the payment page safely, so nothing was charged. Please try again, or choose another method.");
      } else {
        // Replay of a request that already finished: send the customer to its real status.
        setStaleRef(res.payment.reference);
      }
    } catch (e) {
      keys.current[provider] = undefined; // a failed attempt must not be replayed
      setError(e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
    setBusy(null);
  }

  const active = payment.payments.find((p) => p.reference === payment.activeReference);
  const latest = payment.payments[0];

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h1 font-extrabold text-brand-950">Pay for your booking</h1>
          <StatusBadge status={booking.status} arrivedAt={booking.arrivedAt} />
        </div>
        <p className="mt-2 text-lg text-ink-muted">{booking.category.name} with {booking.worker.displayName}</p>
      </div>

      <Card className="p-6">
        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-[9rem_1fr]">
          <dt className="font-semibold text-ink-muted">When</dt>
          <dd>{formatRange(booking.startAt, booking.endAt)} <span className="text-ink-subtle">· Bangladesh time</span></dd>
          <dt className="font-semibold text-ink-muted">Agreed price</dt>
          <dd className="text-lg font-extrabold">{amount !== null ? formatBdt(amount) : "—"} <span className="text-sm font-normal text-ink-subtle">{payment.currency}</span></dd>
        </dl>
        <p className="mt-4 text-sm text-ink-muted">
          The amount is the price you agreed with the professional; it cannot be changed here. You pay FixedItNow, and the price is set by the booking, not by this page.
        </p>
      </Card>

      {payment.state === "PAID" || payment.state === "PARTIALLY_REFUNDED" || payment.state === "REFUNDED" ? (
        <Alert tone="success" title="This booking is already paid">{paymentLink(payment.payments.find((p) => p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED" || p.status === "REFUNDED"))}</Alert>
      ) : payment.state === "IN_PROGRESS" ? (
        <Alert tone="info" title="A payment is already in progress">Check its status instead of starting another one. {paymentLink(active)}</Alert>
      ) : payment.state === "UNDER_REVIEW" ? (
        <Alert tone="warning" title="A payment for this booking is being reviewed">Please do not pay again. {paymentLink(payment.payments.find((p) => p.status === "REQUIRES_REVIEW"))}</Alert>
      ) : !payment.canPay ? (
        <Alert tone="info" title="This booking cannot be paid right now">You can pay once the professional has marked the work as finished. A cancelled booking or one on hold cannot be paid.</Alert>
      ) : (
        <section aria-labelledby="methods-heading" className="space-y-4">
          <h2 id="methods-heading" className="text-h2 font-extrabold">Choose how to pay</h2>
          {error && <Alert tone="error">{error}</Alert>}
          {staleRef && <Alert tone="info" title="That attempt has already finished"><Link href={`/payments/${staleRef}`} className="font-semibold text-brand-700 hover:underline">See what happened</Link></Alert>}
          {latest && !error && (latest.status === "FAILED" || latest.status === "CANCELLED" || latest.status === "EXPIRED") && (
            <Alert tone="info" title="Your last attempt was not completed">You can try again below. {paymentLink(latest)}</Alert>
          )}
          {!anyAvailable ? (
            <Alert tone="warning" title="Online payment is not available yet">No payment provider is switched on for this site, so there is nothing to pay with. Your booking is not affected.</Alert>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {providers.map((p) => {
                const outOfRange = amount !== null && p.available && ((p.minAmountBdt !== null && amount < p.minAmountBdt) || (p.maxAmountBdt !== null && amount > p.maxAmountBdt));
                return (
                  <li key={p.provider}>
                    <Card className="flex h-full flex-col gap-3 p-5">
                      <p className="flex items-center gap-2 text-lg font-bold"><CreditCard className="size-5 text-brand-600" aria-hidden /> {PROVIDER_LABELS[p.provider]}</p>
                      {p.available && p.mode === "sandbox" && <p className="text-sm text-warning">Test mode: no real money is moved.</p>}
                      {p.provider === "DEMO" && <p className="text-sm font-semibold text-warning">{SIMULATED_NOTE}: this is a demo and nothing is charged.</p>}
                      {!p.available ? (
                        <p className="text-sm text-ink-subtle">Not available right now.</p>
                      ) : outOfRange ? (
                        <p className="text-sm text-ink-subtle">Not available for this amount.</p>
                      ) : (
                        <Button variant="accent" loading={busy === p.provider} disabled={busy !== null} onClick={() => pay(p.provider)} className="mt-auto" aria-label={`Pay ${amount !== null ? formatBdt(amount) : ""} with ${PROVIDER_LABELS[p.provider]}`}>
                          Pay {amount !== null ? formatBdt(amount) : ""} with {PROVIDER_LABELS[p.provider]}
                        </Button>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
          {providers.some((p) => p.available && p.provider !== "DEMO") || !providers.some((p) => p.available && p.provider === "DEMO") ? (
            <p className="flex items-start gap-2 text-sm text-ink-subtle"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> You will leave this site to pay on the provider&apos;s page. FixedItNow never sees your card details or PIN, and a payment counts only after we have confirmed it with the provider.</p>
          ) : (
            <p className="flex items-start gap-2 text-sm text-ink-subtle"><ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden /> You are in the demo, so the next page is a simulated payment page on this site. No card or mobile-wallet details are asked for and no real money moves.</p>
          )}
        </section>
      )}

      <LinkButton href={`/bookings/${booking.id}`} variant="ghost">Back to the booking</LinkButton>
    </div>
  );
}
