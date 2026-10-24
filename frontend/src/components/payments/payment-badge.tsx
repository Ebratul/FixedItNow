import { Badge } from "@/components/ui/badge";
import { describePayment } from "@/lib/payment-status";
import type { PaymentView } from "@/lib/payment-types";

export function PaymentBadge({ payment }: { payment: Pick<PaymentView, "status" | "provider" | "needsAttention" | "bookingIneligible" | "refundedAmountBdt"> }) {
  const { badge, tone } = describePayment(payment);
  return <Badge tone={tone}>{badge}</Badge>;
}
