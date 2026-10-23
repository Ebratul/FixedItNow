"use client";

import { useEffect, type RefObject } from "react";

/** Close a popover on Escape (returning focus to its trigger) or outside click. */
export function useDismiss(
  open: boolean,
  close: () => void,
  rootRef: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        rootRef.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close, rootRef]);
}
