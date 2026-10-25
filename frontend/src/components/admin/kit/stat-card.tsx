import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/**
 * One headline number. With `href` the LABEL becomes the link (stretched over the whole card), so the link's
 * name says what it opens and the card stays a valid definition-list group.
 */
export function StatCard({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  return (
    <Card className="relative h-full p-4" interactive={Boolean(href)}>
      <dt className="text-xs font-semibold text-ink-subtle">
        {href ? (
          <Link href={href} className="rounded-card text-ink-subtle after:absolute after:inset-0 after:rounded-card hover:text-brand-800">
            {label}
          </Link>
        ) : (
          label
        )}
      </dt>
      <dd className="mt-1 text-2xl font-extrabold text-brand-950 tabular-nums">{value}</dd>
      {hint && <dd className="mt-1 text-xs text-ink-muted">{hint}</dd>}
    </Card>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{children}</dl>;
}
