"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { controlClasses, describedBy, Field } from "./field";

type PasswordInputProps = Omit<ComponentProps<"input">, "id" | "type"> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

/** Password field with an accessible show/hide toggle. */
export function PasswordInput({ id, label, hint, error, className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, hint, error)}
          className={cn(controlClasses, "pr-12", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute top-1/2 right-1 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-control text-ink-subtle hover:bg-surface-strong hover:text-ink"
        >
          {visible ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>
    </Field>
  );
}
