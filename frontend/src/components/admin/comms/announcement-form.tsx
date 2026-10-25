"use client";

import { useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { api, ApiError } from "@/lib/api";
import {
  AUDIENCE_OPTIONS, SEVERITY_OPTIONS, toRequestBody, validateAnnouncement,
  type AdminAnnouncement, type Audience, type AnnouncementValues, type Severity,
} from "./announcement-utils";

/** Create or edit a draft/published announcement. Times are typed in Bangladesh time. */
export function AnnouncementForm({
  initial,
  editing,
  onSaved,
  onCancel,
}: {
  initial: AnnouncementValues;
  /** The announcement being edited; omit to create. */
  editing?: AdminAnnouncement;
  onSaved: (message: string) => void;
  onCancel: () => void;
}) {
  const uid = useId();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof AnnouncementValues, string>>>({});
  const [serverError, setServerError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof AnnouncementValues>(key: K, value: AnnouncementValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const found = validateAnnouncement(values);
    setErrors(found);
    setServerError(undefined);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      const body = toRequestBody(values);
      if (editing) await api(`/admin/announcements/${editing.id}`, { method: "PATCH", body });
      else await api("/admin/announcements", { method: "POST", body });
      onSaved(editing ? "Changes saved." : "Draft created. Publish it when you are ready.");
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) {
        const mapped: Partial<Record<keyof AnnouncementValues, string>> = {};
        for (const [path, message] of Object.entries(e.fieldErrors)) {
          if (path === "title" || path === "body") mapped[path] = message;
          else if (path === "startsAt" || path === "endsAt") mapped[path] = message;
        }
        setErrors(mapped);
      }
      setServerError(e instanceof Error ? e.message : "The announcement could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate aria-label={editing ? "Edit announcement" : "New announcement"} className="space-y-4">
      <TextInput id={`${uid}-title`} label="Title" value={values.title} maxLength={120} onChange={(e) => set("title", e.target.value)} error={errors.title} hint="3 to 120 characters." required />
      <TextArea
        id={`${uid}-body`} label="Message" value={values.body} maxLength={2000} onChange={(e) => set("body", e.target.value)}
        error={errors.body} hint={`${values.body.length} / 2000 characters. Plain text only.`} required
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectInput id={`${uid}-audience`} label="Audience" placeholder={null} options={AUDIENCE_OPTIONS} value={values.audience} onChange={(e) => set("audience", e.target.value as Audience)} />
        <SelectInput id={`${uid}-severity`} label="Severity" placeholder={null} options={SEVERITY_OPTIONS} value={values.severity} onChange={(e) => set("severity", e.target.value as Severity)} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          id={`${uid}-start`} type="datetime-local" label="Show from (Bangladesh time)" value={values.startsAt}
          onChange={(e) => set("startsAt", e.target.value)} error={errors.startsAt} hint="Optional. Leave empty to show as soon as it is published."
        />
        <TextInput
          id={`${uid}-end`} type="datetime-local" label="Show until (Bangladesh time)" value={values.endsAt}
          onChange={(e) => set("endsAt", e.target.value)} error={errors.endsAt} hint="Optional. Leave empty to show until archived."
        />
      </div>
      <div aria-live="polite">{serverError && <Alert tone="error">{serverError}</Alert>}</div>
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button type="submit" loading={saving}>{editing ? "Save changes" : "Create draft"}</Button>
      </div>
    </form>
  );
}
