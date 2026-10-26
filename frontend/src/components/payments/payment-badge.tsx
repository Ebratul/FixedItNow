import { Badge } from "@/components/ui/badge";
import { describePayment } from "@/lib/payment-status";
import type { PaymentView } from "@/lib/payment-types";

export function PaymentBadge({ payment }: { payment: Pick<PaymentView, "status" | "provider" | "needsAttention" | "bookingIneligible" | "refundedAmountBdt"> }) {
  const { badge, tone } = describePayment(payment);
  if (payment.provider !== "DEMO") return <Badge tone={tone}>{badge}</Badge>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={tone}>{badge}</Badge>
      <Badge tone="neutral">Simulated</Badge>
    </span>
  );
}
