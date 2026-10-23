import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "error" | "success" | "info" | "warning";

const styles: Record<Tone, { box: string; icon: typeof Info }> = {
  error: { box: "border-danger/30 bg-danger-soft text-danger", icon: AlertCircle },
  success: { box: "border-accent-200 bg-success-soft text-success", icon: CheckCircle2 },
  info: { box: "border-brand-200 bg-brand-50 text-brand-800", icon: Info },
  warning: { box: "border-amber-300 bg-warning-soft text-warning", icon: TriangleAlert },
};

/** Inline message. Errors are announced assertively; others politely. */
export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = styles[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex gap-3 rounded-card border p-4 text-sm", box, className)}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <div>
        {title && <p className="font-bold">{title}</p>}
        <div className={cn(title && "mt-1", "text-ink-muted")}>{children}</div>
      </div>
    </div>
  );
}
