import type { ReactNode } from "react";
import { Breadcrumbs, type Crumb } from "@/components/ui/breadcrumbs";

/** Standard header for inner pages: breadcrumbs, the page's single h1, intro. */
export function PageHeader({
  crumbs,
  title,
  description,
  children,
}: {
  crumbs: Crumb[];
  title: string;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border-b border-line bg-gradient-to-br from-brand-50 via-surface to-accent-50/60">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-brand-200/50 blur-3xl"
      />
      <div
        aria-hidden
        className="bg-dots pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_right,transparent,black)]"
      />
      <div className="container-page relative py-10 md:py-14">
        <Breadcrumbs items={crumbs} />
        <h1 className="mt-4 max-w-3xl text-h1 font-extrabold text-balance text-brand-950">
          {title}
        </h1>
        {description && (
          <p className="mt-4 max-w-2xl text-lg text-ink-muted text-pretty">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
