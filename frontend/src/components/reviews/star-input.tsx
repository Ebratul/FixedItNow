"use client";

import { Star } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * 1-5 rating as a native radio group (keyboard: arrow keys; screen readers get
 * "3 stars"). The value is a UI convenience only; the server validates it.
 */
export function StarInput({ value, onChange, disabled, error }: { value: number; onChange: (value: number) => void; disabled?: boolean; error?: string }) {
  const name = useId();
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="text-sm font-semibold text-ink">Your rating</legend>
      <div className="mt-1.5 flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="relative cursor-pointer">
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="peer sr-only"
              aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            />
            <Star
              aria-hidden
              className={cn(
                "size-9 rounded-control p-1 text-amber-400 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600",
                n <= value ? "fill-amber-400" : "fill-transparent text-ink-subtle",
              )}
            />
          </label>
        ))}
      </div>
      {error && <p role="alert" className="mt-1 text-sm font-medium text-danger">{error}</p>}
    </fieldset>
  );
}
