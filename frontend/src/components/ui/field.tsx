import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** Visually hide the label while keeping it for assistive tech. */
  hideLabel?: boolean;
  className?: string;
  children: ReactNode;
};

/** Label + control + hint/error wrapper shared by all form controls. */
export function Field({
  id,
  label,
  hint,
  error,
  hideLabel,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className={cn(
          "text-sm font-semibold text-ink",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-sm text-ink-subtle">
          {hint}
        </p>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </div>
  );
}

export function FieldError({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-1.5 text-sm font-medium text-danger"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** Shared control styling for inputs and selects. */
export const controlClasses =
  "min-h-11 w-full rounded-control border border-line-strong bg-canvas px-3.5 text-base text-ink placeholder:text-ink-subtle transition-colors hover:border-brand-300 focus-visible:border-brand-600 disabled:cursor-not-allowed disabled:bg-surface disabled:opacity-60 aria-[invalid=true]:border-danger";

/** Describe a control with its hint/error for screen readers. */
export function describedBy(id: string, hint?: string, error?: string) {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}
