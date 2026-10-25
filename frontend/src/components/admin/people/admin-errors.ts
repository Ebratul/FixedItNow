import { ApiError } from "@/lib/api";

/**
 * The shared API client replaces every 403 message with a generic one, which would hide WHY the server refused
 * (the codes below carry the real reason). These texts mirror the server's wording for each code.
 */
const FORBIDDEN_REASONS: Record<string, string> = {
  SELF_ACTION: "You cannot do this to your own account.",
  TARGET_TOO_POWERFUL: "You cannot change an administrator who has more permissions than you.",
  ROLE_TOO_POWERFUL: "You can only assign, change or delete roles whose permissions you hold yourself.",
  PERMISSION_ESCALATION: "You can only give a role permissions that you hold yourself.",
};

/** A readable message for a failed admin call: known refusal code, then field errors, then the server's message. */
export function adminErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code && FORBIDDEN_REASONS[error.code]) return FORBIDDEN_REASONS[error.code]!;
    const fields = Object.values(error.fieldErrors);
    if (fields.length > 0) return fields.join(" ");
    return error.message;
  }
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

/** For dialogs: they show `error.message`, so re-throw the readable version. */
export const readableError = (error: unknown) => new Error(adminErrorMessage(error));
