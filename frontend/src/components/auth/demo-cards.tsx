"use client";

import { useRouter } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { demoErrorMessage, fetchDemoOptions, startDemoSession, type DemoKey, type DemoOption } from "@/lib/demo";

export type DemoOptionsState = { status: "loading" } | { status: "ready"; options: DemoOption[] } | { status: "failed" };

/** Loads the demo options once, client side. The list is public and never cached by the browser (server sends no-store). */
export function useDemoOptions(): DemoOptionsState {
  const [state, setState] = useState<DemoOptionsState>({ status: "loading" });
  useEffect(() => {
    let active = true;
    fetchDemoOptions()
      .then((options) => active && setState({ status: "ready", options }))
      .catch(() => active && setState({ status: "failed" }));
    return () => {
      active = false;
    };
  }, []);
  return state;
}

/**
 * Starting a demo session. At most one request runs at a time: the ref (not state) is the guard, so two clicks in the
 * same tick cannot both pass. After success the lock is kept while the browser navigates.
 */
export function useDemoStart() {
  const router = useRouter();
  const locked = useRef(false);
  const [starting, setStarting] = useState<DemoKey | null>(null);
  const [error, setError] = useState<string>();

  async function start(role: DemoKey, label: string) {
    if (locked.current) return;
    locked.current = true;
    setStarting(role);
    setError(undefined);
    try {
      const { redirectTo } = await startDemoSession(role);
      router.replace(redirectTo);
      router.refresh();
      return; // stay locked while navigating
    } catch (e) {
      setError(demoErrorMessage(e, label));
    }
    locked.current = false;
    setStarting(null);
  }

  return { start, starting, error };
}

/** One demo role: what it is, and a button that signs in as it. The click is a POST; nothing happens on page load. */
export function DemoRoleCard({
  role,
  label,
  description,
  available,
  starting,
  onStart,
  headingLevel = 3,
}: {
  role: DemoKey;
  label: string;
  description: string;
  available: boolean;
  /** The role whose request is in flight, if any. Every card is disabled while one is. */
  starting: DemoKey | null;
  onStart: () => void;
  headingLevel?: 2 | 3;
}) {
  const busy = starting !== null;
  const Heading = `h${headingLevel}` as const;
  return (
    <Card className="flex flex-col gap-3 p-5" data-demo-role={role}>
      <div className="flex flex-wrap items-center gap-2">
        <FlaskConical className="size-5 shrink-0 text-brand-600" aria-hidden />
        <Heading className="text-base font-bold text-ink">{label}</Heading>
        {!available && <Badge tone="neutral">Unavailable</Badge>}
      </div>
      {description && <p className="text-sm text-ink-muted">{description}</p>}
      {available ? (
        <Button variant="secondary" className="w-full" loading={starting === role} disabled={busy} onClick={onStart}>
          {starting === role ? "Starting…" : `Continue as ${label}`}
        </Button>
      ) : (
        <>
          <p className="text-sm text-ink-subtle">This demo is switched off right now. Please check back later.</p>
          <Button variant="secondary" className="w-full" disabled>
            Continue as {label}
          </Button>
        </>
      )}
    </Card>
  );
}

/** Announces progress and failures to assistive technology; errors are an alert, progress is a polite status. */
export function DemoFeedback({ starting, error }: { starting: DemoKey | null; error?: string }) {
  return (
    <>
      <p role="status" className="sr-only">{starting ? "Starting the demo…" : ""}</p>
      {error && <Alert tone="error" className="mt-3">{error}</Alert>}
    </>
  );
}
