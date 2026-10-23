import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

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
