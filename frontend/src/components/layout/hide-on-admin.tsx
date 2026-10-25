"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** The public footer does not belong in the admin panel. */
export function HideOnAdmin({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return pathname.startsWith("/admin") ? null : <>{children}</>;
}
