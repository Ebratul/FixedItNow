import "server-only";

export class ServerApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Server-side fetch of PUBLIC backend endpoints (no cookies are forwarded, so
 * these calls can never return per-user data). Always uncached: discovery data
 * must reflect publication/suspension immediately.
 */
export async function serverApi<T>(path: string): Promise<T> {
  const base = process.env.BACKEND_URL ?? "http://localhost:4000";
  let response: Response;
  try {
    response = await fetch(`${base}/api/v1${path}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
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
