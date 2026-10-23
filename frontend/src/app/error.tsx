"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container-page section-y">
      <ErrorState
        action={<Button onClick={reset}>Try again</Button>}
      >
        We could not load this page. Please try again.
      </ErrorState>
    </div>
  );
}
