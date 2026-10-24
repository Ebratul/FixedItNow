export type FieldErrors = Record<string, string>;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly fieldErrors: FieldErrors = {},
    /** Stable machine-readable code from the backend (e.g. SLOT_UNAVAILABLE). */
    public readonly code?: string,
  ) {
    super(message);
  }
}

/**
 * Minimal typed fetch for the backend API (same origin, cookie session).
 * Throws ApiError for non-2xx responses, mapping the backend's validation
 * `errors: [{ path, message }]` into field errors.
 */
export async function api<T>(
  path: string,
  init: { method?: "GET" | "PUT" | "POST" | "DELETE"; body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method: init.method ?? "GET",
      credentials: "same-origin",
      headers:
        init.body === undefined && !init.headers
          ? undefined
          : { ...(init.body === undefined ? {} : { "Content-Type": "application/json" }), ...init.headers },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "We couldn't reach the server. Check your connection and try again.");
  }

  if (response.ok) return (await response.json()) as T;

  let body: { message?: unknown; code?: unknown; errors?: { path: string; message: string }[] } = {};
  try {
    body = await response.json();
  } catch {
    /* non-JSON error body */
  }
  const fieldErrors: FieldErrors = {};
  for (const error of body.errors ?? []) {
    if (error.path && !(error.path in fieldErrors)) fieldErrors[error.path] = error.message;
  }
  throw new ApiError(
    response.status,
    messageFor(response.status, body.message),
    fieldErrors,
    typeof body.code === "string" ? body.code : undefined,
  );
}

function messageFor(status: number, serverMessage: unknown) {
  if (status === 401) return "Please log in to continue.";
  // Business-rule errors (409/422) carry a user-safe message from the backend.
  if ((status === 409 || status === 422) && typeof serverMessage === "string") return serverMessage;
  if (status === 403) return "You don't have permission to do that.";
  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  return typeof serverMessage === "string" ? serverMessage : "The request could not be completed.";
}
