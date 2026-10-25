"use client";

import { AlertTriangle, CheckCircle2, CircleSlash, FlaskConical, Radio, RefreshCw, XCircle, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminPage, ApiView, StatCard, StatGrid } from "@/components/admin/kit";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import { api } from "@/lib/api";
import type { ApiState } from "@/lib/use-api";

type IntegrationState = "ok" | "degraded" | "down" | "not_configured" | "sandbox" | "live" | "off";
type Integration = { id: string; label: string; status: IntegrationState; detail: string; probed: boolean };
export type OpsStatus = {
  database: string;
  databaseLatencyMs: number;
  integrations: Integration[];
  queues: {
    paymentsRequiringReview: number;
    paymentsUnresolvedOver30Minutes: number;
    refundsAwaitingProvider: number;
    refundsAwaitingDecision: number;
    disputesOpen: number;
    reportsOpen: number;
    ticketsOpen: number;
    ticketsUnassigned: number;
  };
  audit: { headSeq: number; lastEntryAt: string | null };
  platform: { maintenanceMode: boolean };
  runtime: { environment: string; node: string; uptimeSeconds: number };
};

/** Words are deliberately careful: "configured" is never presented as "working". */
export function describeIntegration(i: Pick<Integration, "status" | "probed">): { label: string; tone: BadgeTone; icon: LucideIcon } {
  switch (i.status) {
    case "ok": return i.probed ? { label: "Working", tone: "success", icon: CheckCircle2 } : { label: "Configured (not tested)", tone: "neutral", icon: CheckCircle2 };
    case "degraded": return { label: "Degraded", tone: "warning", icon: AlertTriangle };
    case "down": return { label: "Down", tone: "danger", icon: XCircle };
    case "not_configured": return { label: "Not configured", tone: "neutral", icon: CircleSlash };
    case "sandbox": return { label: "Sandbox mode (test money)", tone: "warning", icon: FlaskConical };
    case "live": return { label: "Live mode", tone: "brand", icon: Radio };
    case "off": return { label: "Off", tone: "neutral", icon: CircleSlash };
    default: return { label: String(i.status), tone: "neutral", icon: CircleSlash };
  }
}

export function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const d = Math.floor(seconds / 86_400);
  const h = Math.floor((seconds % 86_400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d && `${d} d`, (d || h) && `${h} h`, `${m} min`].filter(Boolean).join(" ");
}

export function SystemView() {
  return (
    <AdminPage title="Operations" description="Whether the platform's dependencies are working and what is waiting for a person. Numbers are read when you open or refresh this page." permission="ops.read">
      <Body />
    </AdminPage>
  );
}

type Loaded = { status: "loading" } | { status: "ready"; data: OpsStatus; at: Date; round: number } | { status: "error"; message: string; round: number };

function Body() {
  // `asked` counts refresh requests; `loaded.round` is the request the shown result belongs to, so "refreshing"
  // is simply asked > round (no effect needed to keep a flag in step).
  const [asked, setAsked] = useState(0);
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  useEffect(() => {
    let cancelled = false;
    api<OpsStatus>("/admin/ops/status")
      .then((data) => { if (!cancelled) setLoaded({ status: "ready", data, at: new Date(), round: asked }); })
      .catch((e: unknown) => { if (!cancelled) setLoaded({ status: "error", message: e instanceof Error ? e.message : "Something went wrong.", round: asked }); });
    return () => { cancelled = true; };
  }, [asked]);
  const refreshing = loaded.status !== "loading" && asked > loaded.round;
  const state: ApiState<OpsStatus> = loaded.status === "ready" ? { status: "ready", data: loaded.data } : loaded.status === "error" ? { status: "error", message: loaded.message } : { status: "loading" };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => setAsked((n) => n + 1)} loading={refreshing}>
          <RefreshCw className="size-4" aria-hidden /> Refresh
        </Button>
        <p className="text-sm text-ink-muted" aria-live="polite">{loaded.status === "ready" ? `Last updated ${formatDateTime(loaded.at)}` : loaded.status === "error" ? "Could not update" : "Loading…"}</p>
      </div>
      <ApiView state={state} reload={() => { setLoaded({ status: "loading" }); setAsked((n) => n + 1); }} skeleton={<Skeleton className="h-64" />}>
        {(s) => <Ready status={s} />}
      </ApiView>
    </>
  );
}

function Ready({ status }: { status: OpsStatus }) {
  const { can } = useAdmin();
  const q = status.queues;
  // [label, value, page, permission that opens that page]
  const queues: [string, number, string, string][] = [
    ["Payments needing review", q.paymentsRequiringReview, "/admin/payments", "payments.read"],
    ["Payments unresolved over 30 min", q.paymentsUnresolvedOver30Minutes, "/admin/payments", "payments.read"],
    ["Refunds awaiting a decision", q.refundsAwaitingDecision, "/admin/payments", "payments.read"],
    ["Refunds awaiting the provider", q.refundsAwaitingProvider, "/admin/payments", "payments.read"],
    ["Open disputes", q.disputesOpen, "/admin/disputes", "disputes.read"],
    ["Open content reports", q.reportsOpen, "/admin/moderation", "moderation.read"],
    ["Support tickets open or in progress", q.ticketsOpen, "/admin/support", "support.read"],
    ["Unassigned new tickets", q.ticketsUnassigned, "/admin/support", "support.read"],
  ];
  return (
    <>
      <section aria-label="Integrations" className="space-y-3">
        <h2 className="text-lg font-bold text-ink">Dependencies</h2>
        <p className="text-sm text-ink-muted">
          “Checked now” means this page just tested the dependency. “Configuration only” means the settings are present on the server; it does not prove the provider account accepts them.
        </p>
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {status.integrations.map((i) => {
            const d = describeIntegration(i);
            return (
              <li key={i.id}>
                <Card className="h-full space-y-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-bold text-ink">{i.label}</h3>
                    <Badge tone={d.tone}><d.icon className="size-3.5" aria-hidden />{d.label}</Badge>
                  </div>
                  <p className="text-sm text-ink-muted break-words">{i.detail}</p>
                  <p className="text-xs font-semibold text-ink-subtle">{i.probed ? "Checked now" : "Configuration only"}</p>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="Work queues" className="space-y-3">
        <h2 className="text-lg font-bold text-ink">Waiting for a person</h2>
        <StatGrid>
          {queues.map(([label, value, href, permission]) => (
            <StatCard key={label} label={label} value={value} href={can(permission) ? href : undefined} />
          ))}
        </StatGrid>
      </section>

      <section aria-label="Platform" className="space-y-3">
        <h2 className="text-lg font-bold text-ink">Platform</h2>
        <StatGrid>
          <StatCard label="Database answered in" value={`${status.databaseLatencyMs} ms`} hint={status.database === "ok" ? "Measured with a trivial query just now" : status.database} />
          <StatCard
            label="Maintenance mode"
            value={status.platform.maintenanceMode ? "On" : "Off"}
            hint={<>{status.platform.maintenanceMode ? "Users cannot make changes. " : ""}{can("settings.read") ? <Link className="font-semibold text-brand-800 underline" href="/admin/settings">Open settings</Link> : null}</>}
          />
          <StatCard
            label="Audit log"
            value={`#${status.audit.headSeq}`}
            hint={status.audit.lastEntryAt ? `Latest entry ${formatDateTime(status.audit.lastEntryAt)}` : "No entries yet"}
            href={can("audit.read") ? "/admin/audit" : undefined}
          />
          <StatCard label="Runtime" value={status.runtime.environment} hint={`Node ${status.runtime.node} · up ${formatUptime(status.runtime.uptimeSeconds)}`} />
        </StatGrid>
      </section>
    </>
  );
}
