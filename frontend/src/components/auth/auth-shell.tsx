import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** Centered card layout shared by all authentication pages. */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="bg-surface">
      <div className="container-page flex min-h-[calc(100dvh-4rem)] items-start justify-center py-10 md:items-center md:py-16">
        <div className="w-full max-w-md">
          <Card className="p-6 shadow-lift sm:p-8">
            <h1 className="text-2xl font-extrabold text-brand-950">{title}</h1>
            {description && <p className="mt-2 text-ink-muted">{description}</p>}
            <div className="mt-6">{children}</div>
          </Card>
          {footer && <p className="mt-6 text-center text-sm text-ink-muted">{footer}</p>}
        </div>
      </div>
    </div>
  );
}
