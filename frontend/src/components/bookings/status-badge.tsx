import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/booking-types";
import { STATUS_LABELS } from "@/lib/format";

export function StatusBadge({ status }: { status: BookingStatus }) {
  const { label, tone } = STATUS_LABELS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
