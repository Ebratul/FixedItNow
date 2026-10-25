"use client";

import { useId, useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextInput } from "@/components/ui/text-input";

/**
 * Confirmation for irreversible or money-moving actions: the admin must type `phrase` (a slug,
 * reference or key) exactly. The dialog stays open with the server's message when the call fails and
 * closes only on success. The server demands its own confirmation as well.
 */
export function TypedConfirmDialog({
  open,
  title,
  children,
  phrase,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  phrase: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const id = useId();
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const matches = typed.trim() === phrase;

  async function go() {
    if (!matches || pending) return;
    setPending(true);
    setError(undefined);
    try {
      await onConfirm();
      setTyped("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onClose={() => !pending && onClose()} title={title} variant="modal" dismissible={!pending}>
      <div className="space-y-4 p-5">
        <div className="text-ink-muted">{children}</div>
        <TextInput id={id} label={`Type “${phrase}” to confirm`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoFocus disabled={pending} />
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={go} loading={pending} disabled={!matches} className="bg-danger text-white hover:bg-danger/90 active:bg-danger">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
