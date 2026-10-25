"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { UNREAD_EVENT } from "./types";

const POLL_MS = 60_000;

/**
 * Header bell with the unread count. Mount it only while signed in: it polls every 60 s while the tab is visible
 * and on window focus, and stops when unmounted (sign-out). Errors are swallowed: a bell must never break the header.
 */
export function NotificationBell() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (document.visibilityState === "hidden") return;
      try {
        const { unreadCount } = await api<{ unreadCount: number }>("/notifications/unread-count");
        if (active && Number.isFinite(unreadCount)) setCount(unreadCount);
      } catch {
        /* keep the last known count */
      }
    }
    const onEvent = (event: Event) => {
      const value = (event as CustomEvent<number>).detail;
      if (active && typeof value === "number") setCount(value);
    };
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    window.addEventListener("focus", load);
    document.addEventListener("visibilitychange", load);
    window.addEventListener(UNREAD_EVENT, onEvent);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", load);
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener(UNREAD_EVENT, onEvent);
    };
  }, []);

  const label = count === null ? "Notifications" : `Notifications, ${count} unread`;
  return (
    <Link
      href="/account/notifications"
      aria-label={label}
      className="relative inline-flex size-11 items-center justify-center rounded-control text-ink-muted hover:bg-surface-strong hover:text-ink"
    >
      <Bell className="size-5" aria-hidden />
      {count !== null && count > 0 && (
        <span
          aria-hidden
          className="absolute top-1 right-1 flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[0.7rem] leading-5 font-bold text-white"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
