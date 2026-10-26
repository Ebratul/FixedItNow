import { ApiError } from "@/lib/api";

/**
 * A 403 that carries no code means "no permission", so the shared API client words it generically. These codes carry
 * the real reason, and these texts mirror the server's wording for each one.
 */
const FORBIDDEN_REASONS: Record<string, string> = {
  SELF_ACTION: "You cannot do this to your own account.",
  TARGET_TOO_POWERFUL: "You cannot change an administrator who has more permissions than you.",
  ROLE_TOO_POWERFUL: "You can only assign, change or delete roles whose permissions you hold yourself.",
  PERMISSION_ESCALATION: "You can only give a role permissions that you hold yourself.",
};

/**
 * The demo administrator is read-only (DEMO_READ_ONLY) and other demo restrictions say why (DEMO_RESTRICTED). The
 * server's own sentence is the message, so a visitor sees what the demo refuses; these are used only if it is missing.
 */
const DEMO_REFUSALS: Record<string, string> = {
  DEMO_READ_ONLY: "The demo administrator is read-only: changes are disabled in the demo.",
  DEMO_RESTRICTED: "This is not available in the demo.",
};

/** A readable message for a failed admin call: known refusal code, then field errors, then the server's message. */
export function adminErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code && FORBIDDEN_REASONS[error.code]) return FORBIDDEN_REASONS[error.code]!;
    if (error.code && DEMO_REFUSALS[error.code]) return error.message.trim() || DEMO_REFUSALS[error.code]!;
    const fields = Object.values(error.fieldErrors);
    if (fields.length > 0) return fields.join(" ");
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

/** For dialogs: they show `error.message`, so re-throw the readable version. */
export const readableError = (error: unknown) => new Error(adminErrorMessage(error));
