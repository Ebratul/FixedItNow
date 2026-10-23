import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { controlClasses, describedBy, Field } from "./field";

type TextAreaProps = Omit<ComponentProps<"textarea">, "id"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

export function TextArea({ id, label, hint, error, className, ...props }: TextAreaProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <textarea
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error)}
        className={cn(controlClasses, "min-h-32 py-2.5 leading-relaxed", className)}
        {...props}
      />
    </Field>
  );
}
