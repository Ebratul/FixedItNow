"use client";

import { Megaphone, Plus } from "lucide-react";
import { useState } from "react";
import { AdminPage, ApiView, buildQuery, DataTable, StatusBadge, type Column } from "@/components/admin/kit";
import { Pager } from "@/components/community/community-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectInput } from "@/components/ui/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { AnnouncementForm } from "./announcement-form";
import {
  AUDIENCE_LABEL, AUDIENCE_SENTENCE, EMPTY_VALUES, SEVERITY_LABEL, SEVERITY_TONE, STATUS_MAP, valuesOf, windowText,
  type AdminAnnouncement, type AnnouncementList,
} from "./announcement-utils";
import { SendNotificationPanel } from "./send-notification-panel";

type Editor = { mode: "create" } | { mode: "edit"; item: AdminAnnouncement };
type Pending = { kind: "publish" | "archive"; item: AdminAnnouncement; scheduled: boolean };

export function AnnouncementsView() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [notice, setNotice] = useState<string>();
  const { state, reload, refresh, stale } = useApi<AnnouncementList>(`/admin/announcements${buildQuery({ status, page, pageSize: 20 })}`);

  const columns: Column<AdminAnnouncement>[] = [
    {
      key: "title", header: "Announcement",
      cell: (a) => (
        <div className="min-w-0">
          <p className="break-words">{a.title}</p>
          <p className="mt-0.5 text-xs font-normal text-ink-subtle">By {a.createdBy}, {formatDateTime(a.createdAt)}</p>
        </div>
      ),
    },
    { key: "audience", header: "Audience", cell: (a) => AUDIENCE_LABEL[a.audience] ?? a.audience },
    { key: "severity", header: "Severity", cell: (a) => <Badge tone={SEVERITY_TONE[a.severity] ?? "neutral"}>{SEVERITY_LABEL[a.severity] ?? a.severity}</Badge> },
    {
      key: "status", header: "Status",
      cell: (a) => (
        <div className="flex flex-col items-start gap-1">
          <StatusBadge value={a.status} map={STATUS_MAP} />
          {a.live ? <Badge tone="success">Live now</Badge> : a.status === "PUBLISHED" ? <span className="text-xs text-ink-subtle">Not live (outside its window)</span> : null}
        </div>
      ),
    },
    { key: "window", header: "Window (Bangladesh time)", hideBelow: "md", cell: (a) => <span className="text-xs">{windowText(a)}</span> },
    {
      key: "actions", header: "Actions",
      cell: (a) => (
        <div className="flex flex-wrap gap-2">
          {a.status !== "ARCHIVED" && <Button variant="secondary" size="sm" onClick={() => { setNotice(undefined); setEditor({ mode: "edit", item: a }); }} aria-label={`Edit ${a.title}`}>Edit</Button>}
          {a.status === "DRAFT" && <Button size="sm" onClick={() => setPending({ kind: "publish", item: a, scheduled: Boolean(a.startsAt && new Date(a.startsAt).getTime() > Date.now()) })} aria-label={`Publish ${a.title}`}>Publish</Button>}
          {a.status !== "ARCHIVED" && <Button variant="ghost" size="sm" onClick={() => setPending({ kind: "archive", item: a, scheduled: false })} aria-label={`Archive ${a.title}`}>Archive</Button>}
        </div>
      ),
    },
  ];

  async function confirmPending() {
    if (!pending) return;
    const { kind, item } = pending;
    await api(`/admin/announcements/${item.id}/${kind}`, { method: "POST", body: kind === "publish" ? { confirm: true } : {} });
    setNotice(kind === "publish" ? `“${item.title}” is published.` : `“${item.title}” is archived.`);
    refresh();
  }

  return (
    <AdminPage
      title="Announcements"
      description="Banners shown to visitors and signed-in users, and one-to-one notifications. Publishing reaches real people immediately."
      permission="notifications.manage"
      actions={!editor && <Button onClick={() => { setNotice(undefined); setEditor({ mode: "create" }); }}><Plus className="size-4" aria-hidden /> New announcement</Button>}
    >
      <div aria-live="polite">{notice && <Alert tone="success">{notice}</Alert>}</div>

      {editor && (
        <Card className="p-5">
          <h2 className="text-lg font-bold">{editor.mode === "create" ? "New announcement" : "Edit announcement"}</h2>
          <div className="mt-4">
            <AnnouncementForm
              key={editor.mode === "edit" ? editor.item.id : "new"}
              initial={editor.mode === "edit" ? valuesOf(editor.item) : EMPTY_VALUES}
              editing={editor.mode === "edit" ? editor.item : undefined}
              onCancel={() => setEditor(null)}
              onSaved={(message) => { setEditor(null); setNotice(message); refresh(); }}
            />
          </div>
        </Card>
      )}

      <section aria-labelledby="announcement-list" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="announcement-list" className="text-lg font-bold">All announcements</h2>
          <SelectInput
            id="announcement-status" label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            placeholder="All statuses" options={[{ value: "DRAFT", label: "Draft" }, { value: "PUBLISHED", label: "Published" }, { value: "ARCHIVED", label: "Archived" }]}
            className="sm:w-48"
          />
        </div>
        <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-56" />}>
          {(data) =>
            data.announcements.length === 0 ? (
              <EmptyState icon={Megaphone} headingLevel={3} title={status ? "No announcements with this status" : "No announcements yet"}>
                {status ? "Try another status." : "Create a draft, review it, then publish it to show it to your users."}
              </EmptyState>
            ) : (
              <>
                <p className="text-sm text-ink-muted">{data.total} {data.total === 1 ? "announcement" : "announcements"}</p>
                <DataTable caption="Announcements" columns={columns} rows={data.announcements} rowKey={(a) => a.id} busy={stale} />
                <Pager page={data.page} totalPages={data.totalPages} onPage={setPage} label="Announcement pages" />
              </>
            )
          }
        </ApiView>
      </section>

      <SendNotificationPanel />

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === "publish" ? "Publish this announcement?" : "Archive this announcement?"}
        confirmLabel={pending?.kind === "publish" ? "Publish now" : "Archive"}
        tone={pending?.kind === "archive" ? "danger" : "primary"}
        onConfirm={confirmPending}
        onClose={() => setPending(null)}
      >
        {pending && (pending.kind === "publish" ? <PublishSummary item={pending.item} future={pending.scheduled} /> : (
          <p>“{pending.item.title}” will stop showing to users. An archived announcement cannot be edited or published again.</p>
        ))}
      </ConfirmDialog>
    </AdminPage>
  );
}

function PublishSummary({ item, future }: { item: AdminAnnouncement; future: boolean }) {
  return (
    <div className="space-y-2">
      <p>
        “{item.title}” ({SEVERITY_LABEL[item.severity].toLowerCase()}) will be shown to <strong>{AUDIENCE_SENTENCE[item.audience]}</strong>.
      </p>
      <p>
        {future ? <>It becomes visible <strong>{formatDateTime(item.startsAt!)}</strong> (Bangladesh time)</> : <>It becomes visible <strong>immediately</strong></>}
        {item.endsAt ? <>, and stops <strong>{formatDateTime(item.endsAt)}</strong>.</> : <>, and stays until you archive it.</>}
      </p>
    </div>
  );
}
