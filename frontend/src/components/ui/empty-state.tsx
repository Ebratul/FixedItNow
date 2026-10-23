import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Empty state with a meaningful next action (docs/SRS.md §11.3). */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
  headingLevel = 3,
}: {
  icon: LucideIcon;
  title: string;
  /** Match the surrounding outline: 1 for a page's main state, else 2 or 3. */
  headingLevel?: 1 | 2 | 3;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-panel border border-dashed border-line-strong bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-brand-700">
        <Icon className="size-6" aria-hidden />
      </span>
      <Heading className="mt-4 text-lg font-bold text-ink">{title}</Heading>
      {children && (
        <p className="mt-2 max-w-md text-ink-muted">{children}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
