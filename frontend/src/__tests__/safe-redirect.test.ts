import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-redirect";

describe("safeNext", () => {
  it.each(["/account", "/onboarding/worker", "/onboarding?step=2", "/services#top"])("allows %s", (value) => {
    expect(safeNext(value)).toBe(value);
  });

  it.each([
    "https://evil.example",
    "http://evil.example/x",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "evil.example",
    "/path\nwith-newline",
    "/%0d%0a" + "\u0000",
    "",
  ])("rejects %j", (value) => {
    expect(safeNext(value)).toBe("/account");
  });

  it("falls back for missing values and honours a custom fallback", () => {
    expect(safeNext(null)).toBe("/account");
    expect(safeNext(undefined, "/onboarding")).toBe("/onboarding");
  });

  it("never sends users back into the auth pages", () => {
    for (const value of ["/login", "/login?next=/x", "/register", "/forgot-password", "/reset-password?token=a"]) {
      expect(safeNext(value)).toBe("/account");
    }
  });
});
