"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarX } from "lucide-react";
import { useRef, useState } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { Alert } from "@/components/ui/alert";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import type { BookingDetail, BookingPayment, Quote, RescheduleRequest } from "@/lib/booking-types";
import { EVENT_LABELS, formatBdt, formatDateTime, formatDuration, formatRange } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { DisputeForm, DisputePanel } from "./dispute-panel";
import { PaymentBadge } from "@/components/payments/payment-badge";
import { ChatSection } from "./chat-panel";
import { ReviewPanel } from "@/components/reviews/review-panel";
import { QuoteCard, QuoteForm } from "./quote-panel";
import { RescheduleCard, RescheduleForm } from "./reschedule-panel";
import { StatusBadge } from "./status-badge";

type Dialog =
  | { kind: "accept" | "decline" | "cancel" | "arrive" | "start" | "complete" | "mark_finished" }
  | { kind: "accept_quote" | "reject_quote"; quote: Quote }
  | { kind: "accept_reschedule" | "reject_reschedule"; request: RescheduleRequest };
type Panel = "quote" | "reschedule" | "dispute" | null;

function priceLine(d: BookingDetail["booking"]) {
  const { pricing, durationMinutes } = d;
  if (pricing.agreedAmountBdt !== null) return `${formatBdt(pricing.agreedAmountBdt)} agreed`;
  if (pricing.model === "FIXED" && pricing.unitPriceBdt !== null) return `${formatBdt(pricing.unitPriceBdt)} fixed price (once accepted)`;
  if (pricing.model === "HOURLY" && pricing.unitPriceBdt !== null) return `${formatBdt(pricing.unitPriceBdt)} per hour · about ${formatBdt(Math.round((pricing.unitPriceBdt * durationMinutes) / 60))} (once accepted)`;
  return "To be quoted by the professional";
}

/** Short, honest payment wording for the price row. Only a server-verified payment says "paid". */
function paymentLine(payment: BookingPayment, viewer: "CUSTOMER" | "WORKER") {
  switch (payment.state) {
    case "PAID": return viewer === "CUSTOMER" ? "paid and verified" : "the customer's payment has been verified";
    case "PARTIALLY_REFUNDED": return "paid; part refunded";
    case "REFUNDED": return "refunded";
    case "IN_PROGRESS": return "payment in progress";
    case "UNDER_REVIEW": return "payment under review";
    default: return "not paid yet";
  }
}

function PaymentCard({ detail }: { detail: BookingDetail }) {
  const { booking, payment } = detail;
  if (!("canPay" in payment)) return null;
  const latest = payment.payments[0];
  return (
    <section aria-labelledby="payment-heading">
      <h2 id="payment-heading" className="text-h2 font-extrabold">{booking.status === "COMPLETION_PENDING" && payment.canPay ? "Payment due" : "Payment"}</h2>
      <Card className="mt-4 flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="font-semibold">
            {payment.amountBdt !== null ? formatBdt(payment.amountBdt) : "No price agreed yet"}
            {" "}<span className="font-normal text-ink-muted">· {paymentLine(payment, "CUSTOMER")}</span>
          </p>
          {latest && <p className="mt-1 flex items-center gap-2 text-sm text-ink-muted">Latest attempt: <PaymentBadge payment={latest} /></p>}
          {payment.state === "UNPAID" && !payment.canPay && !["CANCELLED", "DECLINED", "EXPIRED", "DISPUTED"].includes(booking.status) && (
            <p className="mt-1 text-sm text-ink-subtle">Payment opens once the work is marked finished: by the professional, or by you with “Work is finished: pay now” if it was done early.</p>
          )}
          {payment.canPay && booking.status === "COMPLETION_PENDING" && (
            <p className="mt-1 text-sm text-ink-muted">Payment is verified with bKash before the booking is marked completed. Coming back from bKash does not by itself mark it paid.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          {payment.canPay && <LinkButton href={`/bookings/${booking.id}/pay`} variant="accent">Pay now</LinkButton>}
          {payment.activeReference && <LinkButton href={`/payments/${payment.activeReference}`} variant="secondary">Check payment status</LinkButton>}
          {!payment.activeReference && latest && <LinkButton href={`/payments/${latest.reference}`} variant="secondary">Payment details</LinkButton>}
        </div>
      </Card>
    </section>
  );
}

/** Where the booking is in its life. Every step is a fact the server recorded; nothing here is a guess. */
function Progress({ detail }: { detail: BookingDetail }) {
  const { booking, payment, review } = detail;
  if (["REQUESTED", "QUOTED", "CANCELLED", "DECLINED", "EXPIRED"].includes(booking.status) && !booking.confirmedAt) return null;
  const paid = payment.state === "PAID" || payment.state === "PARTIALLY_REFUNDED";
  const reviewed = "review" in review && review.review !== null;
  const steps: { label: string; at: string | null; done: boolean }[] = [
    { label: "Confirmed", at: booking.confirmedAt, done: booking.confirmedAt !== null },
    { label: "Professional arrived", at: booking.arrivedAt, done: booking.arrivedAt !== null },
    { label: "Work started", at: booking.startedAt, done: booking.startedAt !== null },
    { label: "Work finished", at: booking.completionRequestedAt, done: booking.completionRequestedAt !== null },
    { label: "Payment verified", at: null, done: paid },
    { label: "Reviewed", at: null, done: reviewed },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <section aria-labelledby="progress-heading">
      <h2 id="progress-heading" className="sr-only">Progress</h2>
      <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {steps.map((step, i) => (
          <li key={step.label} aria-current={i === current ? "step" : undefined}
            className={`rounded-control border px-3 py-2 text-sm ${step.done ? "border-success bg-success-soft font-semibold" : i === current ? "border-brand-700 font-semibold" : "border-line text-ink-subtle"}`}>
            {i === current && <span className="block text-xs font-bold uppercase tracking-wide text-brand-700">Next</span>}
            <span className="block">{step.done ? "✓ " : ""}{step.label}</span>
            {step.at && <span className="block text-xs font-normal text-ink-muted">{formatDateTime(step.at)}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function View({ initial }: { initial: BookingDetail }) {
  const [detail, setDetail] = useState(initial);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const live = useRef<HTMLDivElement>(null);
  const withdrawing = useRef(false);
  const [withdrawingId, setWithdrawingId] = useState<string>();
  const params = useSearchParams();
  const requested = params.get("requested") === "1";
  const chatRequested = params.get("chat") === "1";
  const { booking, actions, quotes, rescheduleRequests, dispute, events } = detail;
  const viewer = booking.viewerRole;
  const other = viewer === "CUSTOMER" ? booking.worker.displayName : (booking.customer?.name ?? "the customer");

  /** Run a server action; the server's response is the new truth. Errors surface in the caller. */
  async function run(path: string, body: object = {}, message?: string) {
    const res = await api<BookingDetail>(`/bookings/${booking.id}/${path}`, { method: "POST", body });
    setDetail(res);
    setPanel(null);
    setError(undefined);
    if (message) setNotice(message);
    live.current?.focus();
  }
  /** For actions without a dialog: show the server's message instead of failing silently. */
  const fail = (e: unknown) => {
    setNotice(undefined);
    setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    live.current?.focus();
  };
  /** Withdraw a quote / reschedule request once: a second click while the first is in flight is ignored. */
  async function withdraw(id: string, path: string, message: string) {
    if (withdrawing.current) return;
    withdrawing.current = true;
    setWithdrawingId(id);
    try {
      await run(path, {}, message);
    } catch (e) {
      fail(e);
    } finally {
      withdrawing.current = false;
      setWithdrawingId(undefined);
    }
  }
  const done = (res: BookingDetail, message: string) => {
    setDetail(res);
    setPanel(null);
    setError(undefined);
    setNotice(message);
    live.current?.focus();
  };

  const has = (a: string) => actions.includes(a);
  const pendingQuote = quotes.some((q) => q.status === "PENDING");

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-h1 font-extrabold text-brand-950">{booking.category.name}</h1>
          <StatusBadge status={booking.status} arrivedAt={booking.arrivedAt} />
        </div>
        <p className="mt-2 text-lg text-ink-muted">{viewer === "CUSTOMER" ? "with" : "for"} {other}</p>
      </div>

      <div ref={live} tabIndex={-1} role="status" aria-live="polite" className="space-y-3 outline-none">
        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}
        {requested && booking.status === "REQUESTED" && !notice && (
          <Alert tone="success" title="Request sent">
            {booking.worker.displayName} has your request and will accept, decline, or send a quote. Your time is not reserved until it is confirmed.
          </Alert>
        )}
        {booking.status === "EXPIRED" && <Alert tone="info">This request expired because its start time passed without a confirmation.</Alert>}
        {booking.status === "DISPUTED" && <Alert tone="warning" title="This booking is in dispute">It is on hold until a reviewer resolves it.</Alert>}
        {booking.status === "COMPLETION_PENDING" && viewer === "CUSTOMER" && <Alert tone="info" title="The work is finished: payment is due">{booking.worker.displayName} marked the job finished. Pay the agreed amount below to complete the booking, or report a problem.</Alert>}
        {booking.status === "COMPLETION_PENDING" && viewer === "WORKER" && <Alert tone="info" title="Waiting for the customer&apos;s payment">The booking completes after the customer&apos;s payment is verified. {detail.payment.state === "IN_PROGRESS" ? "A payment is in progress." : ""}</Alert>}
      </div>

      <Progress detail={detail} />

      <Card className="p-6">
        <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-[9rem_1fr]">
          <dt className="font-semibold text-ink-muted">When</dt>
          <dd>{formatRange(booking.startAt, booking.endAt)} <span className="text-ink-subtle">· {formatDuration(booking.durationMinutes)} · Bangladesh time</span></dd>
          <dt className="font-semibold text-ink-muted">Where</dt>
          <dd>{booking.serviceAddress ? `${booking.serviceAddress}, ` : ""}{booking.serviceArea}{!booking.serviceAddress && <span className="text-ink-subtle"> · full address is shared once the booking is confirmed</span>}</dd>
          <dt className="font-semibold text-ink-muted">Details</dt>
          <dd className="whitespace-pre-line">{booking.description}</dd>
          {booking.arrivedAt && (<><dt className="font-semibold text-ink-muted">Arrival</dt><dd>{formatDateTime(booking.arrivedAt)} <span className="text-ink-subtle">· reported by the professional (location is not verified)</span></dd></>)}
          <dt className="font-semibold text-ink-muted">Price</dt>
          <dd>{priceLine(booking)} {booking.pricing.agreedAmountBdt !== null && <span className="text-ink-subtle">· {paymentLine(detail.payment, viewer)}</span>}</dd>
          {booking.cancellation && (<><dt className="font-semibold text-ink-muted">Cancelled</dt><dd>{formatDateTime(booking.cancellation.at)}{booking.cancellation.by ? ` by ${booking.cancellation.by === "CUSTOMER" ? "the customer" : booking.cancellation.by === "WORKER" ? "the professional" : "a reviewer"}` : ""}{booking.cancellation.reason ? `: “${booking.cancellation.reason}”` : ""}</dd></>)}
        </dl>
        {booking.worker.slug && viewer === "CUSTOMER" && (
          <p className="mt-4 text-sm"><Link href={`/workers/${booking.worker.slug}`} className="font-semibold text-brand-700 hover:underline">View {booking.worker.displayName}&apos;s profile</Link></p>
        )}
      </Card>

      {viewer === "CUSTOMER" && <PaymentCard detail={detail} />}

      <ChatSection bookingId={booking.id} chat={detail.chat} viewer={viewer} otherName={other} startOpen={chatRequested} />

      <ReviewPanel bookingId={booking.id} workerName={booking.worker.displayName} data={detail.review} onChanged={(review) => setDetail((d) => ({ ...d, review }))} />

      {viewer === "WORKER" && booking.status === "CONFIRMED" && !has("start") && (
        <Alert tone="info" title="Arrival and start open shortly before the appointment">
          You can tell the customer you have arrived, and start the job, from {formatDateTime(booking.startWindowOpensAt)} (30 minutes before the scheduled time).
        </Alert>
      )}

      {actions.length > 0 && (
        <section aria-labelledby="actions-heading">
          <h2 id="actions-heading" className="text-h2 font-extrabold">What you can do</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {has("accept") && <Button variant="accent" onClick={() => setDialog({ kind: "accept" })}>Accept request</Button>}
            {has("quote") && <Button variant="accent" onClick={() => setPanel(panel === "quote" ? null : "quote")}>{pendingQuote ? "Revise quote" : "Send a quote"}</Button>}
            {has("arrive") && <Button variant="accent" onClick={() => setDialog({ kind: "arrive" })}>I have arrived</Button>}
            {has("start") && <Button variant={has("arrive") ? "secondary" : "accent"} onClick={() => setDialog({ kind: "start" })}>Start job</Button>}
            {has("complete") && <Button variant="accent" onClick={() => setDialog({ kind: "complete" })}>Mark job finished</Button>}
            {has("mark_finished") && <Button variant="accent" onClick={() => setDialog({ kind: "mark_finished" })}>Work is finished: pay now</Button>}
            {has("reschedule") && <Button variant="secondary" onClick={() => setPanel(panel === "reschedule" ? null : "reschedule")}>Request a different time</Button>}
            {has("decline") && <Button variant="secondary" onClick={() => setDialog({ kind: "decline" })}>Decline</Button>}
            {has("cancel") && <Button variant="secondary" onClick={() => setDialog({ kind: "cancel" })}>Cancel booking</Button>}
            {has("open_dispute") && <Button variant="ghost" onClick={() => setPanel(panel === "dispute" ? null : "dispute")}>Report a problem</Button>}
          </div>
        </section>
      )}

      {panel === "quote" && <QuoteForm bookingId={booking.id} revising={pendingQuote} onDone={(d) => done(d, "Quote sent. The customer can now accept or reject it.")} onCancel={() => setPanel(null)} />}
      {panel === "reschedule" && <RescheduleForm detail={detail} onDone={(d) => done(d, "Reschedule request sent. The current appointment stays until it is accepted.")} onCancel={() => setPanel(null)} />}
      {panel === "dispute" && <DisputeForm bookingId={booking.id} onDone={(d) => done(d, "Your dispute was submitted.")} onCancel={() => setPanel(null)} />}

      {quotes.length > 0 && (
        <section aria-labelledby="quotes-heading">
          <h2 id="quotes-heading" className="text-h2 font-extrabold">Quotes</h2>
          <ul className="mt-4 space-y-3">
            {quotes.map((q) => (
              <li key={q.id}>
                <QuoteCard quote={q} viewer={viewer}
                  onAccept={() => setDialog({ kind: "accept_quote", quote: q })}
                  onReject={() => setDialog({ kind: "reject_quote", quote: q })}
                  withdrawing={withdrawingId === q.id}
                  onWithdraw={() => void withdraw(q.id, `quotes/${q.id}/withdraw`, "Quote withdrawn.")} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {rescheduleRequests.length > 0 && (
        <section aria-labelledby="resched-heading">
          <h2 id="resched-heading" className="text-h2 font-extrabold">Reschedule requests</h2>
          <ul className="mt-4 space-y-3">
            {rescheduleRequests.map((r) => (
              <li key={r.id}>
                <RescheduleCard request={r} viewer={viewer}
                  onAccept={() => setDialog({ kind: "accept_reschedule", request: r })}
                  onReject={() => setDialog({ kind: "reject_reschedule", request: r })}
                  withdrawing={withdrawingId === r.id}
                  onWithdraw={() => void withdraw(r.id, `reschedule/${r.id}/withdraw`, "Request withdrawn.")} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {dispute && (
        <section aria-labelledby="dispute-heading">
          <h2 id="dispute-heading" className="sr-only">Dispute</h2>
          <DisputePanel bookingId={booking.id} viewer={viewer} onBookingChanged={(d) => done(d, "Dispute withdrawn.")} />
        </section>
      )}

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="text-h2 font-extrabold">History</h2>
        <ol className="mt-4 space-y-3 border-l-2 border-line pl-5">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span aria-hidden className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-brand-600" />
              <p className="text-sm font-semibold">{EVENT_LABELS[e.type] ?? e.type}</p>
              <p className="text-xs text-ink-subtle">{formatDateTime(e.createdAt)} · {e.actorRole === "SYSTEM" ? "automatic" : e.actorRole === "CUSTOMER" ? "customer" : e.actorRole === "WORKER" ? "professional" : "reviewer"}</p>
              {e.reason && <p className="text-sm text-ink-muted">“{e.reason}”</p>}
            </li>
          ))}
        </ol>
      </section>

      <Dialogs dialog={dialog} detail={detail} close={() => setDialog(null)} run={run} />
    </div>
  );
}

function cancelPaymentNote({ payment }: BookingDetail) {
  if (payment.state === "PAID" || payment.state === "PARTIALLY_REFUNDED") {
    return "This booking has been paid. Cancelling does NOT refund it automatically: afterwards the customer can ask for a refund, and our team reviews it.";
  }
  if (payment.state === "IN_PROGRESS") return "A payment is in progress. If it completes after you cancel, it will still be recorded and can be refunded on request.";
  return "Nothing has been charged for this booking.";
}

function Dialogs({ dialog, detail, close, run }: { dialog: Dialog | null; detail: BookingDetail; close: () => void; run: (path: string, body?: object, message?: string) => Promise<void> }) {
  const { booking } = detail;
  const confirmedBooking = booking.status === "CONFIRMED";
  const o = (kind: string) => dialog?.kind === kind;
  return (
    <>
      <ConfirmDialog open={o("accept")} title="Accept this request?" confirmLabel="Accept and confirm" onClose={close}
        onConfirm={() => run("accept", {}, "Booking confirmed. The time is now reserved.")}>
        This confirms {formatRange(booking.startAt, booking.endAt)} and reserves the time. Price: {priceLine(booking)}.
      </ConfirmDialog>
      <ConfirmDialog open={o("decline")} title="Decline this request?" confirmLabel="Decline" tone="danger" reason="optional" onClose={close}
        onConfirm={(reason) => run("decline", reason ? { reason } : {}, "Request declined.")}>
        The customer will see that you declined. You cannot undo this.
      </ConfirmDialog>
      <ConfirmDialog open={o("cancel")} title="Cancel this booking?" confirmLabel="Cancel booking" tone="danger" reason={confirmedBooking ? "required" : "optional"} onClose={close}
        onConfirm={(reason) => run("cancel", reason ? { reason } : {}, "Booking cancelled. The time slot was released.")}>
        {confirmedBooking ? `This booking is confirmed. Please tell the other person why you are cancelling. ${cancelPaymentNote(detail)}` : "The request will be closed and cannot be reopened."}
      </ConfirmDialog>
      <ConfirmDialog open={o("arrive")} title="Tell the customer you have arrived?" confirmLabel="Yes, I have arrived" onClose={close}
        onConfirm={() => run("arrive", {}, "The customer has been told you arrived.")}>
        The customer is notified. This is your own report: FixedItNow does not check your location.
      </ConfirmDialog>
      <ConfirmDialog open={o("start")} title="Start this job?" confirmLabel="Start job" onClose={close}
        onConfirm={() => run("start", {}, "Job started.")}>
        Confirm you are at the address and starting the work.
      </ConfirmDialog>
      <ConfirmDialog open={o("mark_finished")} title="Is the work finished?" confirmLabel="Yes, the work is finished" onClose={close}
        onConfirm={() => run("mark-finished", {}, "Marked as finished. You can pay now.")}>
        Only continue if the job is really done, even if that is earlier than the scheduled time. This makes payment of {booking.pricing.agreedAmountBdt !== null ? formatBdt(booking.pricing.agreedAmountBdt) : "the agreed amount"} due and tells the professional. Nothing is charged yet, and you can still report a problem afterwards.
      </ConfirmDialog>
      <ConfirmDialog open={o("complete")} title="Mark the job as finished?" confirmLabel="Mark finished" onClose={close}
        onConfirm={() => run("complete", {}, "Marked as finished. The customer has been asked to pay.")}>
        The customer is notified that payment of {booking.pricing.agreedAmountBdt !== null ? formatBdt(booking.pricing.agreedAmountBdt) : "the agreed amount"} is due. The booking completes once their payment is verified.
      </ConfirmDialog>
      <ConfirmDialog open={dialog?.kind === "accept_quote"} title="Accept this quote?" confirmLabel="Accept and confirm" onClose={close}
        onConfirm={() => (dialog?.kind === "accept_quote" ? run(`quotes/${dialog.quote.id}/accept`, { expectedTotalBdt: dialog.quote.totalBdt }, "Quote accepted. Your booking is confirmed.") : Promise.resolve())}>
        {dialog?.kind === "accept_quote" && <>You agree to {formatBdt(dialog.quote.totalBdt)} for {formatRange(booking.startAt, booking.endAt)}. This confirms the booking and reserves the time. You can pay after it is confirmed.</>}
      </ConfirmDialog>
      <ConfirmDialog open={dialog?.kind === "reject_quote"} title="Reject this quote?" confirmLabel="Reject quote" tone="danger" reason="optional" onClose={close}
        onConfirm={(reason) => (dialog?.kind === "reject_quote" ? run(`quotes/${dialog.quote.id}/reject`, reason ? { reason } : {}, "Quote rejected. The professional can send a new one.") : Promise.resolve())}>
        The request stays open so the professional can send another quote.
      </ConfirmDialog>
      <ConfirmDialog open={dialog?.kind === "accept_reschedule"} title="Accept the new time?" confirmLabel="Accept new time" onClose={close}
        onConfirm={() => (dialog?.kind === "accept_reschedule" ? run(`reschedule/${dialog.request.id}/accept`, {}, "Appointment moved to the new time.") : Promise.resolve())}>
        {dialog?.kind === "accept_reschedule" && <>The appointment moves to {formatRange(dialog.request.newStartAt, dialog.request.newEndAt)}.</>}
      </ConfirmDialog>
      <ConfirmDialog open={dialog?.kind === "reject_reschedule"} title="Decline the new time?" confirmLabel="Decline" tone="danger" reason="optional" onClose={close}
        onConfirm={(reason) => (dialog?.kind === "reject_reschedule" ? run(`reschedule/${dialog.request.id}/reject`, reason ? { reason } : {}, "Reschedule declined. The original time stands.") : Promise.resolve())}>
        The original appointment stays as it is.
      </ConfirmDialog>
    </>
  );
}

export function BookingDetailView({ id }: { id: string }) {
  return (
    <AuthGate>
      {() => <Loader id={id} />}
    </AuthGate>
  );
}

function Loader({ id }: { id: string }) {
  const { state, reload } = useApi<BookingDetail>(`/bookings/${id}`);
  if (state.status === "loading") return <div aria-busy="true" aria-label="Loading booking" className="space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-48" /><Skeleton className="h-32" /></div>;
  if (state.status === "unauthenticated") return null;
  if (state.status === "error") {
    return /not found/i.test(state.message)
      ? <EmptyState icon={CalendarX} headingLevel={1} title="Booking not found" action={<LinkButton href="/bookings">Back to bookings</LinkButton>}>This booking does not exist, or it belongs to someone else.</EmptyState>
      : <ErrorState action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>;
  }
  return <View initial={state.data} />;
}
