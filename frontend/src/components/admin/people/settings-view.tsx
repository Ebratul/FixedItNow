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

/** The three demo roles, in the order they are listed. The keys are `demo.<role>.visible` and `demo.<role>.enabled`. */
const DEMO_ROLES = [
  { role: "customer", label: "Demo Customer", extraOn: "Visitors will be able to explore the customer side with fictional data and simulated payments." },
  { role: "worker", label: "Demo Worker", extraOn: "Visitors will be able to explore the professional side with fictional data." },
  { role: "admin", label: "Demo Admin", extraOn: "Visitors will be able to open a read-only view of the admin panel, with fictional data only." },
] as const;

const demoRiskNotes = Object.fromEntries(
  DEMO_ROLES.flatMap(({ role, label, extraOn }) => [
    [
      `demo.${role}.visible`,
      {
        nowOn: `${label} is listed on the public login page.`,
        nowOff: `${label} is not listed on the login page.`,
        turnOn: `Turning ON lists ${label} on the public login page for every visitor.`,
        turnOff: `Turning OFF removes ${label} from the login page. It does not end sessions or block new ones: if “Allow new demo sessions” is on, people who have the direct link can still start one.`,
      },
    ],
    [
      `demo.${role}.enabled`,
      {
        nowOn: `${label} accepts new demo sessions.`,
        nowOff: `${label} refuses new demo sessions, whether or not it is visible.`,
        turnOn: `Turning ON lets the backend start new ${label} sessions (from the login page if it is visible, or from the direct link). ${extraOn}`,
        turnOff: `Turning OFF refuses every new ${label} session AND signs out everyone who is using ${label} right now, immediately.`,
      },
    ],
  ]),
) as Record<string, { nowOn: string; nowOff: string; turnOn: string; turnOff: string }>;

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
  ...demoRiskNotes,
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
          const demo = settings.filter((s) => s.key.startsWith("demo."));
          const rest = settings.filter((s) => !s.key.startsWith("demo."));
          const groups = [...new Set(rest.map((s) => s.group))];
          return (
            <div className="space-y-8">
              {demo.length > 0 && <DemoAccessSettings settings={demo} editable={manage} onPropose={(setting, value) => setPending({ setting, value })} />}
              {groups.map((group) => (
                <section key={group} aria-labelledby={`group-${group}`} className="space-y-3">
                  <h2 id={`group-${group}`} className="text-lg font-bold text-brand-950">{group}</h2>
                  <ul className="space-y-3">
                    {rest.filter((s) => s.group === group).map((s) => (
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
          tone={pending.setting.key.startsWith("demo.") && pending.setting.key.endsWith(".enabled") && pending.value === false ? "danger" : "primary"}
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

/**
 * The demo log-in options, in ONE place (not in the generic group list), because the two switches of a role only
 * make sense together: "visible" is about the public login page, "enabled" is about whether the backend starts sessions.
 * A switch always shows the last value the server reported; it moves only after a saved change is reloaded.
 */
function DemoAccessSettings({ settings, editable, onPropose }: { settings: PlatformSetting[]; editable: boolean; onPropose: (setting: PlatformSetting, value: Value) => void }) {
  const byKey = new Map(settings.map((s) => [s.key, s]));
  return (
    <section aria-labelledby="demo-access-heading" className="space-y-3">
      <h2 id="demo-access-heading" className="text-lg font-bold text-brand-950">Demo Access Settings</h2>
      <p className="text-sm text-ink-muted">
        “Visible” controls whether the option is listed on the public login page. “Allow new demo sessions” controls whether the backend starts new sessions. A hidden option can stay enabled (reachable only by a direct link); a disabled option is refused whether or not it is visible. Turning “allow” off also signs out open sessions of that role. Demo Admin is read-only and only ever shows fictional data.
      </p>
      <ul className="grid gap-3 lg:grid-cols-3">
        {DEMO_ROLES.map(({ role, label }) => {
          const visible = byKey.get(`demo.${role}.visible`);
          const enabled = byKey.get(`demo.${role}.enabled`);
          if (!visible && !enabled) return null;
          return (
            <li key={role}>
              <DemoRoleCard role={role} label={label} visible={visible} enabled={enabled} editable={editable} onPropose={onPropose} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DemoRoleCard({ role, label, visible, enabled, editable, onPropose }: { role: string; label: string; visible?: PlatformSetting; enabled?: PlatformSetting; editable: boolean; onPropose: (setting: PlatformSetting, value: Value) => void }) {
  const id = useId();
  const headingId = `${id}-heading`;
  const state = [
    visible ? (visible.value === true ? "Visible on login page" : "Hidden from login page") : null,
    enabled ? (enabled.value === true ? "Accepting new sessions" : "Not accepting new sessions") : null,
  ].filter(Boolean).join(" · ");
  const rows = [
    { setting: visible, name: "Visible on login page" },
    { setting: enabled, name: "Allow new demo sessions" },
  ];
  return (
    <Card className="flex h-full flex-col gap-4 p-5">
      <div>
        <h3 id={headingId} className="font-bold text-ink">{label}</h3>
        <p className="mt-1 text-sm font-semibold text-ink-muted">{state}</p>
      </div>
      {role === "admin" && (
        <Alert tone="warning" title="Privileged, but read-only">
          Demo Admin opens the admin panel. It cannot change anything, and it only ever shows fictional data. Allow it only if you want visitors to see the admin panel.
        </Alert>
      )}
      <div className="space-y-3">
        {rows.map(({ setting, name }) => {
          if (!setting) return null;
          const nameId = `${id}-${setting.key}-name`;
          return (
            <div key={setting.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <p id={nameId} className="text-sm font-semibold">{name}</p>
                <p className="text-xs text-ink-subtle">{setting.description}</p>
              </div>
              {editable ? (
                <Control id={`${id}-${setting.key}`} labelId={`${headingId} ${nameId}`} setting={setting} onPropose={(value) => onPropose(setting, value)} />
              ) : (
                <p className="font-semibold">{show(setting.value)}</p>
              )}
            </div>
          );
        })}
      </div>
    </Card>
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
