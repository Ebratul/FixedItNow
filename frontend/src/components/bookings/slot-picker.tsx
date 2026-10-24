"use client";

import { useEffect, useState } from "react";
import { CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TextInput } from "@/components/ui/text-input";
import { api } from "@/lib/api";
import type { PublicAvailability } from "@/lib/booking-types";
import { cn } from "@/lib/cn";
import { dhakaDateKey, formatDate, formatTime } from "@/lib/format";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: PublicAvailability };

/**
 * Real bookable times from the public availability API (grouped by Bangladesh
 * calendar day, two weeks at a time). Selecting a time only fills the form: the
 * server re-validates it when the request is sent, and again on confirmation.
 */
export function SlotPicker({
  slug,
  durationMinutes,
  value,
  onChange,
}: {
  slug: string;
  durationMinutes: number;
  value: string | null;
  onChange: (iso: string) => void;
}) {
  const today = dhakaDateKey();
  const [from, setFrom] = useState(today);
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<PublicAvailability>(`/workers/${encodeURIComponent(slug)}/availability?from=${from}&days=14&duration=${durationMinutes}`)
      .then((data) => !cancelled && setState({ status: "ready", data }))
      .catch((e: unknown) => !cancelled && setState({ status: "error", message: e instanceof Error ? e.message : "Could not load times." }));
    return () => {
      cancelled = true;
    };
  }, [slug, from, durationMinutes, attempt]);

  const reload = () => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  };
  const changeFrom = (next: string) => {
    setState({ status: "loading" });
    setFrom(next);
  };

  return (
    <div className="space-y-4">
      <TextInput
        id="slot-from"
        type="date"
        label="Show times starting from"
        hint="Times are shown in Bangladesh time (UTC+6)."
        value={from}
        min={today}
        onChange={(e) => e.target.value && changeFrom(e.target.value)}
        className="max-w-56"
      />

      {state.status === "loading" && (
        <div aria-busy="true" aria-label="Loading available times" className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-11" />
        </div>
      )}
      {state.status === "error" && (
        <ErrorState title="We couldn't load available times" action={<Button onClick={reload}>Try again</Button>}>
          {state.message}
        </ErrorState>
      )}
      {state.status === "ready" && !state.data.acceptingBookings && (
        <EmptyState icon={CalendarX} headingLevel={3} title="Not accepting booking requests yet">
          This professional has not published working hours.
        </EmptyState>
      )}
      {state.status === "ready" && state.data.acceptingBookings && (() => {
        const days = state.data.days.filter((d) => d.slots.length > 0);
        if (days.length === 0) {
          return (
            <EmptyState icon={CalendarX} headingLevel={3} title="No available times in this period" action={<Button variant="secondary" onClick={() => changeFrom(state.data.days.at(-1)!.date)}>Look later</Button>}>
              Try a later start date or a shorter duration.
            </EmptyState>
          );
        }
        return (
          <fieldset className="space-y-5" aria-describedby="slot-help">
            <legend className="text-sm font-semibold text-ink">Choose a start time</legend>
            <p id="slot-help" className="sr-only">Each time is the start of a {durationMinutes}-minute appointment.</p>
            {days.map((day) => (
              <div key={day.date}>
                <p className="text-sm font-bold text-ink">{formatDate(day.slots[0])}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {day.slots.map((slot) => {
                    const selected = value === slot;
                    return (
                      <label
                        key={slot}
                        className={cn(
                          "inline-flex min-h-11 min-w-24 cursor-pointer items-center justify-center rounded-control border px-3 text-sm font-semibold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-600",
                          selected ? "border-brand-700 bg-brand-700 text-white" : "border-line-strong bg-canvas text-ink hover:border-brand-300",
                        )}
                      >
                        <input type="radio" name="slot" value={slot} checked={selected} onChange={() => onChange(slot)} className="sr-only" />
                        {formatTime(slot)}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </fieldset>
        );
      })()}
    </div>
  );
}
