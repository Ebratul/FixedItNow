import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { unstable_doesMiddlewareMatch as matches } from "next/experimental/testing/server";
import { config, proxy } from "@/proxy";

const req = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, { headers: cookie ? { cookie } : {} });

describe("route gate", () => {
  it("redirects visitors without a session cookie to /login with the destination", () => {
    const res = proxy(req("/onboarding/worker?x=1"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/onboarding/worker?x=1");
  });

  it("lets requests with a session cookie through (the backend validates it)", () => {
    expect(proxy(req("/account", "better-auth.session_token=abc")).headers.get("location")).toBeNull();
    expect(proxy(req("/account", "__Secure-better-auth.session_token=abc")).headers.get("location")).toBeNull();
  });
});

describe("which routes the gate covers", () => {
  const gated = (path: string) => matches({ config, url: `http://localhost:3000${path}` });

  it("leaves the demo entry points public (a visitor has no session yet)", () => {
    for (const path of ["/login", "/demo/customer", "/demo/worker", "/demo/admin", "/api/v1/demo/options"]) expect(gated(path), path).toBe(false);
  });

  it("still gates the signed-in pages the demo lands on, and the simulated checkout", () => {
    for (const path of ["/account", "/bookings", "/bookings?role=worker", "/payments", "/payments/demo/FIN0123456789ABCDEF01234567"]) expect(gated(path), path).toBe(true);
  });
});
