"use client";

import Link from "next/link";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { Alert } from "@/components/ui/alert";
import { Button, LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TextInput } from "@/components/ui/text-input";
import { api } from "@/lib/api";
import type { MyAvailability } from "@/lib/booking-types";
import { dhakaLocalToIso, formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MINUTES = Array.from({ length: 49 }, (_, i) => i * 30);
type Win = { start: number; end: number };

function label(minute: number) {
  if (minute === 1440) return "End of day";
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function toDays(data: MyAvailability): Win[][] {
  const days: Win[][] = DAYS.map(() => []);
  for (const r of data.rules) days[r.weekday].push({ start: r.startMinute, end: r.endMinute });
  return days;
}

/** Validate each day: end after start and no overlaps. Returns a message per day. */
export function validateDays(days: Win[][]): (string | undefined)[] {
  return days.map((windows) => {
    const sorted = [...windows].sort((a, b) => a.start - b.start);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].end <= sorted[i].start) return "Each window must end after it starts";
      if (i > 0 && sorted[i].start < sorted[i - 1].end) return "Windows on the same day must not overlap";
    }
    return undefined;
  });
}

function Editor({ initial, reload }: { initial: MyAvailability; reload: () => void }) {
  const [days, setDays] = useState<Win[][]>(() => toDays(initial));
  const [problems, setProblems] = useState<(string | undefined)[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string }>();

  const [offStart, setOffStart] = useState("");
  const [offEnd, setOffEnd] = useState("");
  const [offNote, setOffNote] = useState("");
  const [offBusy, setOffBusy] = useState(false);
  const [offError, setOffError] = useState<string>();

  const update = (d: number, fn: (w: Win[]) => Win[]) => {
    setDays((cur) => cur.map((w, i) => (i === d ? fn(w) : w)));
    setMessage(undefined);
  };

  async function save() {
    const found = validateDays(days);
    setProblems(found);
    if (found.some(Boolean)) return;
    setSaving(true);
    setMessage(undefined);
    try {
      const rules = days.flatMap((windows, weekday) => windows.map((w) => ({ weekday, startMinute: w.start, endMinute: w.end })));
      const saved = await api<MyAvailability>("/me/availability", { method: "PUT", body: { rules } });
      setDays(toDays(saved));
      setMessage({ tone: "success", text: rules.length ? "Working hours saved. New requests will use them." : "Saved. You have no working hours, so you cannot receive booking requests." });
    } catch (e) {
      setMessage({ tone: "error", text: e instanceof Error ? e.message : "Could not save." });
    } finally {
      setSaving(false);
    }
  }

  async function addTimeOff() {
    if (!offStart || !offEnd) return setOffError("Choose when your time off starts and ends");
    setOffBusy(true);
    setOffError(undefined);
    try {
      await api("/me/time-off", { method: "POST", body: { startAt: dhakaLocalToIso(offStart), endAt: dhakaLocalToIso(offEnd), ...(offNote.trim() && { note: offNote.trim() }) } });
      setOffStart(""); setOffEnd(""); setOffNote("");
      reload();
    } catch (e) {
      setOffError(e instanceof Error ? e.message : "Could not add time off.");
    } finally {
      setOffBusy(false);
    }
  }
  async function removeTimeOff(id: string) {
    try {
      await api(`/me/time-off/${id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      setOffError(e instanceof Error ? e.message : "Could not remove it.");
    }
  }

  return (
    <div className="max-w-3xl space-y-10">
      <section aria-labelledby="hours-heading">
        <h2 id="hours-heading" className="text-h2 font-extrabold">Weekly working hours</h2>
        <p className="mt-2 text-ink-muted">Customers can only request times inside these windows. All times are Bangladesh time (UTC+6). Changing hours never cancels bookings you already confirmed.</p>
        <ul className="mt-6 space-y-3">
          {days.map((windows, d) => (
            <li key={DAYS[d]}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-bold">{DAYS[d]}</h3>
                  {windows.length === 0 && <span className="text-sm text-ink-subtle">Not working</span>}
                  <Button variant="secondary" size="sm" onClick={() => update(d, (w) => [...w, w.length ? { start: Math.min(w.at(-1)!.end, 1380), end: Math.min(w.at(-1)!.end + 120, 1440) } : { start: 540, end: 1020 }])}>
                    <Plus className="size-4" aria-hidden /> Add hours
                  </Button>
                </div>
                {windows.map((w, i) => (
                  <div key={i} className="mt-3 flex flex-wrap items-end gap-3">
                    <TimeSelect id={`d${d}-s${i}`} label={`${DAYS[d]} window ${i + 1} start`} value={w.start} max={1410} onChange={(v) => update(d, (cur) => cur.map((x, k) => (k === i ? { ...x, start: v } : x)))} />
                    <TimeSelect id={`d${d}-e${i}`} label={`${DAYS[d]} window ${i + 1} end`} value={w.end} min={30} onChange={(v) => update(d, (cur) => cur.map((x, k) => (k === i ? { ...x, end: v } : x)))} />
                    <Button variant="ghost" size="sm" aria-label={`Remove ${DAYS[d]} window ${i + 1}`} onClick={() => update(d, (cur) => cur.filter((_, k) => k !== i))}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                ))}
                {problems[d] && <p role="alert" className="mt-2 text-sm font-medium text-danger">{problems[d]}</p>}
              </Card>
            </li>
          ))}
        </ul>
        {message && <Alert tone={message.tone} className="mt-4">{message.text}</Alert>}
        <div className="mt-5">
          <Button onClick={save} loading={saving}>Save working hours</Button>
        </div>
      </section>

      <section aria-labelledby="off-heading">
        <h2 id="off-heading" className="text-h2 font-extrabold">Time off</h2>
        <p className="mt-2 text-ink-muted">Block holidays or leave. You can&apos;t block a time that already has a confirmed booking; reschedule or cancel that booking first.</p>
        {initial.timeOff.length > 0 && (
          <ul className="mt-4 space-y-2">
            {initial.timeOff.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line p-3 text-sm">
                <span>{formatDateTime(t.startAt)} → {formatDateTime(t.endAt)}{t.note ? ` · ${t.note}` : ""}</span>
                <Button variant="ghost" size="sm" onClick={() => removeTimeOff(t.id)} aria-label={`Remove time off starting ${formatDateTime(t.startAt)}`}>
                  <Trash2 className="size-4" aria-hidden /> Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Card className="mt-4 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput id="off-start" type="datetime-local" label="From (Bangladesh time)" value={offStart} onChange={(e) => setOffStart(e.target.value)} />
            <TextInput id="off-end" type="datetime-local" label="Until" value={offEnd} onChange={(e) => setOffEnd(e.target.value)} />
          </div>
          <div className="mt-4"><TextInput id="off-note" label="Note (private, optional)" value={offNote} onChange={(e) => setOffNote(e.target.value)} maxLength={200} /></div>
          {offError && <Alert tone="error" className="mt-4">{offError}</Alert>}
          <div className="mt-4"><Button variant="secondary" onClick={addTimeOff} loading={offBusy}>Add time off</Button></div>
        </Card>
      </section>
    </div>
  );
}

function TimeSelect({ id, label: aria, value, onChange, min = 0, max = 1440 }: { id: string; label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">{aria}</label>
      <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} className="min-h-11 rounded-control border border-line-strong bg-canvas px-3 text-sm text-ink">
        {MINUTES.filter((m) => m >= min && m <= max).map((m) => <option key={m} value={m}>{label(m)}</option>)}
      </select>
    </div>
  );
}

function Loader() {
  const { state, reload } = useApi<MyAvailability>("/me/availability");
  if (state.status === "loading" || state.status === "unauthenticated") return <Skeleton className="h-96 max-w-3xl" />;
  if (state.status === "error") {
    return /worker profile/i.test(state.message)
      ? <EmptyState icon={CalendarClock} headingLevel={2} title="Set up your worker profile first" action={<LinkButton href="/onboarding/worker">Start worker profile</LinkButton>}>Working hours belong to your professional profile.</EmptyState>
      : <ErrorState action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>;
  }
  return <Editor initial={state.data} reload={reload} />;
}

export function AvailabilityEditor() {
  return (
    <AuthGate>
      {() => (
        <div>
          <h1 className="text-h1 font-extrabold text-brand-950">Availability</h1>
          <p className="mt-3 mb-8 text-lg text-ink-muted">Set when customers can book you. <Link href="/bookings" className="font-semibold text-brand-700 hover:underline">See your bookings</Link></p>
          <Loader />
        </div>
      )}
    </AuthGate>
  );
}
