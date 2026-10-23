import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type CardProps = ComponentProps<"div"> & { interactive?: boolean };

/** Bordered surface. `interactive` adds a hover lift for clickable cards. */
export function Card({ interactive, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-canvas shadow-card",
        interactive &&
          "transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift",
        className,
      )}
      {...props}
    />
  );
}
