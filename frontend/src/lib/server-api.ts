import "server-only";
import { cookies } from "next/headers";

export class ServerApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Better Auth's session cookie, plain and `__Secure-` (production over HTTPS). */
const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

/**
 * Server-side fetch of PUBLIC backend endpoints. These calls never return per-user data: the only thing forwarded from
 * the visitor is the session cookie, and the public routes use it for one purpose, to pick the data REALM (a demo visitor
 * browses the fictional demo professionals, everyone else the real ones; docs/DEMO.md). Every other cookie and header
 * stays behind. Always uncached: discovery data must reflect publication/suspension immediately.
 */
export async function serverApi<T>(path: string): Promise<T> {
  const base = process.env.BACKEND_URL ?? "http://localhost:4000";
  const jar = await cookies();
  const session = SESSION_COOKIES.map((name) => jar.get(name)).find(Boolean);
  let response: Response;
  try {
    response = await fetch(`${base}/api/v1${path}`, {
      cache: "no-store",
      headers: { Accept: "application/json", ...(session && { Cookie: `${session.name}=${encodeURIComponent(session.value)}` }) },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ServerApiError(0, "The service is temporarily unavailable.");
  }
  if (!response.ok) {
    throw new ServerApiError(response.status, response.status === 404 ? "Not found" : "Request failed");
  }
  return (await response.json()) as T;
}
