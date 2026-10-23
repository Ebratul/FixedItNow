import type { ReactNode } from "react";
import { FieldError } from "./field";
import { cn } from "@/lib/cn";

export type CheckboxOption = { value: string; label: string; description?: string };

/** Accessible group of native checkboxes (fieldset + legend). */
export function CheckboxGroup({
  legend,
  name,
  options,
  value,
  onChange,
  error,
  hint,
  disabled,
  columns = 2,
}: {
  legend: ReactNode;
  name: string;
  options: readonly CheckboxOption[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
  columns?: 1 | 2;
}) {
  const errorId = `${name}-error`;
  return (
    <fieldset
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      className="min-w-0"
    >
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      {hint && !error && <p className="mt-1 text-sm text-ink-subtle">{hint}</p>}
      <div className={cn("mt-3 grid gap-2", columns === 2 && "sm:grid-cols-2")}>
        {options.map((option) => {
          const checked = value.includes(option.value);
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-control border px-3 py-2.5 text-sm transition-colors",
                checked ? "border-brand-600 bg-brand-50" : "border-line-strong bg-canvas hover:border-brand-300",
              )}
            >
              <input
                type="checkbox"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() =>
                  onChange(checked ? value.filter((v) => v !== option.value) : [...value, option.value])
                }
                className="mt-0.5 size-4 shrink-0 accent-brand-700"
              />
              <span>
                <span className="font-medium text-ink">{option.label}</span>
                {option.description && <span className="block text-ink-subtle">{option.description}</span>}
              </span>
            </label>
          );
        })}
      </div>
      {error && (
        <div className="mt-2">
          <FieldError id={errorId}>{error}</FieldError>
        </div>
      )}
    </fieldset>
  );
}
