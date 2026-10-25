"use client";

import { FileImage, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useId, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";

type Kind = "NID_FRONT" | "NID_BACK" | "SELFIE_WITH_ID";
type DocumentList = { storageAvailable: boolean; required: boolean; requiredKinds: Kind[]; documents: { kind: Kind; mimeType: string; sizeBytes: number; uploadedAt: string }[] };

export const DOCUMENT_ROWS: { kind: Kind; label: string; hint: string }[] = [
  { kind: "NID_FRONT", label: "National ID, front", hint: "The side with your photo and name." },
  { kind: "NID_BACK", label: "National ID, back", hint: "The side with the address and barcode." },
  { kind: "SELFIE_WITH_ID", label: "Selfie holding your ID", hint: "Your face and the ID in the same photo." },
];

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;

const ERROR_COPY: Record<string, string> = {
  FILE_TOO_LARGE: "That file is larger than 3 MB. Choose a smaller photo.",
  FILE_TOO_SMALL: "That file is too small to be a photo of a document. Choose the original photo.",
  UNSUPPORTED_MEDIA_TYPE: "Only JPEG, PNG or WebP images are accepted.",
  MEDIA_TYPE_MISMATCH: "The file's content does not match its type. Choose the original photo, not a renamed file.",
  ALREADY_VERIFIED: "Your profile is already verified, so identity documents can't be changed here. Contact support if something is wrong.",
  PROFILE_REQUIRED: "Save your worker profile first (finish the earlier steps), then upload your documents.",
  DOCUMENTS_REQUIRED: "Upload both sides of your National ID before submitting your profile.",
  DOCUMENTS_NOT_CONFIGURED: "Document upload is not available right now. Please try again later.",
  UPLOAD_IN_PROGRESS: "Another upload for this document is still in progress. Try again in a moment.",
};

const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

/** Client-side check so an obviously wrong file never leaves the device. The server checks again. */
export function checkDocumentFile(file: { type: string; size: number }): string | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return ERROR_COPY.UNSUPPORTED_MEDIA_TYPE!;
  if (file.size > MAX_DOCUMENT_BYTES) return ERROR_COPY.FILE_TOO_LARGE!;
  if (file.size === 0) return ERROR_COPY.FILE_TOO_SMALL!;
  return null;
}

async function uploadDocument(kind: Kind, file: File): Promise<void> {
  let response: Response;
  try {
    // The raw image is the request body (not JSON, not FormData); the server reads the type from the bytes.
    response = await fetch(`/api/v1/me/worker-profile/documents/${kind}`, {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": file.type },
      body: file,
    });
  } catch {
    throw new Error("We couldn't reach the server. Check your connection and try again.");
  }
  if (response.ok) return;
  let body: { code?: unknown } = {};
  try {
    body = await response.json();
  } catch {
    /* non-JSON error body */
  }
  const code = typeof body.code === "string" ? body.code : undefined;
  if (code && ERROR_COPY[code]) throw new Error(ERROR_COPY[code]);
  if (response.status === 413) throw new Error(ERROR_COPY.FILE_TOO_LARGE);
  if (response.status === 429) throw new Error("Too many uploads. Please wait a few minutes and try again.");
  if (response.status === 401) throw new Error("Please log in again to upload.");
  throw new Error("The upload didn't work. Please try again.");
}

/**
 * Identity documents for the review step: optional unless an administrator has made the National ID compulsory
 * (the server says which, in `required` / `requiredKinds`). The worker can only send an image in and remove it:
 * nothing is previewed or downloaded back. Stored encrypted; only authorised reviewers can open it.
 */
export function IdentityDocuments() {
  const { state, reload, refresh } = useApi<DocumentList>("/me/worker-profile/documents");
  const [errors, setErrors] = useState<Partial<Record<Kind, string>>>({});
  const [busy, setBusy] = useState<Kind | null>(null);
  const [removing, setRemoving] = useState<Kind | null>(null);
  const [notice, setNotice] = useState<string>();
  const uid = useId();

  const setError = (kind: Kind, message: string | undefined) => setErrors((e) => ({ ...e, [kind]: message }));

  async function choose(kind: Kind, input: HTMLInputElement) {
    const file = input.files?.[0];
    input.value = "";
    if (!file || busy) return;
    setNotice(undefined);
    const problem = checkDocumentFile(file);
    if (problem) return setError(kind, problem);
    setError(kind, undefined);
    setBusy(kind);
    try {
      await uploadDocument(kind, file);
      setNotice("Document uploaded.");
      refresh();
    } catch (e) {
      setError(kind, e instanceof Error ? e.message : "The upload didn't work. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby={`${uid}-h`} className="rounded-card border border-line p-4">
      <h3 id={`${uid}-h`} className="flex items-center gap-2 font-bold">
        <ShieldCheck className="size-5 text-brand-700" aria-hidden /> Identity documents
      </h3>
      <p className="mt-1 text-sm text-ink-muted">
        {state.status === "ready" && state.data.required
          ? "Both sides of your National ID are required before you can submit your profile. "
          : "Photos of your ID are optional, but help a reviewer approve you faster. "} Each file is stored encrypted and only authorised reviewers can open it; you will not be able to view it again after uploading. JPEG, PNG or WebP, up to 3 MB each.
      </p>
      {state.status === "loading" || state.status === "unauthenticated" ? (
        <Skeleton className="mt-4 h-24" />
      ) : state.status === "error" ? (
        <Alert tone="error" className="mt-4">
          {state.message} <button type="button" onClick={reload} className="font-semibold underline">Try again</button>
        </Alert>
      ) : (
        <>
          {!state.data.storageAvailable && (
            <Alert tone="warning" className="mt-4">Document upload is not available right now. Please try again later.</Alert>
          )}
          <div aria-live="polite">{notice && <Alert tone="success" className="mt-4">{notice}</Alert>}</div>
          <ul className="mt-4 space-y-3">
            {DOCUMENT_ROWS.map(({ kind, label, hint }) => {
              const doc = state.data.documents.find((d) => d.kind === kind);
              const inputId = `${uid}-${kind}`;
              const isRequired = state.data.required && state.data.requiredKinds.includes(kind);
              return (
                <li key={kind} className="rounded-control border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-semibold"><FileImage className="size-4 text-ink-subtle" aria-hidden /> {label}
                        <span className={isRequired ? "font-bold text-danger" : "font-normal text-ink-subtle"}>{isRequired ? "(required)" : "(optional)"}</span>
                      </p>
                      <p className="text-xs text-ink-subtle">{hint}</p>
                    </div>
                    {doc ? <Badge tone="success">Uploaded</Badge> : <Badge tone="neutral">Not uploaded</Badge>}
                  </div>
                  {doc && (
                    <p className="mt-2 text-sm text-ink-muted">
                      {formatDateTime(doc.uploadedAt)} · {formatSize(doc.sizeBytes)}
                    </p>
                  )}
                  {state.data.storageAvailable && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <label htmlFor={inputId} className="sr-only">{doc ? "Replace" : "Choose"} image for {label}</label>
                      <input
                        id={inputId}
                        type="file"
                        accept={ACCEPTED_TYPES.join(",")}
                        disabled={busy !== null}
                        onChange={(e) => void choose(kind, e.currentTarget)}
                        className="min-h-11 max-w-full text-sm file:mr-3 file:min-h-11 file:rounded-control file:border file:border-line-strong file:bg-canvas file:px-4 file:font-semibold"
                      />
                      {busy === kind && (
                        <span className="inline-flex items-center gap-2 text-sm text-ink-muted" role="status"><Upload className="size-4 animate-pulse" aria-hidden /> Uploading…</span>
                      )}
                      {doc && busy !== kind && (
                        <Button variant="ghost" disabled={busy !== null} onClick={() => setRemoving(kind)} aria-label={`Remove ${label}`}>
                          <Trash2 className="size-4" aria-hidden /> Remove
                        </Button>
                      )}
                    </div>
                  )}
                  {errors[kind] && <Alert tone="error" className="mt-3">{errors[kind]}</Alert>}
                </li>
              );
            })}
          </ul>
        </>
      )}
      {removing && (
        <ConfirmDialog
          open
          title="Remove this document?"
          confirmLabel="Remove"
          tone="danger"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            try {
              await api(`/me/worker-profile/documents/${removing}`, { method: "DELETE" });
            } catch (e) {
              const code = e instanceof ApiError ? e.code : undefined;
              throw new Error(code && ERROR_COPY[code] ? ERROR_COPY[code] : e instanceof Error ? e.message : "Couldn't remove it. Please try again.");
            }
            setNotice("Document removed.");
            refresh();
          }}
        >
          The stored file is deleted. You can upload another one afterwards.
        </ConfirmDialog>
      )}
    </section>
  );
}
