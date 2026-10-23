import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { controlClasses, describedBy, Field } from "./field";

type TextInputProps = Omit<ComponentProps<"input">, "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  hideLabel?: boolean;
};

export function TextInput({
  id,
  label,
  hint,
  error,
  hideLabel,
  className,
  ...props
}: TextInputProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} hideLabel={hideLabel}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(controlClasses, className)}
        {...props}
      />
    </Field>
  );
}
