import { cn } from "@/lib/cn";

/** Loading placeholder. Decorative; pair with an aria-busy region or status text. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-control bg-surface-strong", className)}
    />
  );
}
