import { NextResponse, type NextRequest } from "next/server";

/**
 * OPTIMISTIC route gate (UX only, not security).
 *
 * Sends visitors without a session cookie to /login before the page loads.
 * It cannot tell whether the cookie is valid or expired: every API call is
 * authenticated and authorised by the backend, which is the real boundary.
 */
const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

export function proxy(request: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) return NextResponse.next();

  const url = request.nextUrl.clone();
  const next = request.nextUrl.pathname + request.nextUrl.search;
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/onboarding/:path*", "/account/:path*"],
};
