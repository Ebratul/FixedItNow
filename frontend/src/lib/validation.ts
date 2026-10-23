import { z } from "zod";

/**
 * Client-side validation for instant feedback. The backend re-validates
 * everything; these schemas are NOT a security boundary.
 */
export const MIN_PASSWORD_LENGTH = 10;

const email = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address"));

const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(128, "Use 128 characters or fewer");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Enter at least 2 characters").max(60, "Use 60 characters or fewer"),
    email,
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

/** Flatten a zod error into `{ fieldName: firstMessage }`. */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function formValues(form: HTMLFormElement): Record<string, string> {
  return Object.fromEntries(
    [...new FormData(form).entries()].map(([k, v]) => [k, typeof v === "string" ? v : ""]),
  );
}
