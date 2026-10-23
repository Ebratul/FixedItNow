"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { SERVICE_CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/cn";
import { useDismiss } from "@/lib/use-dismiss";

const FEATURED = SERVICE_CATEGORIES.slice(0, 6);

/**
 * Desktop "Services" disclosure. The trigger toggles a panel of links; it
 * closes on Escape, outside click, or navigation.
 */
export function ServicesMenu() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const active = pathname.startsWith("/services");

  useDismiss(open, close, rootRef);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="services-menu-panel"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex min-h-11 items-center gap-1 rounded-control px-3 text-sm font-semibold transition-colors hover:bg-surface-strong hover:text-ink",
          active || open ? "text-brand-800" : "text-ink-muted",
        )}
      >
        Services
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <div
          id="services-menu-panel"
          className="absolute top-full left-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-card border border-line bg-canvas p-2 shadow-pop"
        >
          <ul>
            {FEATURED.map(({ slug, name, icon: Icon }) => (
              <li key={slug}>
                <Link
                  href={`/workers?category=${slug}`}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-control px-3 text-sm font-medium text-ink hover:bg-brand-50"
                >
                  <Icon className="size-4 text-brand-600" aria-hidden />
                  {name}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/services"
            onClick={() => setOpen(false)}
            className="mt-1 flex min-h-11 items-center rounded-control border-t border-line px-3 pt-1 text-sm font-semibold text-brand-700 hover:underline"
          >
            View all services
          </Link>
        </div>
      )}
    </div>
  );
}
