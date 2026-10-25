"use client";

import { Inbox } from "lucide-react";
import { useId, useState } from "react";
import { AdminPage, buildQuery, useDebounced } from "@/components/admin/kit";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { Alert } from "@/components/ui/alert";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { SearchInput } from "@/components/ui/search-input";
import { SelectInput } from "@/components/ui/select-input";
import { Skeleton } from "@/components/ui/skeleton";
import { TextArea } from "@/components/ui/text-area";
import { api } from "@/lib/api";
import {
  AUDIT_LABELS,
  CONTENT_PATH,
  PROPOSAL_STATUS_LABELS,
  REASON_LABELS,
  type AdminProposal,
  type AdminProposalList,
  type AdminReportDetail,
  type AdminReportList,
  type AdminReportRow,
  type AuditList,
  type ModerationOverview,
  type ModerationTarget,
  type ProposalStatus,
  type ReportStatus,
} from "@/lib/community";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { Pager } from "@/components/community/community-shell";

const TABS = [
  { id: "reports", label: "Reports" },
  { id: "proposals", label: "Proposals" },
  { id: "content", label: "Content" },
  { id: "history", label: "History" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const STATUS_TONE: Record<ReportStatus, BadgeTone> = { OPEN: "warning", REVIEWING: "brand", ACTIONED: "success", DISMISSED: "neutral" };

/**
 * Administrator moderation console. This page only RENDERS what the server
 * returns: every call is authorised on the server (admin role re-read from the
 * database), so hiding this page or its buttons is convenience, not security.
 */
export function ModerationView() {
  return (
    <AdminPage
      title="Moderation"
      description="Review reports, decide feature proposals, browse community content, and see what moderators did. Every action is recorded."
      permission="moderation.read"
    >
      <Console />
    </AdminPage>
  );
}

function Console() {
  const [tab, setTab] = useState<Tab>("reports");
  return (
    <div className="space-y-6">
      <Overview />
      <div role="tablist" aria-label="Moderation sections" className="flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`-mb-px min-h-11 border-b-2 px-4 text-sm font-semibold ${tab === t.id ? "border-brand-700 text-brand-800" : "border-transparent text-ink-muted hover:text-ink"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "reports" && <Reports />}
        {tab === "proposals" && <Proposals />}
        {tab === "content" && <ContentBrowser />}
        {tab === "history" && <History />}
      </div>
    </div>
  );
}

function Overview() {
  const { state } = useApi<ModerationOverview>("/admin/moderation/overview");
  if (state.status !== "ready") return state.status === "error" ? <Alert tone="error">{state.message}</Alert> : <Skeleton className="h-24" />;
  const o = state.data;
  const stats: [string, number][] = [
    ["Open reports", o.reports.open],
    ["Being reviewed", o.reports.reviewing],
    ["Proposals awaiting review", o.proposals.submitted],
    [`Proposals with ${o.proposals.voteThreshold}+ votes`, o.proposals.needsReview],
    ["Hidden items", o.hidden.posts + o.hidden.comments + o.hidden.reviews + o.hidden.proposals],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {stats.map(([label, value]) => (
        <Card key={label} className="p-4">
          <dt className="text-xs text-ink-subtle">{label}</dt>
          <dd className="mt-1 text-2xl font-extrabold tabular-nums">{value}</dd>
        </Card>
      ))}
    </dl>
  );
}

// ------------------------------------------------------------------ reports

function Reports() {
  const [status, setStatus] = useState<ReportStatus>("OPEN");
  const [type, setType] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  // Shown at list level: after a decision the row usually leaves this filtered list and would take its own message with it.
  const [notice, setNotice] = useState<string>();
  const { state, reload } = useApi<AdminReportList>(`/admin/reports?status=${status}&page=${page}${type ? `&targetType=${type}` : ""}`);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <SelectInput id="report-status" label="Status" placeholder="Status" value={status} onChange={(e) => { setStatus((e.target.value || "OPEN") as ReportStatus); setPage(1); }}
          options={[{ value: "OPEN", label: "Open" }, { value: "REVIEWING", label: "Being reviewed" }, { value: "ACTIONED", label: "Actioned" }, { value: "DISMISSED", label: "Dismissed" }]} />
        <SelectInput id="report-type" label="Content type" placeholder="All types" value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}
          options={[{ value: "POST", label: "Posts" }, { value: "COMMENT", label: "Comments" }, { value: "REVIEW", label: "Reviews" }, { value: "PROPOSAL", label: "Proposals" }]} />
      </div>
      {notice && <Alert tone="success">{notice}</Alert>}
      {state.status === "loading" || state.status === "unauthenticated" ? (
        <Skeleton className="h-40" />
      ) : state.status === "error" ? (
        <ErrorState action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>
      ) : state.data.reports.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing here" headingLevel={3}>No reports match these filters.</EmptyState>
      ) : (
        <>
          <ul className="space-y-3">
            {state.data.reports.map((r) => (
              <li key={r.id}>
                <ReportRow row={r} expanded={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} onChanged={(message) => { setNotice(message); reload(); }} />
              </li>
            ))}
          </ul>
          <Pager page={state.data.page} totalPages={state.data.totalPages} onPage={setPage} label="Report pages" />
        </>
      )}
    </div>
  );
}

function TargetPreview({ target }: { target: ModerationTarget }) {
  return (
    <div className="rounded-control border border-line bg-surface p-3 text-sm">
      <p className="flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
        <Badge>{target.type.toLowerCase()}</Badge>
        <span>by {target.author}</span>
        <Badge tone={target.status === "VISIBLE" ? "success" : target.status === "HIDDEN" ? "warning" : "neutral"}>{target.status.toLowerCase()}</Badge>
        {typeof target.rating === "number" && <span>{target.rating}/5{target.worker ? ` for ${target.worker}` : ""}</span>}
      </p>
      {target.title && <p className="mt-1 font-semibold break-words">{target.title}</p>}
      <p className="mt-1 whitespace-pre-line break-words text-ink-muted">{target.text || <em>(no text)</em>}{target.truncated ? " (shortened)" : ""}</p>
    </div>
  );
}

function ReportRow({ row, expanded, onToggle, onChanged }: { row: AdminReportRow; expanded: boolean; onToggle: () => void; onChanged: (message: string) => void }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={STATUS_TONE[row.status]}>{row.status.toLowerCase()}</Badge>
          <span className="font-semibold">{REASON_LABELS[row.reason] ?? row.reason}</span>
          <span className="text-ink-subtle">{formatDateTime(row.createdAt)}</span>
          {row.reportsOnThisItem > 1 && <Badge tone="warning">{row.reportsOnThisItem} reports on this item</Badge>}
        </p>
        <Button variant="secondary" size="sm" aria-expanded={expanded} onClick={onToggle}>{expanded ? "Close" : "Open"}</Button>
      </div>
      <div className="mt-3"><TargetPreview target={row.target} /></div>
      {expanded && <ReportDetail id={row.id} onChanged={onChanged} />}
    </Card>
  );
}

function ReportDetail({ id, onChanged }: { id: string; onChanged: (message: string) => void }) {
  const manage = useAdmin().can("moderation.manage");
  const { state, reload } = useApi<AdminReportDetail>(`/admin/reports/${id}`);
  const [dialog, setDialog] = useState<"resolve" | "dismiss" | "hide" | "restore" | null>(null);
  const [error, setError] = useState<string>();
  if (state.status !== "ready") return <div className="mt-4">{state.status === "error" ? <Alert tone="error">{state.message}</Alert> : <Skeleton className="h-24" />}</div>;
  const { report, history } = state.data;
  const open = report.status === "OPEN" || report.status === "REVIEWING";
  const done = (message: string) => { reload(); onChanged(message); };

  async function startReview() {
    setError(undefined);
    try {
      await api(`/admin/reports/${id}/decision`, { method: "POST", body: { decision: "REVIEW" } });
      done("Report marked as being reviewed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  return (
    <div className="mt-4 space-y-4 border-t border-line pt-4">
      {error && <Alert tone="error">{error}</Alert>}
      <dl className="grid gap-2 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="font-semibold text-ink-muted">Reported by</dt><dd>{report.reporter.displayName}</dd>
        {report.details && (<><dt className="font-semibold text-ink-muted">Their note</dt><dd className="whitespace-pre-line break-words">{report.details}</dd></>)}
        {report.decisionNote && (<><dt className="font-semibold text-ink-muted">Decision note</dt><dd className="whitespace-pre-line">{report.decisionNote}{report.decidedBy ? ` — ${report.decidedBy}` : ""}</dd></>)}
        {report.otherReports.length > 0 && (<><dt className="font-semibold text-ink-muted">Other reports</dt><dd>{report.otherReports.map((o) => `${REASON_LABELS[o.reason] ?? o.reason} (${o.status.toLowerCase()})`).join(", ")}</dd></>)}
      </dl>
      {report.target.revisions && report.target.revisions.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Earlier versions of this review ({report.target.revisions.length})</summary>
          <ul className="mt-2 space-y-1">
            {report.target.revisions.map((r, i) => (
              <li key={i} className="text-ink-muted">{formatDateTime(r.createdAt)}: {r.rating}/5{r.comment ? ` — “${r.comment}”` : ""}</li>
            ))}
          </ul>
        </details>
      )}
      {history.length > 0 && (
        <div className="text-sm">
          <p className="font-semibold">Moderation history for this content</p>
          <ul className="mt-1 space-y-1 text-ink-muted">
            {history.map((h) => <li key={h.id}>{formatDateTime(h.createdAt)} · {AUDIT_LABELS[h.action] ?? h.action} · {h.actor ?? "system"}{h.metadata && typeof h.metadata.reason === "string" ? ` — “${h.metadata.reason}”` : ""}</li>)}
          </ul>
        </div>
      )}
      {open && manage ? (
        <div className="flex flex-wrap gap-3">
          {report.status === "OPEN" && <Button variant="secondary" size="sm" onClick={startReview}>Start reviewing</Button>}
          <Button size="sm" onClick={() => setDialog("resolve")}>Resolve…</Button>
          <Button variant="secondary" size="sm" onClick={() => setDialog("dismiss")}>Dismiss…</Button>
        </div>
      ) : open ? (
        <p className="text-sm text-ink-subtle">Your role can read reports but not decide them.</p>
      ) : (
        <p className="text-sm text-ink-subtle">This report is closed{report.resolvedAt ? ` (${formatDateTime(report.resolvedAt)})` : ""}.</p>
      )}
      {manage && report.target.status !== "DELETED" && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-ink-subtle">Content is {report.target.status.toLowerCase()}.</span>
          {report.target.status === "VISIBLE" ? (
            <Button variant="ghost" size="sm" onClick={() => setDialog("hide")}>Hide content…</Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setDialog("restore")}>Restore content…</Button>
          )}
        </div>
      )}

      <ResolveDialog
        open={dialog === "resolve"}
        status={report.target.status}
        onClose={() => setDialog(null)}
        onConfirm={async (note, contentAction) => {
          await api(`/admin/reports/${id}/decision`, { method: "POST", body: { decision: "RESOLVE", note, ...(contentAction && { contentAction }) } });
          done("Report resolved.");
        }}
      />
      <ConfirmDialog open={dialog === "dismiss"} title="Dismiss this report?" confirmLabel="Dismiss report" reason="required" minReasonLength={3} onClose={() => setDialog(null)}
        onConfirm={async (note) => { await api(`/admin/reports/${id}/decision`, { method: "POST", body: { decision: "DISMISS", note } }); done("Report dismissed. The content was not changed."); }}>
        Use this when the content does not break the rules. The content stays as it is, and your note is kept in the moderation history.
      </ConfirmDialog>
      {(dialog === "hide" || dialog === "restore") && (
        <ConfirmDialog open title={dialog === "hide" ? "Hide this content?" : "Restore this content?"} confirmLabel={dialog === "hide" ? "Hide content" : "Restore content"} tone={dialog === "hide" ? "danger" : "primary"} reason="required" minReasonLength={3}
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => { await api(`/admin/moderation/${CONTENT_PATH[report.target.type]}/${report.target.id}/visibility`, { method: "POST", body: { hidden: dialog === "hide", reason } }); done(dialog === "hide" ? "Content hidden." : "Content restored."); }}>
          {dialog === "hide" ? "It disappears for everyone except its author, who sees that it was removed. The text itself is not changed. You can restore it later." : "It becomes visible to everyone again."}
        </ConfirmDialog>
      )}
    </div>
  );
}

function ResolveDialog({ open, status, onClose, onConfirm }: { open: boolean; status: ModerationTarget["status"]; onClose: () => void; onConfirm: (note: string, action: "HIDE" | "RESTORE" | undefined) => Promise<void> }) {
  const id = useId();
  const [note, setNote] = useState("");
  const [action, setAction] = useState<"" | "HIDE" | "RESTORE">("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const short = note.trim().length < 3;

  async function go() {
    setPending(true);
    setError(undefined);
    try {
      await onConfirm(note.trim(), action || undefined);
      setNote("");
      setAction("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog open={open} onClose={() => !pending && onClose()} title="Resolve report" variant="modal">
      <div className="space-y-4 p-5">
        <p className="text-sm text-ink-muted">Resolving records that you acted on this report. Content only changes if you choose so below.</p>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">What should happen to the content?</legend>
          <label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={`${id}-act`} checked={action === ""} onChange={() => setAction("")} /> Leave it as it is</label>
          {status === "VISIBLE" && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={`${id}-act`} checked={action === "HIDE"} onChange={() => setAction("HIDE")} /> Hide it from everyone except its author</label>}
          {status === "HIDDEN" && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" name={`${id}-act`} checked={action === "RESTORE"} onChange={() => setAction("RESTORE")} /> Restore it</label>}
        </fieldset>
        <TextArea id={`${id}-note`} label="Moderation note (required)" hint="At least 3 characters. Kept in the moderation history." value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} disabled={pending} className="min-h-24" />
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={go} loading={pending} disabled={short}>Resolve report</Button>
        </div>
      </div>
    </Dialog>
  );
}

// ------------------------------------------------------------------ proposals

function Proposals() {
  const [status, setStatus] = useState("");
  const [needsReview, setNeedsReview] = useState(false);
  const [page, setPage] = useState(1);
  const { state, reload } = useApi<AdminProposalList>(`/admin/proposals?page=${page}${status ? `&status=${status}` : ""}${needsReview ? "&needsReview=true" : ""}`);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <SelectInput id="prop-status" label="Status" placeholder="All statuses" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          options={(Object.keys(PROPOSAL_STATUS_LABELS) as ProposalStatus[]).map((s) => ({ value: s, label: PROPOSAL_STATUS_LABELS[s] }))} />
        <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={needsReview} onChange={(e) => { setNeedsReview(e.target.checked); setPage(1); }} /> Only proposals that reached the vote threshold
        </label>
      </div>
      {state.status === "loading" || state.status === "unauthenticated" ? (
        <Skeleton className="h-40" />
      ) : state.status === "error" ? (
        <ErrorState action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>
      ) : state.data.proposals.length === 0 ? (
        <p className="rounded-card border border-dashed border-line-strong bg-surface p-4 text-sm text-ink-muted">No proposals match these filters.</p>
      ) : (
        <>
          <p className="text-sm text-ink-subtle">Reaching {state.data.voteThreshold} votes only lists a proposal here under the filter above; it changes nothing by itself.</p>
          <ul className="space-y-3">{state.data.proposals.map((p) => <li key={p.id}><ProposalRow proposal={p} onChanged={reload} /></li>)}</ul>
          <Pager page={state.data.page} totalPages={state.data.totalPages} onPage={setPage} label="Proposal pages" />
        </>
      )}
    </div>
  );
}

function ProposalRow({ proposal: p, onChanged }: { proposal: AdminProposal; onChanged: () => void }) {
  const manage = useAdmin().can("moderation.manage");
  const [next, setNext] = useState<ProposalStatus | null>(null);
  const [hide, setHide] = useState(false);
  const [notice, setNotice] = useState<string>();
  return (
    <Card className="p-4">
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="brand">{PROPOSAL_STATUS_LABELS[p.status]}</Badge>
        {p.visibility !== "VISIBLE" && <Badge tone="warning">{p.visibility.toLowerCase()}</Badge>}
        <span className="font-semibold tabular-nums">{p.voteCount} votes</span>
        {p.reachedThreshold && p.status === "SUBMITTED" && <Badge tone="success">reached threshold</Badge>}
        {p.openReports > 0 && <Badge tone="warning">{p.openReports} open report{p.openReports === 1 ? "" : "s"}</Badge>}
        <span className="text-ink-subtle">{p.author.displayName} · {formatDateTime(p.createdAt)}</span>
      </p>
      <h3 className="mt-2 font-bold break-words">{p.title}</h3>
      <p className="mt-1 whitespace-pre-line break-words text-sm text-ink-muted">{p.description}</p>
      {p.response && <p className="mt-2 text-sm"><span className="font-semibold">Response: </span>{p.response}</p>}
      {notice && <div className="mt-3"><Alert tone="success">{notice}</Alert></div>}
      {manage && <div className="mt-3 flex flex-wrap gap-2">
        {p.allowedNext.map((s) => <Button key={s} size="sm" variant="secondary" onClick={() => setNext(s)}>Move to {PROPOSAL_STATUS_LABELS[s].toLowerCase()}…</Button>)}
        {p.visibility !== "DELETED" && <Button size="sm" variant="ghost" onClick={() => setHide(true)}>{p.visibility === "VISIBLE" ? "Hide…" : "Restore…"}</Button>}
      </div>}
      {next && (
        <ConfirmDialog open title={`Move to “${PROPOSAL_STATUS_LABELS[next]}”?`} confirmLabel={`Move to ${PROPOSAL_STATUS_LABELS[next].toLowerCase()}`} tone={next === "DECLINED" ? "danger" : "primary"}
          reason={next === "DECLINED" ? "required" : "optional"} minReasonLength={3} onClose={() => setNext(null)}
          onConfirm={async (response) => { await api(`/admin/proposals/${p.id}/status`, { method: "POST", body: { status: next, ...(response && { response }) } }); setNotice(`Moved to ${PROPOSAL_STATUS_LABELS[next].toLowerCase()}.`); onChanged(); }}>
          {next === "DECLINED" ? "The response below is shown publicly to members. Voting closes and votes are frozen." : "The response below (optional) is shown publicly to members."}
        </ConfirmDialog>
      )}
      {hide && (
        <ConfirmDialog open title={p.visibility === "VISIBLE" ? "Hide this proposal?" : "Restore this proposal?"} confirmLabel={p.visibility === "VISIBLE" ? "Hide proposal" : "Restore proposal"} tone={p.visibility === "VISIBLE" ? "danger" : "primary"}
          reason="required" minReasonLength={3} onClose={() => setHide(false)}
          onConfirm={async (reason) => { await api(`/admin/moderation/proposals/${p.id}/visibility`, { method: "POST", body: { hidden: p.visibility === "VISIBLE", reason } }); setNotice(p.visibility === "VISIBLE" ? "Hidden." : "Restored."); onChanged(); }}>
          Hiding is about the content (for example spam); it is separate from the proposal&apos;s decision status.
        </ConfirmDialog>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ content

const CONTENT_TYPES = [
  { value: "posts", label: "Posts" },
  { value: "comments", label: "Comments" },
  { value: "reviews", label: "Reviews" },
  { value: "proposals", label: "Proposals" },
] as const;
type ContentKind = (typeof CONTENT_TYPES)[number]["value"];

type ContentItem = {
  type: "POST" | "COMMENT" | "REVIEW" | "PROPOSAL";
  id: string;
  status: "VISIBLE" | "HIDDEN" | "DELETED";
  title?: string;
  text: string;
  truncated: boolean;
  author: string;
  createdAt: string;
  openReports: number;
  moderationReason: string | null;
  rating?: number;
  worker?: string;
  votes?: number;
  decision?: string;
};
type ContentList = { items: ContentItem[]; page: number; pageSize: number; total: number; totalPages: number };

const VISIBILITY_TONE: Record<ContentItem["status"], BadgeTone> = { VISIBLE: "success", HIDDEN: "warning", DELETED: "neutral" };

function ContentBrowser() {
  const manage = useAdmin().can("moderation.manage");
  const [kind, setKind] = useState<ContentKind>("posts");
  const [status, setStatus] = useState("");
  const [reported, setReported] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<string>();
  const [target, setTarget] = useState<ContentItem | null>(null);
  const q = useDebounced(search.trim());
  const { state, reload, refresh, stale } = useApi<ContentList>(`/admin/content/${kind}${buildQuery({ status, reported: reported || undefined, q, page })}`);
  const reset = (fn: () => void) => { fn(); setPage(1); setNotice(undefined); };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectInput id="content-type" label="Content type" placeholder={null} value={kind} onChange={(e) => reset(() => setKind(e.target.value as ContentKind))} options={CONTENT_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
        <SelectInput id="content-status" label="Visibility" placeholder="Any" value={status} onChange={(e) => reset(() => setStatus(e.target.value))} options={[{ value: "VISIBLE", label: "Visible" }, { value: "HIDDEN", label: "Hidden" }, { value: "DELETED", label: "Deleted" }]} />
        <SearchInput id="content-search" label="Search" placeholder="Words in the text" value={search} onChange={(e) => reset(() => setSearch(e.target.value))} maxLength={100} />
        <label className="flex min-h-11 items-center gap-2 self-end text-sm font-medium">
          <input type="checkbox" checked={reported} onChange={(e) => reset(() => setReported(e.target.checked))} /> Only items with open reports
        </label>
      </div>
      {notice && <Alert tone="success">{notice}</Alert>}
      {state.status === "loading" || state.status === "unauthenticated" ? (
        <Skeleton className="h-40" />
      ) : state.status === "error" ? (
        <ErrorState action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>
      ) : state.data.items.length === 0 ? (
        <EmptyState icon={Inbox} title="Nothing here" headingLevel={3}>No content matches these filters.</EmptyState>
      ) : (
        <div className={stale ? "space-y-4 opacity-60" : "space-y-4"} aria-busy={stale || undefined}>
          <p className="text-sm text-ink-subtle">{state.data.total} {state.data.total === 1 ? "item" : "items"}</p>
          <ul className="space-y-3">
            {state.data.items.map((item) => (
              <li key={item.id}>
                <Card className="p-4">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge>{item.type.toLowerCase()}</Badge>
                    <Badge tone={VISIBILITY_TONE[item.status]}>{item.status.toLowerCase()}</Badge>
                    {item.decision && <Badge tone="brand">{PROPOSAL_STATUS_LABELS[item.decision as ProposalStatus] ?? item.decision.toLowerCase()}</Badge>}
                    {item.openReports > 0 && <Badge tone="warning">{item.openReports} open report{item.openReports === 1 ? "" : "s"}</Badge>}
                    {typeof item.rating === "number" && <span className="font-semibold">{item.rating}/5{item.worker ? ` for ${item.worker}` : ""}</span>}
                    {typeof item.votes === "number" && <span className="font-semibold tabular-nums">{item.votes} votes</span>}
                    <span className="text-ink-subtle">{item.author} · {formatDateTime(item.createdAt)}</span>
                  </p>
                  {item.title && <h3 className="mt-2 font-bold break-words">{item.title}</h3>}
                  <p className="mt-1 text-sm whitespace-pre-line break-words text-ink-muted">{item.text || <em>(no text)</em>}{item.truncated ? " (shortened)" : ""}</p>
                  {item.moderationReason && <p className="mt-2 text-sm"><span className="font-semibold">Moderation reason: </span>{item.moderationReason}</p>}
                  {manage && item.status !== "DELETED" && (
                    <div className="mt-3">
                      <Button size="sm" variant="ghost" onClick={() => setTarget(item)}>{item.status === "VISIBLE" ? "Hide…" : "Restore…"}</Button>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
          <Pager page={state.data.page} totalPages={state.data.totalPages} onPage={setPage} label="Content pages" />
        </div>
      )}
      {target && (
        <ConfirmDialog open title={target.status === "VISIBLE" ? `Hide this ${target.type.toLowerCase()}?` : `Restore this ${target.type.toLowerCase()}?`}
          confirmLabel={target.status === "VISIBLE" ? "Hide" : "Restore"} tone={target.status === "VISIBLE" ? "danger" : "primary"} reason="required" minReasonLength={3}
          onClose={() => setTarget(null)}
          onConfirm={async (reason) => {
            await api(`/admin/moderation/${kind}/${target.id}/visibility`, { method: "POST", body: { hidden: target.status === "VISIBLE", reason } });
            setNotice(target.status === "VISIBLE" ? "Content hidden." : "Content restored.");
            refresh();
          }}>
          {target.status === "VISIBLE" ? "It disappears for everyone except its author, who sees that it was removed. The text itself is not changed. You can restore it later." : "It becomes visible to everyone again."}
        </ConfirmDialog>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ history

function History() {
  const [page, setPage] = useState(1);
  const { state, reload } = useApi<AuditList>(`/admin/moderation/history?page=${page}`);
  if (state.status === "loading" || state.status === "unauthenticated") return <Skeleton className="h-40" />;
  if (state.status === "error") return <ErrorState action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>;
  if (state.data.entries.length === 0) return <p className="rounded-card border border-dashed border-line-strong bg-surface p-4 text-sm text-ink-muted">No moderation actions have been recorded yet.</p>;
  return (
    <div className="space-y-4">
      <ol className="divide-y divide-line rounded-card border border-line">
        {state.data.entries.map((e) => (
          <li key={e.id} className="p-4 text-sm">
            <p className="font-semibold">{AUDIT_LABELS[e.action] ?? e.action}</p>
            <p className="text-ink-subtle">{formatDateTime(e.createdAt)} · {e.actor ?? "system"} · {e.targetType}</p>
            {e.metadata && typeof e.metadata.reason === "string" && <p className="mt-1 text-ink-muted">“{e.metadata.reason}”</p>}
          </li>
        ))}
      </ol>
      <Pager page={state.data.page} totalPages={state.data.totalPages} onPage={setPage} label="History pages" />
    </div>
  );
}
