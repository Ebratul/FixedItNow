"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SelectInput } from "@/components/ui/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { ApiError } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import type { BookingDetail } from "@/lib/booking-types";
import { cn } from "@/lib/cn";
import { formatBdt, formatDuration, formatRange } from "@/lib/format";
import { SlotPicker } from "./slot-picker";

export type BookableWorker = {
  id: string;
  slug: string;
  displayName: string;
  serviceAreas: string[];
  services: { category: { slug: string; name: string }; pricingModel: "FIXED" | "HOURLY" | "QUOTE"; basePriceBdt: number | null }[];
};

const DURATIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 30);
const STEPS = ["Details", "Date & time", "Review"] as const;

const priceHint = (s: BookableWorker["services"][number]) =>
  s.pricingModel === "QUOTE" ? "Quote after you send details" : s.basePriceBdt === null ? "" : `${formatBdt(s.basePriceBdt)}${s.pricingModel === "HOURLY" ? " per hour" : ""}`;

/**
 * Booking request in three steps. Nothing is "booked" here: the server creates
 * a REQUEST that the professional must answer, and we only navigate away once
 * the server has confirmed it exists.
 */
export function BookingForm({ worker }: { worker: BookableWorker }) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState(worker.services[0]?.category.slug ?? "");
  const [description, setDescription] = useState("");
  const [area, setArea] = useState(worker.serviceAreas.length === 1 ? worker.serviceAreas[0] : "");
  const [address, setAddress] = useState("");
  const [duration, setDuration] = useState(60);
  const [startAt, setStartAt] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Same key for retries of the SAME payload; a new one once the payload changes.
  const keyRef = useRef<{ payload: string; key: string } | null>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const service = worker.services.find((s) => s.category.slug === category);
  const nextPath = `/workers/${worker.slug}/book`;

  if (sessionPending) return <Skeleton className="h-96" />;
  if (!session) {
    return (
      <Card className="p-6">
        <h2 className="text-xl font-bold">Log in to request a booking</h2>
        <p className="mt-2 text-ink-muted">You need an account so {worker.displayName} can reply and you can track the request.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <LinkButton href={`/login?next=${encodeURIComponent(nextPath)}`}>Log in</LinkButton>
          <LinkButton href="/register" variant="secondary">Create an account</LinkButton>
        </div>
      </Card>
    );
  }

  function validateDetails() {
    const found: Record<string, string> = {};
    if (!category) found.category = "Choose a service";
    if (description.trim().length < 10) found.description = "Describe the work in at least 10 characters";
    if (!area) found.serviceArea = "Choose where the work is";
    if (address.trim().length < 5) found.serviceAddress = "Enter the address (at least 5 characters)";
    setErrors(found);
    if (Object.keys(found).length) requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
    return Object.keys(found).length === 0;
  }

  async function submit() {
    if (pending || !startAt) return;
    setPending(true);
    setFormError(undefined);
    const body = {
      workerId: worker.id,
      categorySlug: category,
      description: description.trim(),
      serviceArea: area,
      serviceAddress: address.trim(),
      startAt,
      durationMinutes: duration,
    };
    const payload = JSON.stringify(body);
    if (keyRef.current?.payload !== payload) keyRef.current = { payload, key: crypto.randomUUID() };
    try {
      const res = await fetch("/api/v1/bookings", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": keyRef.current.key },
        body: payload,
      });
      const json = (await res.json().catch(() => ({}))) as Partial<BookingDetail> & { message?: string; code?: string; errors?: { path: string; message: string }[] };
      if (!res.ok) {
        const fieldErrors: Record<string, string> = {};
        for (const e of json.errors ?? []) fieldErrors[e.path] ??= e.message;
        setErrors(fieldErrors);
        setFormError(res.status === 429 ? "Too many requests. Please wait a moment and try again." : (json.message ?? "We couldn't send your request."));
        if (json.code === "SLOT_UNAVAILABLE" || json.code === "OUTSIDE_AVAILABILITY" || json.code === "TOO_SOON" || json.code === "TIME_OFF") {
          setStartAt(null);
          setStep(2);
        }
        setPending(false);
        return;
      }
      // Only now (the server confirmed the request exists) do we leave the form.
      router.push(`/bookings/${json.booking!.id}?requested=1`);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "We couldn't reach the server. Check your connection and try again.");
      setPending(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <nav aria-label="Progress">
        <p className="text-sm font-semibold text-ink-muted">Step {step} of {STEPS.length}: {STEPS[step - 1]}</p>
        <ol className="mt-3 grid grid-cols-3 gap-2">
          {STEPS.map((title, i) => (
            <li key={title} aria-current={i + 1 === step ? "step" : undefined} className={cn("h-1.5 rounded-full", i + 1 < step ? "bg-accent-600" : i + 1 === step ? "bg-brand-700" : "bg-line")}>
              <span className="sr-only">{title}</span>
            </li>
          ))}
        </ol>
      </nav>

      <Card className="mt-6 p-6">
        <h2 ref={headingRef} tabIndex={-1} className="text-xl font-bold outline-none">{STEPS[step - 1]}</h2>

        <div className="mt-6 space-y-5">
          {step === 1 && (
            <>
              <SelectInput
                id="bk-service"
                label="Service"
                placeholder="Choose a service"
                options={worker.services.map((s) => ({ value: s.category.slug, label: `${s.category.name}${priceHint(s) ? ` · ${priceHint(s)}` : ""}` }))}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                error={errors.categorySlug ?? errors.category}
              />
              <TextArea
                id="bk-description"
                label="What needs to be done?"
                hint={`${description.trim().length}/1000 characters (at least 10). Describe the problem so the professional can prepare.`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                error={errors.description}
              />
              <SelectInput
                id="bk-area"
                label="Area (division)"
                placeholder="Choose an area"
                options={worker.serviceAreas}
                value={area}
                onChange={(e) => setArea(e.target.value)}
                error={errors.serviceArea}
              />
              <TextInput
                id="bk-address"
                label="Address"
                hint="Shown to the professional only after they confirm the booking."
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={300}
                autoComplete="street-address"
                error={errors.serviceAddress}
              />
            </>
          )}

          {step === 2 && (
            <>
              <SelectInput
                id="bk-duration"
                label="How long do you expect it to take?"
                placeholder="Choose a duration"
                options={DURATIONS.map((m) => ({ value: String(m), label: formatDuration(m) }))}
                value={String(duration)}
                onChange={(e) => {
                  setDuration(Number(e.target.value) || 60);
                  setStartAt(null);
                }}
                error={errors.durationMinutes}
              />
              <SlotPicker slug={worker.slug} durationMinutes={duration} value={startAt} onChange={setStartAt} />
              {errors.startAt && <Alert tone="error">{errors.startAt}</Alert>}
            </>
          )}

          {step === 3 && startAt && service && (
            <>
              <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-[9rem_1fr]">
                <dt className="font-semibold text-ink-muted">Professional</dt>
                <dd>{worker.displayName}</dd>
                <dt className="font-semibold text-ink-muted">Service</dt>
                <dd>{service.category.name}</dd>
                <dt className="font-semibold text-ink-muted">When</dt>
                <dd>{formatRange(startAt, new Date(new Date(startAt).getTime() + duration * 60_000).toISOString())} <span className="text-ink-subtle">(Bangladesh time)</span></dd>
                <dt className="font-semibold text-ink-muted">Where</dt>
                <dd>{address.trim()}, {area}</dd>
                <dt className="font-semibold text-ink-muted">Details</dt>
                <dd className="whitespace-pre-line">{description.trim()}</dd>
                <dt className="font-semibold text-ink-muted">Price</dt>
                <dd>
                  {service.pricingModel === "FIXED" && service.basePriceBdt !== null && <>{formatBdt(service.basePriceBdt)} fixed price</>}
                  {service.pricingModel === "HOURLY" && service.basePriceBdt !== null && <>{formatBdt(service.basePriceBdt)} per hour, about {formatBdt(Math.round((service.basePriceBdt * duration) / 60))} for {formatDuration(duration)}</>}
                  {service.pricingModel === "QUOTE" && <>The professional will send you a quote to accept or decline</>}
                </dd>
              </dl>
              <Alert tone="info" title="This is a request, not a confirmed booking">
                {worker.displayName} has to accept it{service.pricingModel === "QUOTE" ? " (after you accept their quote)" : ""} before the time is reserved. No payment is taken at this stage.
              </Alert>
            </>
          )}

          {formError && <Alert tone="error">{formError}</Alert>}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
            {step > 1 ? (
              <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={pending}>
                <ArrowLeft className="size-4" aria-hidden /> Back
              </Button>
            ) : (
              <Link href={`/workers/${worker.slug}`} className="text-sm font-semibold text-brand-700 hover:underline">Cancel</Link>
            )}
            {step === 1 && (
              <Button onClick={() => validateDetails() && setStep(2)}>
                Continue <ArrowRight className="size-4" aria-hidden />
              </Button>
            )}
            {step === 2 && (
              <Button
                onClick={() => {
                  if (!startAt) return setErrors({ startAt: "Choose a start time" });
                  setErrors({});
                  setStep(3);
                }}
              >
                Review <ArrowRight className="size-4" aria-hidden />
              </Button>
            )}
            {step === 3 && (
              <Button variant="accent" onClick={submit} loading={pending}>
                {pending ? "Sending…" : "Send request"}
                {!pending && <Send className="size-4" aria-hidden />}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
