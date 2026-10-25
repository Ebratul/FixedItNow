import {
  Activity, BadgeDollarSign, Bell, Bot, CalendarCheck, FileClock, Flag, Gavel, HardHat, KeyRound, LayoutDashboard,
  LifeBuoy, Settings, Tags, Users, Wallet, type LucideIcon,
} from "lucide-react";

/**
 * The admin navigation. `permission` is the ONE permission whose absence hides the item. This is a
 * convenience: every API call is authorised again on the server, and a page opened by URL shows the
 * server's answer (403) if the admin lacks access.
 */
export type AdminNavItem = { href: string; label: string; icon: LucideIcon; permission: string };
export type AdminNavGroup = { title: string; items: AdminNavItem[] };

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
      { href: "/admin/system", label: "Operations", icon: Activity, permission: "ops.read" },
    ],
  },
  {
    title: "People",
    items: [
      { href: "/admin/users", label: "Users", icon: Users, permission: "users.read" },
      { href: "/admin/roles", label: "Admin roles", icon: KeyRound, permission: "roles.read" },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { href: "/admin/workers", label: "Worker applications", icon: HardHat, permission: "workers.read" },
      { href: "/admin/categories", label: "Service categories", icon: Tags, permission: "catalog.read" },
      { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck, permission: "bookings.read" },
      { href: "/admin/disputes", label: "Disputes", icon: Gavel, permission: "disputes.read" },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/admin/payments", label: "Payments & refunds", icon: Wallet, permission: "payments.read" },
      { href: "/admin/finance", label: "Financial reports", icon: BadgeDollarSign, permission: "finance.reports" },
    ],
  },
  {
    title: "Community & support",
    items: [
      { href: "/admin/support", label: "Support tickets", icon: LifeBuoy, permission: "support.read" },
      { href: "/admin/moderation", label: "Moderation", icon: Flag, permission: "moderation.read" },
    ],
  },
  {
    title: "Platform",
    items: [
      { href: "/admin/ai", label: "AI assistant", icon: Bot, permission: "ai.read" },
      { href: "/admin/announcements", label: "Announcements", icon: Bell, permission: "notifications.manage" },
      { href: "/admin/audit", label: "Audit log", icon: FileClock, permission: "audit.read" },
      { href: "/admin/settings", label: "Settings", icon: Settings, permission: "settings.read" },
    ],
  },
];

export const hasPermission = (permissions: readonly string[] | undefined, permission: string) => Boolean(permissions?.includes(permission));

/** The nav item that owns a pathname (longest matching href). */
export function activeItem(pathname: string): AdminNavItem | undefined {
  return ADMIN_NAV.flatMap((g) => g.items)
    .filter((i) => (i.href === "/admin" ? pathname === "/admin" : pathname === i.href || pathname.startsWith(`${i.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)[0];
}

