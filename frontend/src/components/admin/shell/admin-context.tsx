"use client";

import { createContext, useContext, type ReactNode } from "react";
import { hasPermission } from "@/lib/admin/nav";
import type { Me } from "@/lib/use-api";

type AdminContextValue = { me: Me; permissions: readonly string[]; roleName: string | null; can: (permission: string) => boolean };
const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ me, children }: { me: Me; children: ReactNode }) {
  const permissions = me.admin?.permissions ?? [];
  const value: AdminContextValue = { me, permissions, roleName: me.admin?.role?.name ?? null, can: (p) => hasPermission(permissions, p) };
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

/** The signed-in administrator. `can()` only hides controls; the API enforces everything. */
export function useAdmin(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used inside the admin shell");
  return ctx;
}
