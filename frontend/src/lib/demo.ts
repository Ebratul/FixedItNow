import { api, ApiError } from "./api";
import { authClient } from "./auth-client";
import { safeNext } from "./safe-redirect";

/** The three fixed, fictional demo identities. The browser only ever names one of these; the server picks the user. */
export const DEMO_KEYS = ["customer", "worker", "admin"] as const;
export type DemoKey = (typeof DEMO_KEYS)[number];

/** One entry of `GET /demo/options`: only options an administrator made visible are listed. */
export type DemoOption = {
  role: DemoKey;
  label: string;
  description: string;
  /** False when the option is visible but switched off, so the server would refuse a new session. */
  available: boolean;
};

export const isDemoKey = (value: unknown): value is DemoKey => typeof value === "string" && (DEMO_KEYS as readonly string[]).includes(value);

/** Names used only when the server did not describe the role (for example a hidden option opened by its direct link). */
export const DEMO_FALLBACK_LABELS: Record<DemoKey, string> = {
  customer: "Demo Customer",
  worker: "Demo Worker",
  admin: "Demo Admin",
};

/** Where each demo role lands, used when the server's `redirectTo` is missing or not a same-site path. */
export const DEMO_DEFAULT_REDIRECT: Record<DemoKey, string> = {
  customer: "/account",
  worker: "/bookings?role=worker",
  admin: "/admin",
};

/** `GET /demo/options`, keeping only well-formed entries so a malformed response can never render a broken card. */
export async function fetchDemoOptions(): Promise<DemoOption[]> {
  const { options } = await api<{ options: unknown }>("/demo/options");
  if (!Array.isArray(options)) return [];
  const seen = new Set<DemoKey>();
  const result: DemoOption[] = [];
  for (const raw of options as Partial<DemoOption>[]) {
    if (!raw || !isDemoKey(raw.role) || seen.has(raw.role)) continue;
    seen.add(raw.role);
    result.push({
      role: raw.role,
      label: typeof raw.label === "string" && raw.label ? raw.label : DEMO_FALLBACK_LABELS[raw.role],
      description: typeof raw.description === "string" ? raw.description : "",
      available: raw.available === true,
    });
  }
  return result;
}

/**
 * Starts a demo session. Sends ONLY the role name; the session lives in the HttpOnly cookie the server sets, and
 * nothing about it is kept in browser storage. Resolves with a same-site path to navigate to.
 */
export async function startDemoSession(role: DemoKey): Promise<{ role: DemoKey; redirectTo: string }> {
  const result = await api<{ role?: unknown; redirectTo?: unknown }>("/auth/demo/sign-in", { method: "POST", body: { role } });
  // The sign-in did not go through Better Auth's own client, so tell its session store to look again (header, banner).
  authClient.$store.notify("$sessionSignal");
  const fallback = DEMO_DEFAULT_REDIRECT[role];
  return { role, redirectTo: typeof result.redirectTo === "string" ? safeNext(result.redirectTo, fallback) : fallback };
}

/** A clear message for a refused or failed demo start. `label` is the option's name, e.g. "Demo Customer". */
export function demoErrorMessage(error: unknown, label: string): string {
  if (error instanceof ApiError) {
    if (error.code === "DEMO_DISABLED") return `${label} is not available right now.`;
    if (error.code === "ALREADY_SIGNED_IN" || error.status === 409) {
      return "You are already signed in. Log out first, then try the demo again.";
    }
    if (error.status === 429) return "Too many attempts. Please wait a minute and try again.";
    if (error.code === "DEMO_BUSY") return "The demo is busy right now. Please try again in a few minutes.";
    if (error.code === "DEMO_UNAVAILABLE" || error.status === 503) return "The demo is not set up on this server yet.";
    if (error.status === 0) return error.message; // the client already words "could not reach the server"
  }
  return "We couldn't start the demo. Please try again.";
}
