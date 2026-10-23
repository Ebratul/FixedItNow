import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { controlClasses, describedBy, Field } from "./field";

type SelectInputProps = Omit<ComponentProps<"select">, "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
  options: readonly string[];
  placeholder: string;
};

/** Native <select> with the shared control styling. */
export function SelectInput({
  id,
  label,
  hint,
  error,
  hideLabel,
  options,
  placeholder,
  className,
  ...props
}: SelectInputProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <div className="relative">
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cn(controlClasses, "appearance-none pr-10", className)}
          {...props}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-subtle"
          aria-hidden
        />
      </div>
    </Field>
  );
}
