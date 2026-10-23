import { describe, expect, it } from "vitest";
import { fieldErrorsOf, loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validation";

const ok = { name: "Karim Uddin", email: "Karim@Example.com", password: "correct-horse-battery", confirmPassword: "correct-horse-battery" };

describe("registerSchema", () => {
  it("accepts valid input and normalises the email", () => {
    const parsed = registerSchema.parse(ok);
    expect(parsed.email).toBe("karim@example.com");
  });
  it("reports each problem against its field", () => {
    const result = registerSchema.safeParse({ name: "K", email: "nope", password: "short", confirmPassword: "other" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrorsOf(result.error);
      expect(Object.keys(errors).sort()).toEqual(["confirmPassword", "email", "name", "password"].sort());
    }
  });
  it("requires matching passwords", () => {
    const result = registerSchema.safeParse({ ...ok, confirmPassword: "different-password" });
    expect(result.success).toBe(false);
  });
  it("caps password length", () => {
    expect(registerSchema.safeParse({ ...ok, password: "x".repeat(129), confirmPassword: "x".repeat(129) }).success).toBe(false);
  });
});

describe("loginSchema / resetPasswordSchema", () => {
  it("requires an email and a password", () => {
    expect(loginSchema.safeParse({ email: "", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
  it("applies the same password rules on reset", () => {
    expect(resetPasswordSchema.safeParse({ password: "short", confirmPassword: "short" }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ password: "long-enough-pass", confirmPassword: "long-enough-pass" }).success).toBe(true);
  });
});
