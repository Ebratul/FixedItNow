"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import type { BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextInput } from "@/components/ui/text-input";
import { ApiError } from "@/lib/api";
import { dhakaDateKey, dhakaLocalToIso } from "@/lib/format";

type Entry = { label: string; tone: BadgeTone };

export const humanize = (value: string) => {
  const text = value.toLowerCase().replaceAll("_", " ").replaceAll(".", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export const DISPUTE_STATUS: Record<string, Entry> = {
  OPEN: { label: "Open", tone: "warning" },
  UNDER_REVIEW: { label: "Under review", tone: "brand" },
  WAITING_FOR_INFORMATION: { label: "Waiting for information", tone: "warning" },
  RESOLVED: { label: "Resolved", tone: "success" },
  REJECTED: { label: "Rejected", tone: "neutral" },
  CLOSED: { label: "Closed", tone: "neutral" },
};

export const PAYMENT_STATUS: Record<string, Entry> = {
  PENDING: { label: "Pending", tone: "neutral" },
  INITIATED: { label: "Awaiting payment", tone: "neutral" },
  PROCESSING: { label: "Processing", tone: "brand" },
  SUCCEEDED: { label: "Succeeded", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  REQUIRES_REVIEW: { label: "Requires review", tone: "warning" },
  PARTIALLY_REFUNDED: { label: "Partially refunded", tone: "brand" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
  NEEDS_ATTENTION: { label: "Needs attention", tone: "warning" },
};

export const REFUND_STATUS: Record<string, Entry> = {
  REQUESTED: { label: "Requested", tone: "warning" },
  APPROVED: { label: "Approved, not yet sent", tone: "brand" },
  PROCESSING: { label: "Processing at provider", tone: "brand" },
  SUCCEEDED: { label: "Refunded (confirmed)", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  REJECTED: { label: "Rejected", tone: "neutral" },
};

export const PROVIDER_LABEL: Record<string, string> = { BKASH: "bKash" };
export const providerLabel = (p: string) => PROVIDER_LABEL[p] ?? p;

export type Paged = { page: number; pageSize: number; total: number; totalPages: number };

/** Readable text for any thrown value, including the server's field-level validation messages. */
export function errorText(error: unknown): string {
  if (error instanceof ApiError) {
    const fields = Object.values(error.fieldErrors);
    return fields.length > 0 ? `${error.message} ${fields.join(" ")}` : error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

/** Dhaka-midnight instant for a YYYY-MM-DD date, and the one after it (so an end date is inclusive). */
export const dayStartIso = (day: string) => dhakaLocalToIso(`${day}T00:00`);
export const nextDayStartIso = (day: string) => new Date(new Date(dayStartIso(day)).getTime() + 86_400_000).toISOString();
export const shiftDay = (day: string, days: number) => dhakaDateKey(new Date(new Date(dayStartIso(day)).getTime() + days * 86_400_000 + 3_600_000));
export const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/** Validate an inclusive from/to date pair typed by an admin. Returns an error message or undefined. */
export function rangeError(from: string, to: string, maxDays?: number): string | undefined {
  if (from && !isDay(from)) return "Enter a valid start date.";
  if (to && !isDay(to)) return "Enter a valid end date.";
  if (from && to) {
    if (from > to) return "The start date must be on or before the end date.";
    const days = Math.round((new Date(nextDayStartIso(to)).getTime() - new Date(dayStartIso(from)).getTime()) / 86_400_000);
    if (maxDays && days > maxDays) return `Choose a range of at most ${maxDays} days (you chose ${days}).`;
  }
  return undefined;
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
      <ChevronLeft className="size-4" aria-hidden /> {children}
    </Link>
  );
}

export function DateRangeFields({ idPrefix, from, to, onFrom, onTo, error, label = "Created" }: { idPrefix: string; from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void; error?: string; label?: string }) {
  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <TextInput id={`${idPrefix}-from`} type="date" label={`${label} from`} value={from} onChange={(e) => onFrom(e.target.value)} className="w-44" />
        <TextInput id={`${idPrefix}-to`} type="date" label={`${label} to`} value={to} onChange={(e) => onTo(e.target.value)} className="w-44" />
      </div>
      {error && <p role="alert" className="mt-2 text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}

export type TabDef = { value: string; label: string; count?: number };

/** Accessible tab strip (arrow keys move between tabs). The caller renders the panel inside `children`. */
export function Tabs({ label, tabs, value, onChange, children }: { label: string; tabs: TabDef[]; value: string; onChange: (value: string) => void; children: ReactNode }) {
  const id = useId();
  const index = Math.max(0, tabs.findIndex((t) => t.value === value));
  function onKey(event: KeyboardEvent) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = tabs[(index + step + tabs.length) % tabs.length];
    onChange(next.value);
    document.getElementById(`${id}-tab-${next.value || "all"}`)?.focus();
  }
  return (
    <div>
      <div role="tablist" aria-label={label} onKeyDown={onKey} className="flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map((t) => {
          const selected = t.value === value;
          return (
            <button
              key={t.value || "all"}
              type="button"
              role="tab"
              id={`${id}-tab-${t.value || "all"}`}
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.value)}
              className={`-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold whitespace-nowrap ${selected ? "border-brand-700 text-brand-800" : "border-transparent text-ink-muted hover:text-ink"}`}
            >
              {t.label}
              {t.count !== undefined && <span className="rounded-full bg-surface-strong px-2 py-0.5 text-xs tabular-nums text-ink-muted">{t.count}</span>}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${value || "all"}`} className="pt-4">
        {children}
      </div>
    </div>
  );
}

/**
 * Dialog around a small form. Stays open with the server's message when the call fails and closes only
 * after success. Mount it only while it is open, so its fields start empty each time.
 */
export function FormDialog({
  title, submitLabel, onSubmit, onNext, onClose, children, canSubmit = true, tone = "primary",
}: {
  title: string;
  submitLabel: string;
  /** Sends the request. Omit when `onNext` is used. */
  onSubmit?: () => Promise<void>;
  /** For a first step: moves on to a confirmation instead of calling the API. */
  onNext?: () => void;
  onClose: () => void;
  children: ReactNode;
  canSubmit?: boolean;
  tone?: "primary" | "danger";
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || !canSubmit) return;
    if (onNext) return onNext();
    setPending(true);
    setError(undefined);
    try {
      await onSubmit?.();
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open onClose={() => !pending && onClose()} title={title} variant="modal" dismissible={!pending}>
      <form onSubmit={submit} className="space-y-4 p-5" noValidate>
        {children}
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" loading={pending} disabled={!canSubmit} className={tone === "danger" ? "bg-danger text-white hover:bg-danger/90 active:bg-danger" : undefined}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** A labelled fact in a definition list. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 break-words text-ink">{children}</dd>
    </div>
  );
}

export function Section({ title, children, description }: { title: string; children: ReactNode; description?: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-brand-950">{title}</h2>
      {description && <p className="text-sm text-ink-muted">{description}</p>}
      {children}
    </section>
  );
}

/** Safe, bounded text for event metadata (plain text, never HTML). */
export function metadataText(metadata: unknown): string {
  if (metadata === null || metadata === undefined) return "";
  if (typeof metadata !== "object") return String(metadata);
  const text = Object.entries(metadata as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}
