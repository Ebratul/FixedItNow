/** `?a=1&b=2` from defined, non-empty values (booleans and numbers allowed). Returns "" when empty. */
export function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    q.set(key, String(value));
  }
  const text = q.toString();
  return text ? `?${text}` : "";
}

/** Download a CSV (or other file) the API returns for the signed-in admin. Throws a readable Error. */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const response = await fetch(`/api/v1${path}`, { credentials: "same-origin" });
  if (!response.ok) {
    if (response.status === 403) {
      // The demo administrator's refusals carry their own sentence; anything else is plain "no permission".
      const body = (await response.json().catch(() => null)) as { code?: unknown; message?: unknown } | null;
      if (typeof body?.code === "string" && body.code.startsWith("DEMO_") && typeof body.message === "string" && body.message) throw new Error(body.message);
    }
    throw new Error(response.status === 403 ? "You don't have permission to export this." : response.status === 429 ? "Too many exports. Wait a minute and try again." : "The export could not be created.");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
