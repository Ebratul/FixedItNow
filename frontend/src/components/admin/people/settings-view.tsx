"use client";

import { Settings } from "lucide-react";
import { useId, useState } from "react";
import { AdminPage, ApiView } from "@/components/admin/kit";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { TextInput } from "@/components/ui/text-input";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useApi } from "@/lib/use-api";
import { readableError } from "./admin-errors";
import type { PlatformSetting } from "./types";

type Value = boolean | number | string;

/**
 * What the settings that change the whole platform's behaviour do, in plain words: `now` describes the
 * current state, `turnOn`/`turnOff` describe what the change causes.
 */
export const RISK_NOTES: Record<string, { nowOn: string; nowOff: string; turnOn: string; turnOff: string }> = {
  "platform.maintenanceMode": {
    nowOn: "Maintenance mode is ON: customers and workers can browse but every change they try to make is refused with the maintenance message. Administrators, sign-in and payment-provider callbacks still work.",
    nowOff: "Maintenance mode is OFF: the platform works normally.",
    turnOn: "Turning ON blocks every change that customers and workers try to make (booking, paying, posting, editing their profile). They can still browse and see the maintenance message. Administrators, sign-in and payment-provider callbacks keep working.",
    turnOff: "Turning OFF lets customers and workers make changes again.",
  },
  "platform.registrationsOpen": {
    nowOn: "Registrations are OPEN: anyone can create an account.",
    nowOff: "Registrations are CLOSED: nobody new can create an account. People who already have one can still sign in.",
    turnOn: "Turning ON lets new people create accounts again (email sign-up and first-time Google sign-in).",
    turnOff: "Turning OFF stops anyone new from creating an account. People who already have an account can still sign in.",
  },
  "ai.assistantEnabled": {
    nowOn: "The AI assistant is ON and answers questions.",
    nowOff: "The AI assistant is OFF: people who ask it a question get an unavailable message.",
    turnOn: "Turning ON lets the AI assistant answer questions again.",
    turnOff: "Turning OFF makes the AI assistant stop answering: people asking it a question get an unavailable message until you turn it back on.",
  },
};

const show = (v: Value) => (typeof v === "boolean" ? (v ? "On" : "Off") : v === "" ? "(empty)" : String(v));

/** Platform settings grouped by area. Editing needs `settings.manage`; every change asks for a reason and is audited. */
export function SettingsView() {
  const { can } = useAdmin();
  const manage = can("settings.manage");
  const { state, reload, refresh } = useApi<{ settings: PlatformSetting[] }>("/admin/settings");
  const [pending, setPending] = useState<{ setting: PlatformSetting; value: Value } | null>(null);
  const [notice, setNotice] = useState<string>();

  return (
    <AdminPage
      title="Platform settings"
      description={manage ? "Runtime settings for the whole platform. Each change asks for a reason and is written to the audit log." : "Current platform settings. Your role can view them but not change them."}
      permission="settings.read"
    >
      <div aria-live="polite">{notice && <Alert tone="success">{notice}</Alert>}</div>
      {!manage && <Alert tone="info">Read-only: changing settings needs the “Change platform settings” permission.</Alert>}
      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-64" />}>
        {({ settings }) => {
          if (settings.length === 0) return <EmptyState icon={Settings} title="No settings" headingLevel={2}>The server did not return any settings.</EmptyState>;
          const groups = [...new Set(settings.map((s) => s.group))];
          return (
            <div className="space-y-8">
              {groups.map((group) => (
                <section key={group} aria-labelledby={`group-${group}`} className="space-y-3">
                  <h2 id={`group-${group}`} className="text-lg font-bold text-brand-950">{group}</h2>
                  <ul className="space-y-3">
                    {settings.filter((s) => s.group === group).map((s) => (
                      <li key={s.key}>
                        <SettingCard setting={s} editable={manage} onPropose={(value) => setPending({ setting: s, value })} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          );
        }}
      </ApiView>

      {pending && (
        <ConfirmDialog
          open
          title={`Change “${pending.setting.label}”?`}
          confirmLabel="Save change"
          reason="required"
          minReasonLength={3}
          onClose={() => setPending(null)}
          onConfirm={async (reason) => {
            try {
              await api(`/admin/settings/${encodeURIComponent(pending.setting.key)}`, { method: "PUT", body: { value: pending.value, reason } });
            } catch (e) {
              throw readableError(e);
            }
            setNotice(`“${pending.setting.label}” is now ${show(pending.value)}.`);
            refresh();
          }}
        >
          <ChangeSummary setting={pending.setting} value={pending.value} />
        </ConfirmDialog>
      )}
    </AdminPage>
  );
}

function ChangeSummary({ setting, value }: { setting: PlatformSetting; value: Value }) {
  const risk = RISK_NOTES[setting.key];
  return (
    <div className="space-y-2">
      <p>
        <span className="font-semibold">{show(setting.value)}</span> becomes <span className="font-semibold">{show(value)}</span>.
      </p>
      {risk && typeof value === "boolean" && <p>{value ? risk.turnOn : risk.turnOff}</p>}
      <p>The reason is saved in the audit log.</p>
    </div>
  );
}

function SettingCard({ setting, editable, onPropose }: { setting: PlatformSetting; editable: boolean; onPropose: (value: Value) => void }) {
  const id = useId();
  const risk = RISK_NOTES[setting.key];
  const labelId = `${id}-label`;
  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={labelId} className="font-bold text-ink">{setting.label}</h3>
          <p className="mt-1 text-sm text-ink-muted">{setting.description}</p>
        </div>
        <Badge tone={setting.isDefault ? "neutral" : "brand"}>{setting.isDefault ? "Default value" : "Changed from default"}</Badge>
      </div>
      <p className="text-sm text-ink-subtle"><span className="font-semibold">What it affects:</span> {setting.effect}</p>
      {risk && typeof setting.value === "boolean" && (
        <p className="rounded-control bg-warning-soft px-3 py-2 text-sm text-ink">{setting.value ? risk.nowOn : risk.nowOff}</p>
      )}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <p className="text-xs font-semibold text-ink-subtle">Current value</p>
          {editable ? <Control id={id} labelId={labelId} setting={setting} onPropose={onPropose} /> : <p className="mt-1 font-semibold">{show(setting.value)}</p>}
        </div>
        <div>
          <p className="text-xs font-semibold text-ink-subtle">Default</p>
          <p className="mt-1">{show(setting.default)}</p>
        </div>
        {setting.updatedAt && (
          <div>
            <p className="text-xs font-semibold text-ink-subtle">Last changed</p>
            <p className="mt-1 text-sm">{formatDateTime(setting.updatedAt)}</p>
          </div>
        )}
      </div>
    </Card>
  );
}

function Control({ id, labelId, setting, onPropose }: { id: string; labelId: string; setting: PlatformSetting; onPropose: (value: Value) => void }) {
  const [draft, setDraft] = useState(String(setting.value));
  const [error, setError] = useState<string>();

  if (setting.type === "boolean") {
    const on = setting.value === true;
    return (
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-labelledby={labelId}
        onClick={() => onPropose(!on)}
        className="mt-1 inline-flex min-h-11 items-center gap-3 rounded-control pr-2 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span aria-hidden className={cn("relative h-7 w-12 rounded-full transition-colors", on ? "bg-brand-700" : "bg-line-strong")}>
          <span className={cn("absolute top-0.5 size-6 rounded-full bg-white shadow transition-all", on ? "left-[1.4rem]" : "left-0.5")} />
        </span>
        <span className="text-sm font-semibold">{on ? "On" : "Off"}</span>
      </button>
    );
  }

  const changed = draft !== String(setting.value);
  function propose() {
    if (setting.type === "number") {
      const n = Number(draft);
      if (draft.trim() === "" || !Number.isFinite(n) || !Number.isInteger(n)) return setError("Enter a whole number.");
      setError(undefined);
      return onPropose(n);
    }
    setError(undefined);
    onPropose(draft.trim());
  }
  return (
    <div className="mt-1 flex flex-wrap items-start gap-2">
      <TextInput
        id={`${id}-input`}
        label={setting.label}
        hideLabel
        type={setting.type === "number" ? "number" : "text"}
        inputMode={setting.type === "number" ? "numeric" : undefined}
        step={setting.type === "number" ? 1 : undefined}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        error={error}
        className="w-64 max-w-full"
        maxLength={setting.type === "string" ? 200 : undefined}
      />
      <Button onClick={propose} disabled={!changed}>Review change</Button>
    </div>
  );
}
