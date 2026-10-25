import type { BadgeTone } from "@/components/ui/badge";
import { dhakaLocalToIso, formatDateTime } from "@/lib/format";

export type Audience = "ALL" | "CUSTOMERS" | "WORKERS";
export type Severity = "INFO" | "WARNING" | "CRITICAL";
export type AnnouncementStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export type AdminAnnouncement = {
  id: string;
  title: string;
  body: string;
  audience: Audience;
  severity: Severity;
  status: AnnouncementStatus;
  startsAt: string | null;
  endsAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  /** Computed by the server: published and inside its window right now. */
  live: boolean;
};

export type AnnouncementList = { announcements: AdminAnnouncement[]; page: number; pageSize: number; total: number; totalPages: number };

export const AUDIENCE_OPTIONS = [
  { value: "ALL", label: "Everyone" },
  { value: "CUSTOMERS", label: "Customers" },
  { value: "WORKERS", label: "Workers" },
] as const;
export const SEVERITY_OPTIONS = [
  { value: "INFO", label: "Information" },
  { value: "WARNING", label: "Warning" },
  { value: "CRITICAL", label: "Critical" },
] as const;

export const AUDIENCE_LABEL: Record<Audience, string> = { ALL: "Everyone", CUSTOMERS: "Customers", WORKERS: "Workers" };
export const SEVERITY_LABEL: Record<Severity, string> = { INFO: "Information", WARNING: "Warning", CRITICAL: "Critical" };
export const SEVERITY_TONE: Record<Severity, BadgeTone> = { INFO: "brand", WARNING: "warning", CRITICAL: "danger" };
export const STATUS_MAP: Record<AnnouncementStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  PUBLISHED: { label: "Published", tone: "success" },
  ARCHIVED: { label: "Archived", tone: "neutral" },
};

/** Who will see an announcement, in words an admin can confirm. */
export const AUDIENCE_SENTENCE: Record<Audience, string> = {
  ALL: "everyone: signed-in customers and workers, and visitors who are not signed in",
  CUSTOMERS: "signed-in customers",
  WORKERS: "signed-in workers",
};

/** "2026-11-05T10:00" in Bangladesh time for a stored instant, for a datetime-local box. */
export const toDhakaLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + 6 * 3_600_000).toISOString().slice(0, 16) : "");

export function windowText(a: Pick<AdminAnnouncement, "startsAt" | "endsAt">) {
  if (!a.startsAt && !a.endsAt) return "No time limit";
  return `${a.startsAt ? formatDateTime(a.startsAt) : "Now"} to ${a.endsAt ? formatDateTime(a.endsAt) : "until archived"}`;
}

export type AnnouncementValues = { title: string; body: string; audience: Audience; severity: Severity; startsAt: string; endsAt: string };
export const EMPTY_VALUES: AnnouncementValues = { title: "", body: "", audience: "ALL", severity: "INFO", startsAt: "", endsAt: "" };

export function valuesOf(a: AdminAnnouncement): AnnouncementValues {
  return { title: a.title, body: a.body, audience: a.audience, severity: a.severity, startsAt: toDhakaLocal(a.startsAt), endsAt: toDhakaLocal(a.endsAt) };
}

/** Client-side mirror of the server rules (3-120 title, 1-2000 body, end after start). The server stays the authority. */
export function validateAnnouncement(v: AnnouncementValues): Partial<Record<keyof AnnouncementValues, string>> {
  const errors: Partial<Record<keyof AnnouncementValues, string>> = {};
  const title = v.title.trim();
  const body = v.body.trim();
  if (title.length < 3 || title.length > 120) errors.title = "Use between 3 and 120 characters.";
  if (body.length < 1) errors.body = "Write the message.";
  else if (body.length > 2000) errors.body = "Use at most 2000 characters.";
  const start = v.startsAt ? Date.parse(dhakaLocalToIsoSafe(v.startsAt)) : null;
  const end = v.endsAt ? Date.parse(dhakaLocalToIsoSafe(v.endsAt)) : null;
  if (v.startsAt && Number.isNaN(start)) errors.startsAt = "Enter a valid date and time.";
  if (v.endsAt && Number.isNaN(end)) errors.endsAt = "Enter a valid date and time.";
  if (!errors.startsAt && !errors.endsAt && start !== null && end !== null && end <= start) errors.endsAt = "The end must be after the start.";
  return errors;
}

function dhakaLocalToIsoSafe(local: string) {
  try {
    return dhakaLocalToIso(local);
  } catch {
    return "invalid";
  }
}

/** Request body for create/update. Empty window boxes mean "no limit" (null clears a stored value on update). */
export function toRequestBody(v: AnnouncementValues) {
  return {
    title: v.title.trim(),
    body: v.body.trim(),
    audience: v.audience,
    severity: v.severity,
    startsAt: v.startsAt ? dhakaLocalToIso(v.startsAt) : null,
    endsAt: v.endsAt ? dhakaLocalToIso(v.endsAt) : null,
  };
}
