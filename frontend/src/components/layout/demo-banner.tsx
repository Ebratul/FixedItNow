"use client";

import { FlaskConical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { DEMO_FALLBACK_LABELS, isDemoKey, type DemoKey } from "@/lib/demo";
import type { Me } from "@/lib/use-api";

/**
 * "Demo mode" bar under the header. It asks the server who the signed-in user is (one GET /me per signed-in user,
 * and none while signed out) and shows itself only for a demo session. Loading and errors render nothing, so it
 * can never block a page. It sits in the root layout, so it also appears on the admin pages.
 */
export function DemoBanner() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id ?? null;
  const router = useRouter();
  const [found, setFound] = useState<{ userId: string; role: DemoKey | null }>();
  const [exiting, setExiting] = useState(false);
  const [error, setError] = useState<string>();
  const locked = useRef(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    api<Me>("/me")
      .then((me) => {
        const demoRole = me.demo?.role;
        if (active) setFound({ userId, role: isDemoKey(demoRole) ? demoRole : null });
      })
      .catch(() => active && setFound({ userId, role: null }));
    return () => {
      active = false;
    };
  }, [userId]);

  const role = userId && found?.userId === userId ? found.role : null;
  if (!role) return null;
  const label = DEMO_FALLBACK_LABELS[role];

  async function exit() {
    if (locked.current) return;
    locked.current = true;
    setExiting(true);
    setError(undefined);
    try {
      const result = await authClient.signOut();
      if (!result?.error) {
        router.replace("/login");
        router.refresh();
        return; // stay locked while navigating
      }
    } catch {
      /* reported below */
    }
    setError("We couldn't exit the demo. Please try again.");
    locked.current = false;
    setExiting(false);
  }

  return (
    <div role="region" aria-label="Demo mode" className="border-b border-amber-400 bg-amber-300 text-brand-950">
      <div className="container-page flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
        <p className="flex items-start gap-2 text-sm font-semibold">
          <FlaskConical className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Demo mode — you&apos;re exploring as {label} with fictional data. Nothing here is real.
          </span>
        </p>
        <div className="flex items-center gap-3">
          {error && <p role="alert" className="text-sm font-semibold">{error}</p>}
          <Button size="md" loading={exiting} onClick={exit}>
            {exiting ? "Exiting…" : "Exit demo"}
          </Button>
        </div>
      </div>
    </div>
  );
}
