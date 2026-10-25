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

import { isPaymentReference, isUuid } from "@/lib/route-params";

describe("route param shapes (values that get spliced into API paths)", () => {
  it("accepts real ids and payment references", () => {
    expect(isUuid("01a16f69-cba5-7227-a9af-bded6fdc2caa")).toBe(true);
    expect(isPaymentReference("FIN" + "A1B2C3D4E5F60718293A4B5C")).toBe(true);
  });
  it("rejects path traversal, query injection and wrong shapes", () => {
    for (const bad of ["..%2Fadmin", "../admin", "x?y=1", "01a16f69-cba5-7227-a9af-bded6fdc2caa/../x", "", "abc", "01a16f69-cba5-7227-a9af-bded6fdc2caz"]) {
      expect(isUuid(bad), bad).toBe(false);
    }
    for (const bad of ["FIN1", "fina1b2c3d4e5f60718293a4b5c", "FIN../x", "RFD" + "A1B2C3D4E5F60718293A4B5C", "FIN" + "A1B2C3D4E5F60718293A4B5C/x"]) {
      expect(isPaymentReference(bad), bad).toBe(false);
    }
  });
});
