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
    <div className="border-b border-line bg-surface">
      <div className="container-page py-10 md:py-14">
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
