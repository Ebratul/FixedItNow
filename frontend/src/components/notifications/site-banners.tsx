"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import type { PublicAnnouncement, Severity } from "./types";

type PlatformConfig = { maintenanceMode?: boolean; maintenanceMessage?: string };

const MAX_SHOWN = 3;
const TONE = { INFO: "info", WARNING: "warning", CRITICAL: "error" } as const;
const RANK: Record<Severity, number> = { CRITICAL: 0, WARNING: 1, INFO: 2 };
const KEY = (id: string) => `fin.dismissed.${id}`;

function wasDismissed(id: string) {
  try {
    return window.localStorage.getItem(KEY(id)) === "1";
  } catch {
    return false;
  }
}
function remember(id: string) {
  try {
    window.localStorage.setItem(KEY(id), "1");
  } catch {
    /* storage unavailable: dismissal lasts for this page view only */
  }
}

/**
 * Site-wide notices under the header: the maintenance notice and live announcements. Anything that fails renders
 * nothing, so these banners can never block a page. Critical announcements cannot be dismissed.
 */
export function SiteBanners() {
  const { data: session, isPending } = authClient.useSession();
  const signedIn = Boolean(session);
  const [maintenance, setMaintenance] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<PublicAnnouncement[]>([]);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let active = true;
    api<PlatformConfig>("/config/platform")
      .then((config) => {
        if (active) setMaintenance(config.maintenanceMode ? config.maintenanceMessage?.trim() || "The site is under maintenance." : null);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (isPending) return;
    let active = true;
    api<{ announcements: PublicAnnouncement[] }>(signedIn ? "/me/announcements" : "/announcements")
      .then((result) => {
        if (!active || !Array.isArray(result.announcements)) return;
        setAnnouncements(result.announcements);
        setDismissed(new Set(result.announcements.filter((a) => wasDismissed(a.id)).map((a) => a.id)));
      })
      .catch(() => {
        if (active) setAnnouncements([]);
      });
    return () => {
      active = false;
    };
  }, [isPending, signedIn]);

  function dismiss(id: string) {
    remember(id);
    setDismissed((current) => new Set(current).add(id));
  }

  const shown = announcements
    .filter((a) => a.severity === "CRITICAL" || !dismissed.has(a.id))
    .sort((a, b) => RANK[a.severity] - RANK[b.severity])
    .slice(0, MAX_SHOWN);

  if (!maintenance && shown.length === 0) return null;
  return (
    <div className="container-page space-y-2 py-3" data-testid="site-banners">
      {maintenance && (
        <Alert tone="warning" title="Scheduled maintenance">
          {maintenance}
        </Alert>
      )}
      {shown.map((a) => (
        <div key={a.id} className="flex items-start gap-2">
          <Alert tone={TONE[a.severity] ?? "info"} title={a.title} className="min-w-0 flex-1">
            <span className="break-words whitespace-pre-line">{a.body}</span>
          </Alert>
          {a.severity !== "CRITICAL" && (
            <button
              type="button"
              onClick={() => dismiss(a.id)}
              aria-label={`Dismiss: ${a.title}`}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-surface-strong hover:text-ink"
            >
              <X className="size-5" aria-hidden />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
