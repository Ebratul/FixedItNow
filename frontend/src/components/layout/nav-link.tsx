"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Navigation link that reflects the current route with aria-current. */
export function NavLink({
  href,
  className,
  activeClassName,
  onNavigate,
  children,
}: {
  href: string;
  className?: string;
  activeClassName?: string;
  onNavigate?: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(className, active && activeClassName)}
    >
      {children}
    </Link>
  );
}
