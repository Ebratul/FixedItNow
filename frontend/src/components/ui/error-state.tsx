import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";

/** Error state with a safe message and an optional retry action. */
export function ErrorState({
  title = "Something went wrong",
  children,
  action,
}: {
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-panel border border-danger/30 bg-danger-soft px-6 py-12 text-center"
    >
      <TriangleAlert className="size-8 text-danger" aria-hidden />
      <h3 className="mt-3 text-lg font-bold text-ink">{title}</h3>
      {children && <p className="mt-2 max-w-md text-ink-muted">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
