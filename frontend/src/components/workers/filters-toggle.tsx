"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Collapses the filter panel on small screens (always visible from `lg`).
 * The filters themselves are a plain GET form rendered by the server, so they
 * work without JavaScript; this only controls visibility.
 */
export function FiltersToggle({ activeCount, children }: { activeCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="filter-panel"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-11 items-center gap-2 rounded-control border border-line-strong bg-canvas px-4 text-sm font-semibold text-ink hover:border-brand-300 lg:hidden"
      >
        <SlidersHorizontal className="size-4" aria-hidden />
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
      </button>
      <div id="filter-panel" className={cn(open ? "mt-3 block" : "hidden", "lg:mt-0 lg:block")}>
        {children}
      </div>
    </div>
  );
}
