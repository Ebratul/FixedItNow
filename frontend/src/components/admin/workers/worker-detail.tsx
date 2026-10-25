"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AdminPage, ApiView, StatusBadge } from "@/components/admin/kit";
import { useAdmin } from "@/components/admin/shell/admin-context";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { formatBdt, formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { DocumentSection } from "./document-section";
import { VERIFICATION_STATUS_MAP, type AdminWorkerDetail, type WorkerHistoryEntry } from "./worker-types";

type Decision = "VERIFIED" | "REJECTED" | "RESUBMISSION_REQUIRED";

const DECISIONS: Record<Decision, { button: string; title: string; confirm: string; done: string; reason: "optional" | "required"; danger?: boolean }> = {
  VERIFIED: { button: "Approve", title: "Approve this worker?", confirm: "Approve", done: "Worker approved. They were notified.", reason: "optional" },
  RESUBMISSION_REQUIRED: { button: "Request changes", title: "Ask for changes?", confirm: "Request changes", done: "Changes requested. The worker was notified.", reason: "required" },
  REJECTED: { button: "Reject", title: "Reject this application?", confirm: "Reject", done: "Application rejected. The worker was notified.", reason: "required", danger: true },
};

const HISTORY_LABELS: Record<string, string> = {
  "worker.verification.review": "Review decision",
  "worker.suspend": "Suspended",
  "worker.unsuspend": "Restored",
  "worker.document.view": "Identity document viewed",
};

export function WorkerDetail({ id }: { id: string }) {
  const { state, reload, refresh } = useApi<{ worker: AdminWorkerDetail }>(`/admin/workers/${id}`);
  return (
    <AdminPage
      title="Worker review"
      description="Check the profile and identity documents, then decide. The worker is notified of every decision."
      permission="workers.read"
      actions={
        <Link href="/admin/workers" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> All applications
        </Link>
      }
    >
      <ApiView state={state} reload={reload} skeleton={<Skeleton className="h-96" />}>
        {({ worker }) => <Body worker={worker} onChanged={refresh} />}
      </ApiView>
    </AdminPage>
  );
}

function Body({ worker, onChanged }: { worker: AdminWorkerDetail; onChanged: () => void }) {
  const { can } = useAdmin();
  const [notice, setNotice] = useState<string>();
  const done = (message: string) => {
    setNotice(message);
    onChanged();
  };
  return (
    <>
      <div aria-live="polite">{notice && <Alert tone="success">{notice}</Alert>}</div>
      <Profile worker={worker} />
      <Status worker={worker} />
      <DocumentSection
        workerId={worker.id}
        documents={worker.documents}
        documentsRequired={worker.documentsRequired}
        missingDocuments={worker.missingDocuments}
        canView={can("workers.documents.view")}
      />
      <Actions worker={worker} onDone={done} />
      <History entries={worker.history} />
    </>
  );
}

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-card border border-line bg-canvas p-5 shadow-card">
      <h2 id={id} className="text-lg font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[10rem_1fr]">
      {items.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="font-semibold text-ink-muted">{label}</dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Profile({ worker: w }: { worker: AdminWorkerDetail }) {
  return (
    <Card id="profile-heading" title="Profile">
      <Facts
        items={[
          ["Display name", w.displayName ?? "Not set"],
          ["Account", `${w.user.name} · ${w.user.email}`],
          ["Headline", w.headline || "None"],
          ["Experience", w.experienceYears === null ? "Not set" : `${w.experienceYears} years`],
          ["Languages", w.languages.length ? w.languages.join(", ") : "None"],
          ["Service areas", w.serviceAreas.length ? w.serviceAreas.join(", ") : "None"],
          [
            "Services",
            w.services.length ? (
              <ul className="space-y-1">
                {w.services.map((s) => (
                  <li key={s.category.slug}>
                    {s.category.name} · {s.pricingModel === "QUOTE" ? "Quote after inspection" : `${formatBdt(s.basePriceBdt ?? 0)}${s.pricingModel === "HOURLY" ? " per hour" : ""}`}
                  </li>
                ))}
              </ul>
            ) : (
              "None"
            ),
          ],
          ["About", w.bio ? <p className="whitespace-pre-line">{w.bio}</p> : "None"],
        ]}
      />
    </Card>
  );
}

function Status({ worker: w }: { worker: AdminWorkerDetail }) {
  return (
    <Card id="status-heading" title="Status">
      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge value={w.verificationStatus} map={VERIFICATION_STATUS_MAP} />
        <Badge tone={w.published ? "success" : "neutral"}>{w.published ? "Published" : "Not published"}</Badge>
        {w.suspended && <Badge tone="danger">Suspended</Badge>}
        {w.user.suspended && <Badge tone="danger">Account suspended</Badge>}
      </div>
      <Facts
        items={[
          ["Submitted", w.submittedAt ? formatDateTime(w.submittedAt) : "Not submitted yet"],
          ["Last review", w.reviewedAt ? `${formatDateTime(w.reviewedAt)}${w.reviewedBy ? ` by ${w.reviewedBy}` : ""}` : "Not reviewed"],
          ...(w.reviewNote ? ([["Reviewer note", w.reviewNote]] as [string, ReactNode][]) : []),
          ...(w.suspended
            ? ([
                ["Suspended since", w.suspendedAt ? formatDateTime(w.suspendedAt) : "Yes"],
                ["Suspension reason", w.suspensionReason ?? "No reason recorded"],
              ] as [string, ReactNode][])
            : []),
        ]}
      />
    </Card>
  );
}

function Actions({ worker, onDone }: { worker: AdminWorkerDetail; onDone: (message: string) => void }) {
  const { can } = useAdmin();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const canReview = can("workers.review") && worker.verificationStatus === "PENDING";
  const canSuspend = can("workers.suspend");
  if (!canReview && !canSuspend) return null;

  if (worker.isOwnProfile) {
    return (
      <Card id="actions-heading" title="Decision">
        <Alert tone="info">This is your own worker profile. You cannot review or suspend your own profile; another administrator has to.</Alert>
      </Card>
    );
  }

  return (
    <Card id="actions-heading" title="Decision">
      {canReview && (
        <div>
          <p className="text-sm text-ink-muted">This application is awaiting review. Requesting changes or rejecting needs a reason the worker will see.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {(Object.keys(DECISIONS) as Decision[]).map((d) => (
              <Button key={d} variant={d === "VERIFIED" ? "primary" : "secondary"} onClick={() => setDecision(d)}>
                {DECISIONS[d].button}
              </Button>
            ))}
          </div>
        </div>
      )}
      {!canReview && can("workers.review") && (
        <p className="text-sm text-ink-muted">Only applications awaiting review can be decided.</p>
      )}
      {canSuspend && (
        <div className={canReview ? "mt-6 border-t border-line pt-4" : ""}>
          <p className="text-sm text-ink-muted">
            {worker.suspended
              ? "This profile is suspended and hidden from the public site. Restoring it does not publish it again by itself."
              : "Suspending hides the profile from the public site and stops new bookings. The reason is an internal note."}
          </p>
          <div className="mt-3">
            <Button variant="secondary" onClick={() => setSuspendOpen(true)}>
              {worker.suspended ? "Restore profile" : "Suspend profile"}
            </Button>
          </div>
        </div>
      )}

      {decision && (
        <ConfirmDialog
          open
          title={DECISIONS[decision].title}
          confirmLabel={DECISIONS[decision].confirm}
          tone={DECISIONS[decision].danger ? "danger" : "primary"}
          reason={DECISIONS[decision].reason}
          onClose={() => setDecision(null)}
          onConfirm={async (note) => {
            await api(`/admin/workers/${worker.id}/verification`, { method: "POST", body: { decision, ...(note ? { note } : {}) } });
            onDone(DECISIONS[decision].done);
          }}
        >
          {decision === "VERIFIED"
            ? "The worker will be able to publish their profile. You may add an optional note."
            : "The worker is notified and sees your reason. They can edit and submit again unless you reject."}
        </ConfirmDialog>
      )}
      {suspendOpen && (
        <ConfirmDialog
          open
          title={worker.suspended ? "Restore this profile?" : "Suspend this profile?"}
          confirmLabel={worker.suspended ? "Restore" : "Suspend"}
          tone={worker.suspended ? "primary" : "danger"}
          reason={worker.suspended ? "none" : "required"}
          onClose={() => setSuspendOpen(false)}
          onConfirm={async (reason) => {
            await api(`/admin/workers/${worker.id}/suspension`, {
              method: "POST",
              body: worker.suspended ? { suspended: false } : { suspended: true, reason },
            });
            onDone(worker.suspended ? "Profile restored." : "Profile suspended.");
          }}
        >
          {worker.suspended
            ? "The profile becomes eligible for the public site again once it is published."
            : "The profile disappears from search and cannot receive new bookings until it is restored."}
        </ConfirmDialog>
      )}
    </Card>
  );
}

function detailText(entry: WorkerHistoryEntry): string | null {
  const d = entry.detail;
  if (!d) return null;
  const parts: string[] = [];
  if (typeof d.decision === "string") parts.push(String(VERIFICATION_STATUS_MAP[d.decision as keyof typeof VERIFICATION_STATUS_MAP]?.label ?? d.decision));
  if (typeof d.kind === "string") parts.push(d.kind.toLowerCase().replaceAll("_", " "));
  if (typeof d.note === "string" && d.note) parts.push(`Note: ${d.note}`);
  if (typeof d.reason === "string" && d.reason) parts.push(`Reason: ${d.reason}`);
  return parts.length ? parts.join(" · ") : null;
}

function History({ entries }: { entries: WorkerHistoryEntry[] }) {
  return (
    <Card id="history-heading" title="History">
      {entries.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing has happened to this profile yet.</p>
      ) : (
        <ol className="space-y-3">
          {entries.map((e) => (
            <li key={e.id} className="text-sm">
              <p>
                <span className="font-semibold">{HISTORY_LABELS[e.action] ?? e.action}</span> by {e.by}
                <span className="text-ink-subtle"> · {formatDateTime(e.at)}</span>
              </p>
              {detailText(e) && <p className="mt-0.5 text-ink-muted">{detailText(e)}</p>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
