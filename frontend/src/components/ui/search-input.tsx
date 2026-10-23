import { Search } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { controlClasses, describedBy, Field } from "./field";

type SearchInputProps = Omit<ComponentProps<"input">, "id" | "type"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
};

/** Text input with a leading search icon. */
export function SearchInput({
  id,
  label,
  hint,
  error,
  hideLabel,
  className,
  ...props
}: SearchInputProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-subtle"
          aria-hidden
        />
        <input
          id={id}
          type="search"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cn(controlClasses, "pl-10", className)}
          {...props}
        />
      </div>
    </Field>
  );
}
