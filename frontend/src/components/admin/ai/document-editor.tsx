"use client";

import { ArrowLeft } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { ApiView, StatusBadge } from "@/components/admin/kit";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TextArea } from "@/components/ui/text-area";
import { TextInput } from "@/components/ui/text-input";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { BODY_MAX, BODY_MIN, KNOWLEDGE_STATUS, type KnowledgeDocument, type KnowledgeStatus } from "./ai-types";

const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const URL_PATH = /^\/[a-z0-9/-]{0,99}$/;

function BodyHelp() {
  return (
    <p className="text-sm text-ink-muted">
      The text is split into sections at every line that starts with <code className="rounded bg-surface-strong px-1"># </code> (a heading). The assistant quotes this text to users, so write only what is true and approved, and keep each section about one topic.
    </p>
  );
}

function Counter({ length }: { length: number }) {
  const bad = length > 0 && (length < BODY_MIN || length > BODY_MAX);
  return (
    <span className={bad ? "font-semibold text-danger" : undefined}>
      {length.toLocaleString("en")} / {BODY_MAX.toLocaleString("en")} characters (at least {BODY_MIN})
    </span>
  );
}

const bodyClass = "min-h-72 font-mono text-sm";

/** Create (id === null) or view/edit one knowledge document. */
export function DocumentEditor({ id, onBack, onCreated }: { id: string | null; onBack: () => void; onCreated: (id: string) => void }) {
  return (
    <section aria-label={id ? "Knowledge document" : "New knowledge document"} className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="size-4" aria-hidden /> All documents</Button>
      {id ? <Existing id={id} /> : <Create onCreated={onCreated} />}
    </section>
  );
}

function Create({ onCreated }: { onCreated: (id: string) => void }) {
  const { can } = useAdmin();
  const uid = useId();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("/help");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);

  if (!can("ai.manage")) return <Alert tone="warning">Your role can read knowledge documents but not create them.</Alert>;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!SLUG.test(slug)) found.slug = "Use lowercase letters, digits and hyphens (up to 40 characters).";
    if (title.trim().length < 3 || title.trim().length > 120) found.title = "Use 3 to 120 characters.";
    if (!URL_PATH.test(url)) found.url = "Use an in-app path such as /help.";
    if (body.trim().length < BODY_MIN || body.trim().length > BODY_MAX) found.body = `Use ${BODY_MIN} to ${BODY_MAX.toLocaleString("en")} characters.`;
    setErrors(found);
    setFormError(undefined);
    if (Object.keys(found).length > 0) return;
    setPending(true);
    try {
      const res = await api<{ document: { id: string } }>("/admin/ai/knowledge", { method: "POST", body: { slug, title: title.trim(), url, body: body.trim() } });
      onCreated(res.document.id);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      setFormError(error instanceof Error ? error.message : "Something went wrong.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl space-y-4" aria-label="New knowledge document">
      <h2 className="text-lg font-bold text-ink">New document</h2>
      <Alert tone="info">New documents start as drafts. A draft never reaches the assistant until you publish it and sync.</Alert>
      <TextInput id={`${uid}-slug`} label="Slug" hint="A short unique name: lowercase letters, digits and hyphens. It cannot be changed later." value={slug} error={errors.slug} onChange={(e) => setSlug(e.target.value)} maxLength={40} autoComplete="off" />
      <TextInput id={`${uid}-title`} label="Title" value={title} error={errors.title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      <TextInput id={`${uid}-url`} label="In-app page this answer points to" hint="A path inside the app, such as /help or /about. The assistant links users here." value={url} error={errors.url} onChange={(e) => setUrl(e.target.value)} maxLength={100} autoComplete="off" />
      <BodyHelp />
      <div>
        <TextArea id={`${uid}-body`} label="Text" value={body} error={errors.body} onChange={(e) => setBody(e.target.value)} className={bodyClass} />
        <p className="mt-1 text-xs text-ink-muted" aria-live="polite"><Counter length={body.trim().length} /></p>
      </div>
      {formError && <Alert tone="error">{formError}</Alert>}
      <Button type="submit" loading={pending}>Create draft</Button>
    </form>
  );
}

function Existing({ id }: { id: string }) {
  const { state, reload, refresh } = useApi<{ document: KnowledgeDocument }>(`/admin/ai/knowledge/${id}`);
  return (
    <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-96" />}>
      {({ document }) => <EditForm key={document.version} doc={document} onChanged={refresh} />}
    </ApiView>
  );
}

function EditForm({ doc, onChanged }: { doc: KnowledgeDocument; onChanged: () => void }) {
  const { can } = useAdmin();
  const manage = can("ai.manage");
  const uid = useId();
  const [title, setTitle] = useState(doc.title);
  const [url, setUrl] = useState(doc.url);
  const [body, setBody] = useState(doc.body);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const [next, setNext] = useState<KnowledgeStatus | null>(null);
  const [view, setView] = useState<number | null>(null);
  const [revert, setRevert] = useState<number | null>(null);

  const archived = doc.status === "ARCHIVED";
  const editable = manage && !archived;
  const dirty = title.trim() !== doc.title || url !== doc.url || body.trim() !== doc.body;

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editable || !dirty) return;
    const found: Record<string, string> = {};
    if (title.trim().length < 3 || title.trim().length > 120) found.title = "Use 3 to 120 characters.";
    if (!URL_PATH.test(url)) found.url = "Use an in-app path such as /help.";
    if (body.trim().length < BODY_MIN || body.trim().length > BODY_MAX) found.body = `Use ${BODY_MIN} to ${BODY_MAX.toLocaleString("en")} characters.`;
    setErrors(found);
    setFormError(undefined);
    setNotice(undefined);
    if (Object.keys(found).length > 0) return;
    setPending(true);
    try {
      await api(`/admin/ai/knowledge/${doc.id}`, {
        method: "PATCH",
        body: { ...(title.trim() !== doc.title && { title: title.trim() }), ...(url !== doc.url && { url }), ...(body.trim() !== doc.body && { body: body.trim() }) },
      });
      onChanged(); // the new version remounts this form with the saved values
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) setErrors(error.fieldErrors);
      setFormError(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  const actionLabel = (to: KnowledgeStatus) =>
    to === "PUBLISHED" ? "Publish…" : to === "ARCHIVED" ? "Archive…" : doc.status === "ARCHIVED" ? "Restore to draft…" : "Unpublish (back to draft)…";

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-lg font-bold break-words text-ink">{doc.title}</h2>
        <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <StatusBadge value={doc.status} map={KNOWLEDGE_STATUS} />
          <code className="text-xs">{doc.slug}</code>
          <span>Version {doc.version}</span>
          <span>· Updated {formatDateTime(doc.updatedAt)}</span>
          {doc.publishedAt && <span>· Published {formatDateTime(doc.publishedAt)}</span>}
        </p>
      </header>
      {!manage && <Alert tone="info">Your role can read knowledge documents but not change them.</Alert>}
      {archived && manage && <Alert tone="info">This document is archived. Restore it to draft before editing it.</Alert>}
      {doc.status === "PUBLISHED" && manage && <Alert tone="warning">This document is published. Saving changes it for the assistant only after the next sync.</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <form onSubmit={save} noValidate className="max-w-3xl space-y-4" aria-label="Edit document">
        <TextInput id={`${uid}-slug`} label="Slug" value={doc.slug} readOnly hint="The slug cannot be changed." />
        <TextInput id={`${uid}-title`} label="Title" value={title} error={errors.title} onChange={(e) => setTitle(e.target.value)} maxLength={120} readOnly={!editable} />
        <TextInput id={`${uid}-url`} label="In-app page this answer points to" hint="A path inside the app, such as /help." value={url} error={errors.url} onChange={(e) => setUrl(e.target.value)} maxLength={100} readOnly={!editable} autoComplete="off" />
        <BodyHelp />
        <div>
          <TextArea id={`${uid}-body`} label="Text" value={body} error={errors.body} onChange={(e) => setBody(e.target.value)} className={bodyClass} readOnly={!editable} />
          <p className="mt-1 text-xs text-ink-muted" aria-live="polite"><Counter length={body.trim().length} /></p>
        </div>
        {formError && <Alert tone="error">{formError}</Alert>}
        {editable && <Button type="submit" loading={pending} disabled={!dirty}>Save changes</Button>}
      </form>

      {manage && doc.allowedNext.length > 0 && (
        <section aria-label="Status" className="space-y-3">
          <h3 className="font-bold text-ink">Change status</h3>
          <p className="text-sm text-ink-muted">Only published documents reach the assistant, and only after a sync.</p>
          {dirty && <p className="text-sm text-warning">Save or discard your edits first: a status change applies to the saved text.</p>}
          <div className="flex flex-wrap gap-2">
            {doc.allowedNext.map((to) => (
              <Button key={to} variant="secondary" onClick={() => setNext(to)} disabled={dirty}>{actionLabel(to)}</Button>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Revision history" className="space-y-3">
        <h3 className="font-bold text-ink">Revision history</h3>
        {doc.revisions.length === 0 ? (
          <p className="text-sm text-ink-muted">No revisions recorded.</p>
        ) : (
          <ul className="max-w-3xl divide-y divide-line rounded-card border border-line">
            {doc.revisions.map((r) => (
              <li key={r.version} className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-semibold break-words">Version {r.version}{r.version === doc.version ? " (current)" : ""}: {r.title}</p>
                  <p className="text-ink-subtle">{formatDateTime(r.createdAt)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setView(r.version)} aria-label={`View version ${r.version}`}>View</Button>
                  {editable && r.version !== doc.version && <Button size="sm" variant="ghost" onClick={() => setRevert(r.version)} aria-label={`Revert to version ${r.version}`}>Revert…</Button>}
                </div>
              </li>
            ))}
          </ul>
        )}
        {doc.revisions.length >= 30 && <p className="text-xs text-ink-subtle">Only the 30 most recent revisions are listed.</p>}
      </section>

      {next && (
        <ConfirmDialog
          open
          title={next === "PUBLISHED" ? `Publish “${doc.title}”?` : next === "ARCHIVED" ? `Archive “${doc.title}”?` : doc.status === "ARCHIVED" ? "Restore to draft?" : "Move back to draft?"}
          confirmLabel={next === "PUBLISHED" ? "Publish" : next === "ARCHIVED" ? "Archive" : "Move to draft"}
          tone={next === "ARCHIVED" ? "danger" : "primary"}
          onClose={() => setNext(null)}
          onConfirm={async () => {
            await api(`/admin/ai/knowledge/${doc.id}/status`, { method: "POST", body: next === "PUBLISHED" ? { status: next, confirm: true } : { status: next } });
            setNotice(next === "PUBLISHED" ? "Published. The assistant will use it after the next sync." : next === "ARCHIVED" ? "Archived." : "Moved to draft.");
            onChanged();
          }}
        >
          {next === "PUBLISHED"
            ? "Publishing makes this text something the assistant can quote to users. It can change live answers after the next sync. Check the text is correct and approved."
            : next === "ARCHIVED"
              ? "Archived documents are never used by the assistant. If it is published now, its text stays in the assistant until the next sync."
              : "A draft is not used by the assistant. If it was published, its text stays in the assistant until the next sync."}
        </ConfirmDialog>
      )}
      {revert !== null && (
        <ConfirmDialog
          open
          title={`Revert to version ${revert}?`}
          confirmLabel="Revert"
          onClose={() => setRevert(null)}
          onConfirm={async () => {
            await api(`/admin/ai/knowledge/${doc.id}/revert`, { method: "POST", body: { version: revert } });
            setNotice(`Reverted: the text of version ${revert} is now the newest version.`);
            onChanged();
          }}
        >
          The title and text of version {revert} become a new version. Nothing is lost: the current text stays in the history. {doc.status === "PUBLISHED" ? "The assistant picks it up at the next sync." : ""}
        </ConfirmDialog>
      )}
      {view !== null && <RevisionDialog docId={doc.id} version={view} onClose={() => setView(null)} />}
    </div>
  );
}

function RevisionDialog({ docId, version, onClose }: { docId: string; version: number; onClose: () => void }) {
  const { state, reload } = useApi<{ revision: { version: number; title: string; body: string; createdAt: string } }>(`/admin/ai/knowledge/${docId}/revisions/${version}`);
  return (
    <Dialog open onClose={onClose} title={`Version ${version}`} variant="modal">
      <div className="max-h-[75dvh] space-y-3 overflow-y-auto p-5">
        <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-40" />}>
          {({ revision }) => (
            <>
              <p className="text-sm text-ink-subtle">Saved {formatDateTime(revision.createdAt)}</p>
              <h3 className="font-bold break-words">{revision.title}</h3>
              <Card className="p-3"><pre className="font-mono text-xs whitespace-pre-wrap break-words">{revision.body}</pre></Card>
            </>
          )}
        </ApiView>
        <div className="flex justify-end"><Button variant="ghost" onClick={onClose}>Close</Button></div>
      </div>
    </Dialog>
  );
}
