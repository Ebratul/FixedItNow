"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { IconButton } from "./button";
import { cn } from "@/lib/cn";

/**
 * Modal dialog built on the native <dialog> element, which provides focus
 * trapping, Escape-to-close, and inert background. Controlled via `open`.
 */
export function Dialog({
  open,
  onClose,
  title,
  className,
  variant = "sheet",
  dismissible = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  className?: string;
  /** "sheet": full-width panel from the top (mobile menu). "modal": centred card. */
  variant?: "sheet" | "modal";
  /**
   * false while the dialog is busy (a request is in flight): Escape and a backdrop click are ignored, so the
   * native dialog can never be closed behind a parent that still thinks it is open.
   */
  dismissible?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onCancel={(event) => {
        if (!dismissible) event.preventDefault();
      }}
      onClick={(event) => {
        // Clicking the backdrop (the dialog element itself) dismisses it.
        if (event.target === ref.current && dismissible) onClose();
      }}
      className={cn(
        "bg-canvas p-0 text-ink backdrop:backdrop-blur-[1px] open:animate-fade-up",
        variant === "sheet"
          ? "m-0 max-h-dvh w-full max-w-none"
          : "m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-panel border border-line shadow-pop",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-base font-bold">{title}</p>
        <IconButton label="Close" onClick={onClose}>
          <X className="size-5" aria-hidden />
        </IconButton>
      </div>
      {children}
    </dialog>
  );
}
