"use client";

import { DemoFeedback, DemoRoleCard, useDemoOptions, useDemoStart } from "./demo-cards";

/**
 * "Explore Demo" on the login page: one card per option an administrator made visible. It renders NOTHING (not even
 * its heading) while loading, when no option is visible, or when the list cannot be loaded, so a site with the demo
 * switched off looks exactly as it did before.
 */
export function DemoLoginSection() {
  const state = useDemoOptions();
  const { start, starting, error } = useDemoStart();

  if (state.status !== "ready" || state.options.length === 0) return null;

  return (
    <section aria-labelledby="demo-heading" className="mt-8 border-t border-line pt-6">
      <h2 id="demo-heading" className="text-lg font-extrabold text-brand-950">Explore Demo</h2>
      <p className="mt-1 text-sm text-ink-muted">
        No account or password needed. Look around as a demo user: everything you see is fictional and nothing is real.
      </p>
      <ul className="mt-4 space-y-3">
        {state.options.map((option) => (
          <li key={option.role}>
            <DemoRoleCard {...option} starting={starting} onStart={() => start(option.role, option.label)} />
          </li>
        ))}
      </ul>
      <DemoFeedback starting={starting} error={error} />
    </section>
  );
}
