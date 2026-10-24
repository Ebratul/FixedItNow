"use client";

import { Heart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { setFavorite, syncFavoritesUser, useFavoritesState } from "@/lib/favorites-store";

/**
 * Save/unsave a professional. State lives on the server; this only mirrors it.
 * Signed-out visitors are sent to log in and returned to this page.
 */
export function FavoriteButton({
  workerId,
  workerName,
  showLabel = false,
  className,
}: {
  workerId: string;
  workerName: string;
  showLabel?: boolean;
  className?: string;
}) {
  const { data: session, isPending } = authClient.useSession();
  const favorites = useFavoritesState();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!isPending) syncFavoritesUser(userId);
  }, [isPending, userId]);

  const saved = favorites.status === "ready" && favorites.ids.has(workerId);
  const unavailable = favorites.status === "error";

  async function toggle() {
    if (busy) return;
    if (!session) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (favorites.status !== "ready") return;
    setBusy(true);
    setError(false);
    try {
      await setFavorite(workerId, !saved);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const label = saved ? `Remove ${workerName} from favorites` : `Save ${workerName} to favorites`;
  return (
    <span className={cn("inline-flex flex-col items-end", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={saved}
        aria-label={label}
        title={label}
        disabled={busy || unavailable || (!!session && favorites.status !== "ready")}
        className={cn(
          "inline-flex min-h-11 items-center justify-center gap-2 rounded-control border text-sm font-semibold transition-colors disabled:opacity-60",
          showLabel ? "px-4" : "min-w-11",
          saved
            ? "border-danger/30 bg-danger-soft text-danger"
            : "border-line-strong bg-canvas text-ink-muted hover:border-brand-300 hover:text-ink",
        )}
      >
        <Heart className={cn("size-5", saved && "fill-current")} aria-hidden />
        {showLabel && <span>{saved ? "Saved" : "Save"}</span>}
      </button>
      <span role="status" className={cn("text-xs text-danger", !error && "sr-only")}>
        {error ? "Couldn't update favorites. Try again." : ""}
      </span>
    </span>
  );
}
