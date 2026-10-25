"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useState } from "react";
import { AuthGate } from "@/components/account/auth-gate";
import { Pager } from "@/components/community/community-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { isInAppPath, UNREAD_EVENT, type NotificationItem, type NotificationList } from "./types";

function announceUnread(count: number) {
  window.dispatchEvent(new CustomEvent(UNREAD_EVENT, { detail: count }));
}

function List() {
  const [page, setPage] = useState(1);
  const { state, reload, refresh, stale } = useApi<NotificationList>(`/notifications?page=${page}&pageSize=20`);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  async function markRead(id: string) {
    setError(undefined);
    try {
      const { unreadCount } = await api<{ unreadCount: number }>(`/notifications/${id}/read`, { method: "POST" });
      announceUnread(unreadCount);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't update that notification.");
    }
  }

  async function markAll() {
    setBusy("all");
    setError(undefined);
    try {
      const { unreadCount } = await api<{ unreadCount: number }>("/notifications/read-all", { method: "POST" });
      announceUnread(unreadCount);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't mark your notifications as read.");
    } finally {
      setBusy(null);
    }
  }

  if (state.status === "loading" || state.status === "unauthenticated") {
    return (
      <div aria-busy="true" aria-label="Loading notifications" className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }
  if (state.status === "error") {
    return <ErrorState action={<Button onClick={reload}>Try again</Button>}>{state.message}</ErrorState>;
  }

  const { notifications, unreadCount, total, totalPages } = state.data;
  if (total === 0) {
    return (
      <EmptyState icon={Bell} headingLevel={2} title="No notifications yet">
        Updates about your bookings, support requests and account will appear here.
      </EmptyState>
    );
  }
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted" aria-live="polite">
          {unreadCount === 0 ? "You're all caught up." : `${unreadCount} unread`}
        </p>
        <Button variant="secondary" onClick={markAll} loading={busy === "all"} disabled={unreadCount === 0}>
          Mark all read
        </Button>
      </div>
      {error && <Alert tone="error" className="mb-4">{error}</Alert>}
      <ul className={cn("space-y-3", stale && "opacity-60")} aria-busy={stale || undefined}>
        {notifications.map((n) => (
          <Row key={n.id} n={n} onRead={markRead} />
        ))}
      </ul>
      <div className="mt-8">
        <Pager page={page} totalPages={totalPages} onPage={setPage} label="Notification pages" />
      </div>
    </div>
  );
}

function Row({ n, onRead }: { n: NotificationItem; onRead: (id: string) => void }) {
  const unread = n.readAt === null;
  return (
    <li className={cn("rounded-card border p-4", unread ? "border-brand-300 bg-brand-50" : "border-line bg-canvas")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="min-w-0 text-base font-bold break-words text-ink">{n.title}</h2>
        {unread && <Badge tone="brand">Unread</Badge>}
      </div>
      <p className="mt-1 text-sm break-words whitespace-pre-line text-ink-muted">{n.body}</p>
      <p className="mt-2 text-xs text-ink-subtle">{formatDateTime(n.createdAt)}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {isInAppPath(n.link) && (
          <Link
            href={n.link}
            onClick={() => unread && onRead(n.id)}
            className="inline-flex min-h-11 items-center rounded-control border border-line-strong bg-canvas px-4 text-sm font-semibold text-ink hover:border-brand-300 hover:bg-brand-50"
          >
            Open
          </Link>
        )}
        {unread && (
          <Button variant="ghost" onClick={() => onRead(n.id)} aria-label={`Mark as read: ${n.title}`}>
            Mark read
          </Button>
        )}
      </div>
    </li>
  );
}

export function NotificationsList() {
  return (
    <AuthGate>
      {() => (
        <div>
          <h1 className="text-h1 font-extrabold text-brand-950">Notifications</h1>
          <p className="mt-3 text-lg text-ink-muted">Updates for you. Only you can see this list.</p>
          <div className="mt-8">
            <List />
          </div>
        </div>
      )}
    </AuthGate>
  );
}
