"use client";

import { useId, useState, type ReactNode } from "react";
import { Alert } from "./alert";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { TextArea } from "./text-area";

/**
 * Confirmation for consequential actions. Optionally collects a reason
 * (`reason: "required"` enforces `minReasonLength`). The dialog stays open and
 * shows the server's message if the action fails; it closes only on success.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = "primary",
  reason,
  minReasonLength = 5,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  reason?: "none" | "optional" | "required";
  minReasonLength?: number;
  onConfirm: (reason: string | undefined) => Promise<void>;
  onClose: () => void;
}) {
  const reasonId = useId();
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const mode = reason ?? "none";
  const trimmed = text.trim();
  const tooShort = mode === "required" && trimmed.length < minReasonLength;
  const invalidOptional = mode === "optional" && trimmed.length > 0 && trimmed.length < minReasonLength;

  async function confirm() {
    if (pending || tooShort || invalidOptional) return;
    setPending(true);
    setError(undefined);
    try {
      await onConfirm(trimmed || undefined);
      setText("");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onClose={() => !pending && onClose()} title={title} variant="modal">
      <div className="space-y-4 p-5">
        <div className="text-ink-muted">{children}</div>
        {mode !== "none" && (
          <TextArea
            id={reasonId}
            label={mode === "required" ? "Reason" : "Reason (optional)"}
            hint={`At least ${minReasonLength} characters${mode === "optional" ? " if provided" : ""}.`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={500}
            className="min-h-24"
            error={(tooShort && text.length > 0) || invalidOptional ? `Use at least ${minReasonLength} characters` : undefined}
            disabled={pending}
            autoFocus
          />
        )}
        {error && <Alert tone="error">{error}</Alert>}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Keep as is
          </Button>
          <Button
            onClick={confirm}
            loading={pending}
            disabled={tooShort || invalidOptional}
            className={tone === "danger" ? "bg-danger text-white hover:bg-danger/90 active:bg-danger" : undefined}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
