import Link from "next/link";
import { Wrench } from "lucide-react";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/cn";

/**
 * FixedItNow wordmark: tool glyph in a gradient navy tile + two-tone name.
 * `tone="light"` is for dark backgrounds such as the footer.
 */
export function Logo({
  className,
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  const light = tone === "light";
  return (
    <Link
      href="/"
      aria-label={`${SITE_NAME} home`}
      className={cn("group inline-flex items-center gap-2.5 rounded-control", className)}
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-control bg-gradient-to-br from-brand-600 to-brand-800 text-white shadow-card ring-1 transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-105",
          light ? "ring-white/20" : "ring-brand-900/10",
        )}
      >
        <Wrench className="size-5" aria-hidden />
      </span>
      <span
        className={cn(
          "text-xl font-extrabold tracking-tight",
          light ? "text-white" : "text-brand-900",
        )}
      >
        Fixed
        <span className={light ? "text-accent-300" : "text-accent-600"}>It</span>
        Now
      </span>
    </Link>
  );
}
