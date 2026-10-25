import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/booking-types";
import { ARRIVED_LABEL, STATUS_LABELS } from "@/lib/format";

/** `arrivedAt` refines CONFIRMED into "Professional arrived" (a report by the professional, not a verified location). */
export function StatusBadge({ status, arrivedAt }: { status: BookingStatus; arrivedAt?: string | null }) {
  const { label, tone } = status === "CONFIRMED" && arrivedAt ? ARRIVED_LABEL : STATUS_LABELS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
