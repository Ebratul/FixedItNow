import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "left",
  as: Tag = "h2",
  action,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2";
  action?: ReactNode;
}) {
  const centered = align === "center";
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        centered && "items-center text-center sm:flex-col sm:items-center",
      )}
    >
      <div className={cn("max-w-2xl", centered && "mx-auto")}>
        {eyebrow && (
          <p className="eyebrow mb-3 text-accent-700">
            <span
              aria-hidden
              className="h-0.5 w-6 rounded-full bg-accent-500"
            />
            {eyebrow}
          </p>
        )}
        <Tag
          id={id}
          className={cn(
            "font-extrabold text-balance text-ink",
            Tag === "h1" ? "text-h1" : "text-h2",
          )}
        >
          {title}
        </Tag>
        {description && (
          <p className="mt-3 text-lg text-ink-muted text-pretty">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
