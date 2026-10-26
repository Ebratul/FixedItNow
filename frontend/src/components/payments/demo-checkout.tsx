"use client";

import { useRouter } from "next/navigation";
import { FlaskConical, Receipt } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { Alert } from "@/components/ui/alert";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { formatBdt } from "@/lib/format";
import { awaitsDemoOutcome, describePayment, SIMULATED_NOTE } from "@/lib/payment-status";
import type { PaymentDetail } from "@/lib/payment-types";

export type DemoOutcome = "success" | "failed" | "cancelled";

const OUTCOMES: { outcome: DemoOutcome; label: string; variant: "accent" | "secondary" | "ghost" }[] = [
  { outcome: "success", label: "Simulate successful payment", variant: "accent" },
  { outcome: "failed", label: "Simulate failed payment", variant: "secondary" },
  { outcome: "cancelled", label: "Cancel", variant: "ghost" },
];

/** `/payments/demo/<reference>`: the simulated stand-in for the provider's own checkout page. */
export function DemoCheckoutView({ reference }: { reference: string }) {
  return <AuthGate>{() => <Loader reference={reference} />}</AuthGate>;
}

function Loader({ reference }: { reference: string }) {
  const [data, setData] = useState<PaymentDetail>();
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      setData(await api<PaymentDetail>(`/payments/${reference}`));
      setError(undefined);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? "NOT_FOUND" : e instanceof Error ? e.message : "Something went wrong.");
    }
  }, [reference]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of server state
    void load();
  }, [load]);

  if (error === "NOT_FOUND") {
    return <EmptyState icon={Receipt} headingLevel={1} title="Payment not found" action={<LinkButton href="/payments">Your payments</LinkButton>}>This payment does not exist, or it belongs to someone else.</EmptyState>;
  }
  if (error) return <ErrorState action={<Button onClick={load}>Try again</Button>}>{error}</ErrorState>;
  if (!data) return <div aria-busy="true" aria-label="Loading payment" className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-48" /></div>;
  return <DemoCheckout payment={data.payment} />;
}

/**
 * Three buttons, each a POST naming only the outcome; the server applies it to the stored attempt (amount, booking and
 * customer are never sent from here). One request at a time: the ref is the guard, so a double click is one request.
 */
export function DemoCheckout({ payment }: { payment: PaymentDetail["payment"] }) {
  const router = useRouter();
  const locked = useRef(false);
  const [busy, setBusy] = useState<DemoOutcome | null>(null);
  const [error, setError] = useState<string>();
  const statusHref = `/payments/${payment.reference}`;

  async function choose(outcome: DemoOutcome) {
    if (locked.current) return;
    locked.current = true;
    setBusy(outcome);
    setError(undefined);
    try {
      await api(`/payments/${payment.reference}/demo-outcome`, { method: "POST", body: { outcome } });
      router.replace(`${statusHref}?returned=1`);
      return; // stay locked while navigating
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    }
    locked.current = false;
    setBusy(null);
  }

  const isDemo = payment.provider === "DEMO";
  const waiting = awaitsDemoOutcome(payment);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-h1 font-extrabold text-brand-950"><FlaskConical className="size-7 text-brand-600" aria-hidden /> Simulated payment</h1>
        <p className="mt-2 text-lg text-ink-muted">{payment.booking.serviceName} with {payment.booking.workerName}</p>
      </div>

      <Alert tone="warning" title="Demo payment">
        Demo payment — no real money is charged. This page stands in for bKash. {SIMULATED_NOTE}.
      </Alert>

      <Card className="p-6">
        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-[9rem_1fr]">
          <dt className="font-semibold text-ink-muted">Amount</dt>
          <dd className="text-lg font-extrabold">{formatBdt(payment.amountBdt)} <span className="text-sm font-normal text-ink-subtle">{payment.currency}</span></dd>
          <dt className="font-semibold text-ink-muted">Booking</dt>
          <dd>{payment.booking.serviceName} with {payment.booking.workerName}</dd>
          <dt className="font-semibold text-ink-muted">Reference</dt>
          <dd className="font-mono text-xs break-all">{payment.reference}</dd>
        </dl>
      </Card>

      {!isDemo ? (
        <Alert tone="info" title="This is not a demo payment">Only simulated payments can be finished on this page. <LinkButton href={statusHref} variant="ghost" size="sm" className="inline-flex">See the payment</LinkButton></Alert>
      ) : !waiting ? (
        <Alert tone="info" title="This simulated payment is not waiting for an outcome">
          {describePayment(payment).headline}. <LinkButton href={statusHref} variant="ghost" size="sm" className="inline-flex">See the payment</LinkButton>
        </Alert>
      ) : (
        <section aria-labelledby="demo-outcome-heading" className="space-y-4">
          <h2 id="demo-outcome-heading" className="text-h2 font-extrabold">Choose what happens</h2>
          <p className="text-sm text-ink-muted">Pick an outcome to see how the rest of the app reacts. Nothing is sent to a payment provider.</p>
          <p role="status" className="sr-only">{busy ? "Applying the simulated outcome…" : ""}</p>
          {error && <Alert tone="error">{error}</Alert>}
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {OUTCOMES.map(({ outcome, label, variant }) => (
              <Button key={outcome} variant={variant} loading={busy === outcome} disabled={busy !== null} onClick={() => choose(outcome)}>
                {label}
              </Button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
