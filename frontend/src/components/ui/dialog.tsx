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
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  className?: string;
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
      onClick={(event) => {
        // Clicking the backdrop (the dialog element itself) dismisses it.
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "m-0 max-h-dvh w-full max-w-none bg-canvas p-0 text-ink backdrop:backdrop-blur-[1px] open:animate-fade-up",
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
