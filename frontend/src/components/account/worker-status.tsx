import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { WorkerProfile } from "@/lib/use-api";

export const VERIFICATION_LABELS: Record<
  WorkerProfile["verificationStatus"],
  { label: string; tone: BadgeTone; description: string }
> = {
  NOT_SUBMITTED: {
    label: "Not submitted",
    tone: "neutral",
    description: "Finish your profile and submit it for review.",
  },
  PENDING: {
    label: "Awaiting review",
    tone: "warning",
    description: "Your profile was submitted and is waiting for a reviewer. You will not be listed publicly until it is approved.",
  },
  VERIFIED: {
    label: "Approved",
    tone: "success",
    description: "A reviewer approved your profile. Public listings are not live yet.",
  },
  REJECTED: {
    label: "Not approved",
    tone: "danger",
    description: "A reviewer did not approve this profile.",
  },
  RESUBMISSION_REQUIRED: {
    label: "Changes requested",
    tone: "warning",
    description: "A reviewer asked for changes. Update your profile and submit it again.",
  },
};

export function VerificationBadge({ status }: { status: WorkerProfile["verificationStatus"] }) {
  const { label, tone } = VERIFICATION_LABELS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
