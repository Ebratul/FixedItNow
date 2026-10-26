import type { BadgeTone } from "@/components/ui/badge";
import { isPaymentReference } from "./route-params";
import type { PaymentStatus, PaymentView, ProviderId, RefundStatus } from "./payment-types";

export const PROVIDER_LABELS: Record<ProviderId, string> = { BKASH: "bKash", DEMO: "Simulated payment (demo)" };

/** Shown wherever a demo payment appears, so a simulated payment can never be mistaken for a real one. */
export const SIMULATED_NOTE = "Simulated — no money moves";

/** A demo payment waits for the customer to pick an outcome on the demo payment page while it is in these states. */
export const awaitsDemoOutcome = (p: Pick<PaymentView, "provider" | "status">) => p.provider === "DEMO" && (p.status === "INITIATED" || p.status === "PROCESSING");

/** Statuses where the outcome is still being decided: the page keeps asking the server. */
export const OPEN_STATUSES: readonly PaymentStatus[] = ["PENDING", "INITIATED", "PROCESSING"];
export const isOpen = (status: PaymentStatus) => OPEN_STATUSES.includes(status);

export type StatusCopy = {
  badge: string;
  tone: BadgeTone;
  headline: string;
  message: string;
  alert: "success" | "info" | "warning" | "error";
};

/**
 * Words for a payment, derived ONLY from the status the server reports.
 * "verified" appears for SUCCEEDED and the refund states that can only follow
 * it, never for anything else, and never from a URL parameter.
 */
export function describePayment(p: Pick<PaymentView, "status" | "provider" | "needsAttention" | "bookingIneligible" | "refundedAmountBdt">): StatusCopy {
  const provider = PROVIDER_LABELS[p.provider];
  if (p.provider === "DEMO") {
    // Nothing is sent to an outside provider, so none of the provider wording applies.
    switch (p.status) {
      case "SUCCEEDED":
        if (!p.bookingIneligible) return { badge: "Verified", tone: "success", alert: "success", headline: "Simulated payment completed", message: "This was a demo payment you marked as successful. No real money moved." };
        break;
      case "INITIATED":
      case "PENDING":
      case "PROCESSING":
        return { badge: "Waiting", tone: "warning", alert: "info", headline: "Waiting for you to finish the simulated payment", message: "Open the demo payment page and choose an outcome. No real money is involved." };
      case "FAILED":
        return { badge: "Not completed", tone: "danger", alert: "error", headline: "Simulated payment failed", message: "You chose to fail this demo payment. You can try again; no real money moved." };
      case "CANCELLED":
        return { badge: "Cancelled", tone: "neutral", alert: "info", headline: "Simulated payment cancelled", message: "You cancelled this demo payment. You can start a new one; no real money moved." };
      default:
        break;
    }
  }
  switch (p.status) {
    case "SUCCEEDED":
      return p.bookingIneligible
        ? {
            badge: "Paid", tone: "warning", alert: "warning",
            headline: "Payment verified, but the booking is no longer active",
            message: "We received and verified your payment, but this booking was cancelled or is on hold, so it was not reactivated. You can ask for a refund below.",
          }
        : { badge: "Verified", tone: "success", alert: "success", headline: "Payment has been verified", message: `${provider} confirmed your payment to us.` };
    case "PARTIALLY_REFUNDED":
      return { badge: "Partly refunded", tone: "brand", alert: "info", headline: "Payment verified; part of it has been refunded", message: "The refunded part was confirmed by the payment provider." };
    case "REFUNDED":
      return { badge: "Refunded", tone: "neutral", alert: "info", headline: "This payment has been refunded", message: "The refund was confirmed by the payment provider." };
    case "PENDING":
    case "PROCESSING":
      return { badge: "Verifying", tone: "warning", alert: "info", headline: "Payment is being verified", message: `We are confirming this payment with ${provider}. This can take a minute. You can leave this page; the result will be here when it is ready.` };
    case "INITIATED":
      return { badge: "Waiting", tone: "warning", alert: "info", headline: "Payment status is still pending", message: `We have not had confirmation from ${provider} yet. If you have not finished paying, you can go back to ${provider} and complete it.` };
    case "REQUIRES_REVIEW":
      return { badge: "Under review", tone: "warning", alert: "warning", headline: "Your payment needs a manual check", message: "The payment provider reported a payment that we could not match automatically. Our team will review it. Please do not pay again." };
    case "CANCELLED":
      return { badge: "Cancelled", tone: "neutral", alert: "info", headline: "Payment was cancelled", message: "This attempt was cancelled. If money left your account, we will find it when we verify with the provider; you do not need to pay again for that." };
    case "EXPIRED":
      return { badge: "Expired", tone: "neutral", alert: "info", headline: "This payment attempt expired", message: "It was not completed in time. You can start a new payment." };
    case "FAILED":
    default:
      return { badge: "Not completed", tone: "danger", alert: "error", headline: "Payment could not be completed", message: "The payment did not go through. You can try again." };
  }
}

export const REFUND_COPY: Record<RefundStatus, { label: string; tone: BadgeTone; detail: string }> = {
  REQUESTED: { label: "Waiting for review", tone: "warning", detail: "Our team has not decided yet. Nothing has been refunded." },
  APPROVED: { label: "Approved, not refunded yet", tone: "brand", detail: "Approved by our team. The money has not been sent back yet; this page changes when the payment provider confirms it." },
  PROCESSING: { label: "Being processed", tone: "brand", detail: "The payment provider is processing it. It is only final once the provider confirms." },
  SUCCEEDED: { label: "Refunded", tone: "success", detail: "The payment provider confirmed the refund." },
  FAILED: { label: "Refund failed", tone: "danger", detail: "The provider could not complete this refund. Our team can look into it." },
  REJECTED: { label: "Declined", tone: "neutral", detail: "This request was declined." },
};

export const EVENT_COPY: Record<string, string> = {
  "payment.created": "Payment started",
  "payment.initiated": "Sent to the payment provider",
  "payment.succeeded": "Payment verified",
  "payment.failed": "Payment not completed",
  "payment.cancelled": "Payment cancelled",
  "payment.expired": "Attempt expired",
  "payment.requires_review": "Sent for manual review",
  "refund.requested": "Refund requested",
  "refund.approved": "Refund approved",
  "refund.rejected": "Refund declined",
  "refund.processing": "Refund sent to the provider",
  "refund.succeeded": "Refund confirmed by the provider",
  "refund.failed": "Refund failed",
};

const DEMO_CHECKOUT_PATH = /^\/payments\/demo\/([^/?#]+)$/;

/** True for this app's own simulated checkout page, `/payments/demo/<reference>`, and nothing else. */
function isDemoCheckoutPath(path: string) {
  const reference = DEMO_CHECKOUT_PATH.exec(path)?.[1];
  return reference !== undefined && isPaymentReference(reference);
}

/**
 * Only follow a provider URL that is https (the backend already limits it to the provider's hosts), or the app's own
 * simulated checkout page: `/payments/demo/<reference>`, relative or absolute with THIS page's origin. A demo URL on
 * any other origin that is not https is refused.
 */
export function isSafeCheckoutUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  if (isDemoCheckoutPath(url)) return true;
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) return false;
    if (parsed.protocol === "https:") return true;
    const origin = typeof window === "undefined" ? undefined : window.location?.origin;
    return Boolean(origin) && parsed.origin === origin && !parsed.search && !parsed.hash && isDemoCheckoutPath(parsed.pathname);
  } catch {
    return false;
  }
}
