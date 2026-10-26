"use client";

import { Alert } from "@/components/ui/alert";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DEMO_FALLBACK_LABELS, type DemoKey } from "@/lib/demo";
import { DemoFeedback, DemoRoleCard, useDemoOptions, useDemoStart } from "./demo-cards";

const FALLBACK_DESCRIPTION: Record<DemoKey, string> = {
  customer: "Browse professionals, book a service and try a simulated payment.",
  worker: "See the booking requests and jobs a professional works with.",
  admin: "Look around the administration panel. It is read-only: nothing can be changed.",
};

/**
 * `/demo/<role>`: the deep link for one demo option. It never signs anyone in by itself (a GET must not create a
 * session); the visitor presses the button, which is the same POST as on the login page.
 *
 * A role that is not in the public list is hidden, not necessarily off: an administrator can keep it enabled for
 * people who have the direct link. We cannot tell from here, so the button is offered and the server decides.
 */
export function DemoRoleView({ role }: { role: DemoKey }) {
  const state = useDemoOptions();
  const { start, starting, error } = useDemoStart();

  if (state.status === "loading") {
    return <div aria-busy="true" aria-label="Loading the demo"><Skeleton className="h-40" /></div>;
  }
  if (state.status === "failed") {
    return (
      <div className="space-y-4">
        <Alert tone="error">We couldn&apos;t load the demo options. Please try again in a moment.</Alert>
        <LinkButton href="/login" variant="secondary" className="w-full">Back to log in</LinkButton>
      </div>
    );
  }

  const listed = state.options.find((option) => option.role === role);
  const label = listed?.label ?? DEMO_FALLBACK_LABELS[role];

  return (
    <div className="space-y-4">
      <DemoRoleCard
        role={role}
        label={label}
        description={listed?.description ?? FALLBACK_DESCRIPTION[role]}
        available={listed?.available ?? true}
        starting={starting}
        onStart={() => start(role, label)}
        headingLevel={2}
      />
      <DemoFeedback starting={starting} error={error} />
      <LinkButton href="/login" variant="ghost" className="w-full">Back to log in</LinkButton>
    </div>
  );
}
