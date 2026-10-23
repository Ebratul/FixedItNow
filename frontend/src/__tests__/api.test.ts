import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";

const respond = (status: number, body: unknown) =>
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => vi.restoreAllMocks());

describe("api", () => {
  it("returns parsed JSON on success and sends same-origin credentials", async () => {
    const spy = respond(200, { ok: true });
    await expect(api("/me")).resolves.toEqual({ ok: true });
    expect(spy).toHaveBeenCalledWith("/api/v1/me", expect.objectContaining({ credentials: "same-origin", method: "GET" }));
  });

  it("maps backend validation errors to field errors", async () => {
    respond(400, { message: "Validation failed", errors: [{ path: "bio", message: "Too short" }, { path: "bio", message: "second" }] });
    const error = (await api("/x", { method: "PUT", body: {} }).catch((e) => e)) as ApiError;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.fieldErrors).toEqual({ bio: "Too short" });
  });

  it("uses safe messages for auth, throttling and server errors", async () => {
    respond(401, {});
    expect(((await api("/x").catch((e) => e)) as ApiError).message).toMatch(/log in/i);
    respond(429, {});
    expect(((await api("/x").catch((e) => e)) as ApiError).message).toMatch(/too many/i);
    respond(500, { message: "SELECT * FROM secrets failed" });
    const server = (await api("/x").catch((e) => e)) as ApiError;
    expect(server.message).not.toMatch(/SELECT/);
  });

  it("reports a network failure clearly", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    const error = (await api("/x").catch((e) => e)) as ApiError;
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/reach the server/i);
  });
});
