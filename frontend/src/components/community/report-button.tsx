"use client";

import { Flag } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useId, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { api, ApiError } from "@/lib/api";
import { REPORT_REASONS, type ReportTarget } from "@/lib/community";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectInput } from "@/components/ui/select-input";
import { TextArea } from "@/components/ui/text-area";

/**
 * "Report" for any user content. Reporting only tells the moderators: nothing
 * is hidden automatically. Signed-out visitors are sent to log in first.
 */
export function ReportButton({ type, id, label = "Report" }: { type: ReportTarget; id: string; label?: string }) {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const uid = useId();

  async function submit() {
    if (!reason) {
      setError("Choose a reason.");
      return;
    }
    setPending(true);
    setError(undefined);
    try {
      const body = { reason, ...(details.trim() && { details: details.trim() }) };
      if (type === "REVIEW") await api(`/reviews/${id}/report`, { method: "POST", body });
      else await api("/community/reports", { method: "POST", body: { targetType: type, targetId: id, ...body } });
      setSent(true);
    } catch (e) {
      // 409 ALREADY_REPORTED, 422 own content, 404 removed content: the server's message is user-safe.
      setError(e instanceof ApiError || e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function start() {
    if (!session) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setSent(false);
    setError(undefined);
    setOpen(true);
  }

  return (
    <>
      <button type="button" onClick={start} className="inline-flex min-h-9 items-center gap-1.5 rounded-control px-2 text-sm font-medium text-ink-muted hover:bg-surface-strong hover:text-ink">
        <Flag className="size-4" aria-hidden /> {label}
      </button>
      <Dialog open={open} onClose={() => !pending && setOpen(false)} title="Report content" variant="modal">
        <div className="space-y-4 p-5">
          {sent ? (
            <>
              <Alert tone="success" title="Report sent">Thank you. A moderator will review it. Nothing is removed automatically.</Alert>
              <div className="flex justify-end"><Button onClick={() => setOpen(false)}>Close</Button></div>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-muted">Tell the moderators what is wrong. Your report is private; the author will not see who reported it.</p>
              <SelectInput id={`${uid}-reason`} label="Reason" placeholder="Choose a reason" options={REPORT_REASONS} value={reason} onChange={(e) => setReason(e.target.value)} disabled={pending} />
              <TextArea id={`${uid}-details`} label="More detail (optional)" value={details} maxLength={500} onChange={(e) => setDetails(e.target.value)} className="min-h-24" disabled={pending} />
              {error && <Alert tone="error">{error}</Alert>}
              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
                <Button onClick={submit} loading={pending}>Send report</Button>
              </div>
            </>
          )}
        </div>
      </Dialog>
    </>
  );
}
