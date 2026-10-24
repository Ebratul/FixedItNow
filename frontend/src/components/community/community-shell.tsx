"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/community", label: "Discussions" },
  { href: "/community/proposals", label: "Feature proposals" },
] as const;

/** Tab links shared by the community pages. */
export function CommunityTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Community sections" className="flex gap-1 border-b border-line">
      {TABS.map((tab) => {
        const active = tab.href === "/community" ? pathname === "/community" || /^\/community\/(?!proposals)/.test(pathname) : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex min-h-11 items-center border-b-2 px-4 text-sm font-semibold",
              active ? "border-brand-700 text-brand-800" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Pager({ page, totalPages, onPage, label }: { page: number; totalPages: number; onPage: (page: number) => void; label: string }) {
  if (totalPages <= 1) return null;
  return (
    <nav aria-label={label} className="flex items-center justify-center gap-3">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="min-h-11 rounded-control border border-line-strong px-4 text-sm font-semibold hover:bg-brand-50 disabled:opacity-50">Previous</button>
      <span className="text-sm text-ink-muted">Page {page} of {totalPages}</span>
      <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="min-h-11 rounded-control border border-line-strong px-4 text-sm font-semibold hover:bg-brand-50 disabled:opacity-50">Next</button>
    </nav>
  );
}

/** Wraps a page body with a note that community text is plain text and moderated. */
export function CommunityNote({ children }: { children?: ReactNode }) {
  return (
    <p className="text-sm text-ink-subtle">
      {children ?? "Posts are plain text and visible to signed-in members. Moderators review reports; reporting never removes anything automatically."}
    </p>
  );
}
