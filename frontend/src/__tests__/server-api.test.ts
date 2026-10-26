import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined) }) }));

import { serverApi } from "@/lib/server-api";

describe("serverApi", () => {
  afterEach(() => {
    jar.clear();
    vi.restoreAllMocks();
  });

  function fetchSpy() {
    return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  }
  const headersOf = (spy: ReturnType<typeof fetchSpy>) => (spy.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;

  it("sends no cookie for an anonymous visitor", async () => {
    const spy = fetchSpy();
    await serverApi("/workers");
    expect(headersOf(spy)).toEqual({ Accept: "application/json" });
  });

  it("forwards ONLY the session cookie (so the backend can pick the data realm), re-encoded as the browser sent it", async () => {
    jar.set("better-auth.session_token", "abc.d+e/f=");
    jar.set("other-cookie", "secret");
    jar.set("fin.dismissed.1", "1");
    const spy = fetchSpy();
    await serverApi("/workers");
    expect(headersOf(spy).Cookie).toBe("better-auth.session_token=abc.d%2Be%2Ff%3D");
    expect(JSON.stringify(headersOf(spy))).not.toContain("secret");
  });

  it("understands the secure cookie name used in production", async () => {
    jar.set("__Secure-better-auth.session_token", "tok.sig");
    const spy = fetchSpy();
    await serverApi("/categories");
    expect(headersOf(spy).Cookie).toBe("__Secure-better-auth.session_token=tok.sig");
  });
});
