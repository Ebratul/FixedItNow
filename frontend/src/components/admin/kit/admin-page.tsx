"use client";

import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { useAdmin } from "@/components/admin/shell/admin-context";

/**
 * Page frame inside the admin shell: one h1, an optional description and action area. When the admin's
 * role lacks `permission` it shows a clear message instead of firing requests the API would refuse.
 * (The API check is the real one; this only avoids a confusing wall of 403s.)
 */
export function AdminPage({
  title,
  description,
  permission,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  permission?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { can, roleName } = useAdmin();
  const allowed = !permission || can(permission);
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-balance text-brand-950 md:text-3xl">{title}</h1>
          {description && <p className="mt-2 max-w-3xl text-ink-muted text-pretty">{description}</p>}
        </div>
        {allowed && actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="mt-6 space-y-6">
        {allowed ? (
          children
        ) : (
          <Alert tone="warning" title="Your role cannot open this page">
            {roleName ? `The “${roleName}” role does not include this permission.` : "Your account has no admin role."} Ask a super administrator if you need access.
          </Alert>
        )}
      </div>
    </div>
  );
}
