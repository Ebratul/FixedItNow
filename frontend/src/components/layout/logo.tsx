import Link from "next/link";
import { Wrench } from "lucide-react";
import { SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/cn";

/** FixedItNow wordmark: tool glyph in a navy tile + two-tone name. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label={`${SITE_NAME} home`}
      className={cn("inline-flex items-center gap-2.5 rounded-control", className)}
    >
      <span className="flex size-9 items-center justify-center rounded-control bg-brand-700 text-white">
        <Wrench className="size-5" aria-hidden />
      </span>
      <span className="text-xl font-extrabold tracking-tight text-brand-900">
        Fixed<span className="text-accent-600">It</span>Now
      </span>
    </Link>
  );
}
