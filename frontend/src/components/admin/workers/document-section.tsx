"use client";

import { Eye, EyeOff, FileImage } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { DOCUMENT_KINDS, DOCUMENT_LABELS, formatBytes, type DocumentKind, type WorkerDocumentMeta } from "./worker-types";

/**
 * Identity documents of one worker. The image is never fetched until the reviewer clicks "View", and it
 * is loaded by the browser straight from the admin endpoint (same origin, cookie auth) through an <img>:
 * the bytes never pass through JavaScript state, a data URL or storage. Each view is audited by the server.
 */
export function DocumentSection({
  workerId,
  documents,
  documentsRequired,
  missingDocuments,
  canView,
}: {
  workerId: string;
  documents: WorkerDocumentMeta[];
  documentsRequired: boolean;
  missingDocuments: DocumentKind[];
  canView: boolean;
}) {
  return (
    <section aria-labelledby="documents-heading" className="rounded-card border border-line bg-canvas p-5 shadow-card">
      <h2 id="documents-heading" className="text-lg font-bold">Identity documents</h2>
      <p className="mt-1 text-sm text-ink-muted">
        {documentsRequired
          ? "Identity documents are required before a worker can be approved."
          : "Identity documents are optional on this platform right now."}{" "}
        They are stored encrypted. Only roles with document access can open them.
      </p>
      {documentsRequired && missingDocuments.length > 0 && (
        <Alert tone="warning" title="Documents missing" className="mt-4">
          Still to be uploaded: {missingDocuments.map((k) => DOCUMENT_LABELS[k] ?? k).join(", ")}. The worker cannot be approved until they are.
        </Alert>
      )}
      {!canView && (
        <p className="mt-4 text-sm text-ink-muted">Your role can see whether documents were uploaded but cannot open them.</p>
      )}
      <ul className="mt-4 space-y-4">
        {DOCUMENT_KINDS.map((kind) => (
          <DocumentRow key={kind} workerId={workerId} kind={kind} meta={documents.find((d) => d.kind === kind)} canView={canView} />
        ))}
      </ul>
    </section>
  );
}

function DocumentRow({ workerId, kind, meta, canView }: { workerId: string; kind: DocumentKind; meta: WorkerDocumentMeta | undefined; canView: boolean }) {
  const [shown, setShown] = useState(false);
  const [failed, setFailed] = useState(false);
  const label = DOCUMENT_LABELS[kind];

  return (
    <li className="rounded-control border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-semibold">
            <FileImage className="size-4 text-ink-subtle" aria-hidden /> {label}
          </h3>
          {meta ? (
            <p className="mt-1 text-sm text-ink-muted">
              Uploaded {formatDateTime(meta.uploadedAt)} · {formatBytes(meta.sizeBytes)} · {meta.mimeType}
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">Not uploaded</p>
          )}
        </div>
        {!meta && <Badge tone="neutral">Missing</Badge>}
        {meta && canView && (
          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Button
              variant="secondary"
              aria-label={`${shown ? "Hide" : "View"} ${label}`}
              onClick={() => {
                setFailed(false);
                setShown((s) => !s);
              }}
            >
              {shown ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              {shown ? "Hide" : "View"}
            </Button>
            <p className="text-xs text-ink-subtle">This view is recorded in the audit log.</p>
          </div>
        )}
      </div>
      {meta && canView && shown && (
        <div className="mt-4">
          {failed ? (
            <Alert tone="error">
              The document could not be loaded. It may have been removed, your role may not allow viewing it, too many views were requested, or document storage is unavailable. Try again later.
            </Alert>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- private, uncacheable, audited endpoint: next/image would re-fetch and cache it
            <img
              src={`/api/v1/admin/workers/${workerId}/documents/${kind}`}
              alt={`${label} submitted by the worker`}
              onError={() => setFailed(true)}
              referrerPolicy="no-referrer"
              className="max-h-[32rem] w-full rounded-control border border-line bg-surface object-contain"
            />
          )}
        </div>
      )}
    </li>
  );
}
