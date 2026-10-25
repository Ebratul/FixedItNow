"use client";

import { useSearchParams } from "next/navigation";
import { VerifyCodeForm } from "./verify-code-form";

/**
 * Standalone verification page (for someone who closed the tab after signing up).
 * Nothing about the account is passed in the URL: the person enters their email,
 * the password they chose, and the emailed code.
 */
export function VerifyEmailResult() {
  const next = useSearchParams().get("next");
  return <VerifyCodeForm next={next} />;
}
