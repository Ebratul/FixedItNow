"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminPage, ApiView, StatCard, StatGrid } from "@/components/admin/kit";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { DocumentList } from "./document-list";
import { DocumentEditor } from "./document-editor";
import type { AiStatus, SyncResult } from "./ai-types";

type Screen = { kind: "list" } | { kind: "new" } | { kind: "edit"; id: string };

export function AiAdminView() {
  return (
    <AdminPage title="AI assistant" description="The assistant answers questions from the published knowledge documents below. It quotes this text to users, so only publish what is true and approved." permission="ai.read">
      <Body />
    </AdminPage>
  );
}

function Body() {
  const [screen, setScreen] = useState<Screen>({ kind: "list" });
  const { state, reload, refresh } = useApi<AiStatus>("/admin/ai/status");
  return (
    <>
      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-56" />}>
        {(status) => <StatusCard status={status} onSynced={refresh} />}
      </ApiView>
      {screen.kind === "list" ? (
        <DocumentList onOpen={(id) => setScreen({ kind: "edit", id })} onNew={() => setScreen({ kind: "new" })} />
      ) : (
        <DocumentEditor
          id={screen.kind === "edit" ? screen.id : null}
          onBack={() => setScreen({ kind: "list" })}
          onCreated={(id) => setScreen({ kind: "edit", id })}
        />
      )}
    </>
  );
}

function StatusCard({ status, onSynced }: { status: AiStatus; onSynced: () => void }) {
  const { can } = useAdmin();
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<SyncResult>();
  const { service, knowledge } = status;
  const running = knowledge.running;

  const serviceText = !service.configured ? "Not configured" : service.reachable ? "Reachable" : "Not answering";
  const sync = (() => {
    if (!service.configured) return { tone: "neutral" as const, label: "Cannot tell", text: "The AI service is not configured in this environment, so nothing is being served." };
    if (!running) return { tone: "warning" as const, label: "Unknown", text: "The AI service did not report what knowledge it is using, so we cannot tell whether it matches the published documents." };
    if (knowledge.inSync) return { tone: "success" as const, label: "In sync", text: "The assistant is using exactly the currently published documents." };
    if (running.source === "files") return { tone: "warning" as const, label: "Not connected to documents", text: "The AI service is reading bundled files, so published documents do not reach it, whatever you publish or sync here. It has to be configured to read knowledge from this app (AI_KNOWLEDGE_SOURCE=api)." };
    return { tone: "warning" as const, label: "Out of sync", text: "The assistant is using different content from what is published now. Use “Sync now” to make it use the published documents." };
  })();

  return (
    <section aria-label="AI service status" className="space-y-4">
      <h2 className="text-lg font-bold text-ink">Status</h2>
      <StatGrid>
        <StatCard label="AI service" value={serviceText} hint={service.configured ? (service.reachable ? `Language model: ${service.llm ?? "unknown"}` : "Configured but did not answer just now") : "No service address is set"} />
        <StatCard label="Assistant for users" value={service.assistantEnabled ? "On" : "Off"} hint={<Link className="font-semibold text-brand-800 underline" href="/admin/settings">Change in settings</Link>} />
        <StatCard label="Published documents" value={knowledge.published} />
        <StatCard label="Drafts / archived" value={`${knowledge.draft} / ${knowledge.archived}`} />
      </StatGrid>
      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-ink">Is the running assistant up to date?</h3>
          <Badge tone={sync.tone}>{sync.label}</Badge>
        </div>
        <p className="text-sm text-ink-muted">{sync.text}</p>
        {running && (
          <p className="text-sm text-ink-muted">
            Running index: {running.documents} {running.documents === 1 ? "document" : "documents"}, {running.chunks} sections, source “{running.source}”{running.configuredSource !== running.source ? ` (configured: ${running.configuredSource})` : ""}.
          </p>
        )}
        <p className="text-sm text-ink-muted" data-testid="last-sync">
          {knowledge.lastSync
            ? `Last sync ${knowledge.lastSync.ok ? "succeeded" : "failed"} on ${formatDateTime(knowledge.lastSync.at)} by ${knowledge.lastSync.by}${syncDetail(knowledge.lastSync.detail)}.`
            : "No sync has been run from this panel yet."}
        </p>
        {result && <SyncOutcome result={result} />}
        {can("ai.manage") && (
          <div>
            <Button variant="secondary" onClick={() => setConfirm(true)} disabled={!service.configured}>Sync now</Button>
            {!service.configured && <p className="mt-2 text-sm text-ink-subtle">Syncing needs the AI service to be configured.</p>}
          </div>
        )}
      </Card>
      <ConfirmDialog
        open={confirm}
        title="Sync the assistant now?"
        confirmLabel="Sync now"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          const r = await api<SyncResult>("/admin/ai/sync", { method: "POST", body: { confirm: true } });
          setResult(r);
          onSynced();
        }}
      >
        This makes the running assistant rebuild its knowledge from the documents that are published now. It changes the answers users get immediately. Drafts and archived documents are not included.
      </ConfirmDialog>
    </section>
  );
}

function syncDetail(detail: unknown): string {
  if (!detail || typeof detail !== "object") return "";
  const d = detail as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof d.documents === "number") parts.push(`${d.documents} documents`);
  if (typeof d.chunks === "number") parts.push(`${d.chunks} sections`);
  if (typeof d.source === "string") parts.push(`source ${d.source}`);
  if (typeof d.reason === "string") parts.push(`reason: ${d.reason}`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

function SyncOutcome({ result }: { result: SyncResult }) {
  if (result.hint) return <Alert tone="warning" title="The AI service was refreshed, but not from your documents">{result.hint}</Alert>;
  if (!result.inSync) return <Alert tone="warning" title="Synced, but the content does not match">The AI service rebuilt {result.documents} documents ({result.chunks} sections) but they do not match what is published now. Something may have changed during the sync: try again.</Alert>;
  return <Alert tone="success" title="Sync finished">The assistant now uses {result.documents} published {result.documents === 1 ? "document" : "documents"} ({result.chunks} sections).</Alert>;
}
