import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { LinkButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/** Honest placeholder for routes whose feature ships in a later step. */
export function ComingSoon({
  icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="container-page section-y">
      <EmptyState
        icon={icon}
        title={title}
        headingLevel={1}
        className="mx-auto max-w-2xl"
        action={<LinkButton href="/">Back to home</LinkButton>}
      >
        {children}
      </EmptyState>
    </div>
  );
}
