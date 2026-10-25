"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type FormEvent } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { SupportInfo } from "@/components/support/support-list";
import { Alert } from "@/components/ui/alert";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Button, LinkButton } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { api, ApiError } from "@/lib/api";
import type { BookingList, BookingSummary } from "@/lib/booking-types";
import { formatDate } from "@/lib/format";
import {
  CATEGORY_LABELS, COMPLAINT_CATEGORIES, MESSAGE_MAX, MESSAGE_MIN, SUBJECT_MAX, SUBJECT_MIN, TICKET_CATEGORIES,
  type OwnTicket, type TicketCategory,
} from "@/lib/support";
import type { Me } from "@/lib/use-api";

type Option = { booking: BookingSummary; as: "customer" | "worker" };
type Loaded = { status: "loading" } | { status: "ready"; options: Option[]; truncated: boolean } | { status: "error" };

/** The signed-in user's own bookings (as a customer, and as a professional when they are one). */
function useBookingOptions(isWorker: boolean): Loaded {
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    const roles = isWorker ? (["customer", "worker"] as const) : (["customer"] as const);
    Promise.all(roles.map((role) => api<BookingList>(`/bookings?role=${role}&pageSize=50`).then((r) => ({ role, r }))))
      .then((results) => {
        if (cancelled) return;
        setLoaded({
          status: "ready",
          options: results.flatMap(({ role, r }) => r.bookings.map((booking) => ({ booking, as: role }))),
          truncated: results.some(({ r }) => r.total > r.bookings.length),
        });
      })
      .catch(() => { if (!cancelled) setLoaded({ status: "error" }); });
    return () => { cancelled = true; };
  }, [isWorker]);
  return loaded;
}

function Form({ me }: { me: Me }) {
  const id = useId();
  const router = useRouter();
  const [category, setCategory] = useState<TicketCategory | "">("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const bookings = useBookingOptions(me.worker.started);

  const complaint = category !== "" && COMPLAINT_CATEGORIES.includes(category);
  // A complaint about a professional is about a booking you made; about a customer, one you worked.
  const wanted = category === "WORKER_COMPLAINT" ? "customer" : category === "CUSTOMER_COMPLAINT" ? "worker" : null;
  const options = bookings.status === "ready" ? bookings.options.filter((o) => wanted === null || o.as === wanted) : [];

  function validate() {
    const next: Record<string, string> = {};
    if (!category) next.category = "Choose what your request is about.";
    const s = subject.trim().length;
    if (s < SUBJECT_MIN || s > SUBJECT_MAX) next.subject = `Use ${SUBJECT_MIN} to ${SUBJECT_MAX} characters.`;
    const b = body.trim().length;
    if (b < MESSAGE_MIN || b > MESSAGE_MAX) next.body = `Use ${MESSAGE_MIN} to ${MESSAGE_MAX.toLocaleString("en")} characters.`;
    if (complaint && !bookingId) next.bookingId = "Choose the booking this complaint is about.";
    return next;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    setFormError(undefined);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setPending(true);
    try {
      const res = await api<{ ticket: OwnTicket }>("/support/tickets", {
        method: "POST",
        body: { category, subject: subject.trim(), body: body.trim(), ...(bookingId && { bookingId }) },
      });
      router.push(`/account/support/${res.ticket.id}`);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      setFormError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setPending(false);
    }
  }

  const bookingHint =
    bookings.status === "loading" ? "Loading your bookings…"
    : bookings.status === "error" ? "We could not load your bookings, so you cannot attach one right now. Try again later."
    : options.length === 0 ? (complaint ? "You have no booking that fits this complaint, so it cannot be submitted." : "You have no bookings to attach.")
    : complaint ? "Required. Our team will look at this booking and its conversation."
    : "Optional. Attach a booking if your request is about one: our team can then see it and its conversation.";

  return (
    <form onSubmit={submit} noValidate className="max-w-2xl space-y-5" aria-label="New support request">
      <SelectInput id={`${id}-category`} label="What is this about?" placeholder="Choose a topic" value={category} error={errors.category}
        onChange={(e) => { setCategory(e.target.value as TicketCategory | ""); setBookingId(""); }}
        options={TICKET_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))} />
      {category === "SAFETY" && (
        <Alert tone="warning" title="In an emergency, call 999 first">Support requests are answered in the app and are not an emergency service.</Alert>
      )}
      <TextInput id={`${id}-subject`} label="Subject" value={subject} error={errors.subject} maxLength={SUBJECT_MAX} onChange={(e) => setSubject(e.target.value)} hint={`${SUBJECT_MIN} to ${SUBJECT_MAX} characters`} />
      <TextArea id={`${id}-body`} label="Message" value={body} error={errors.body} maxLength={MESSAGE_MAX} onChange={(e) => setBody(e.target.value)} className="min-h-40"
        hint={`${body.trim().length.toLocaleString("en")} of ${MESSAGE_MAX.toLocaleString("en")} characters (at least ${MESSAGE_MIN}). Describe what happened and what you would like us to do.`} />
      <SelectInput id={`${id}-booking`} label={complaint ? "Booking" : "Booking (optional)"} placeholder={complaint ? "Choose a booking" : "No booking"} value={bookingId} error={errors.bookingId}
        onChange={(e) => setBookingId(e.target.value)} disabled={bookings.status !== "ready" || options.length === 0} hint={bookingHint}
        options={options.map((o) => ({
          value: o.booking.id,
          label: `${o.booking.category.name} ${o.as === "customer" ? "with" : "for"} ${o.booking.counterpartyName}, ${formatDate(o.booking.startAt)}${me.worker.started ? (o.as === "customer" ? " (you booked)" : " (you worked)") : ""}`,
        }))} />
      {bookings.status === "ready" && bookings.truncated && <p className="text-sm text-ink-subtle">Only up to 50 bookings are listed per role.</p>}
      {formError && <Alert tone="error">{formError}</Alert>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>Send request</Button>
        <LinkButton href="/account/support" variant="ghost">Cancel</LinkButton>
      </div>
    </form>
  );
}

export function NewRequestForm() {
  return (
    <AuthGate>
      {(me) => (
        <div className="space-y-6">
          <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Account", href: "/account" }, { label: "Help and support", href: "/account/support" }, { label: "New request" }]} />
          <div>
            <h1 className="text-h1 font-extrabold text-brand-950">New request</h1>
            <p className="mt-3 max-w-2xl text-lg text-ink-muted">Tell us what you need. We answer inside the app, so you will find our reply under Help and support.</p>
          </div>
          <SupportInfo />
          <Form me={me} />
        </div>
      )}
    </AuthGate>
  );
}
