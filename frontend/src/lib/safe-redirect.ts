/**
 * Returns `value` only if it is a same-site relative path, otherwise `fallback`.
 *
 * Used for the post-login `?next=` parameter so it cannot be turned into an
 * open redirect. Rejects absolute URLs, protocol-relative URLs (`//evil.com`),
 * backslash tricks (`/\evil.com`), and control characters.
 */
export function safeNext(
  value: string | null | undefined,
  fallback = "/account",
): string {
  if (!value) return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  // Never bounce back into the auth pages themselves.
  if (/^\/(login|register|forgot-password|reset-password)(\/|\?|$)/.test(value)) {
    return fallback;
  }
  return value;
}
