"use client";

import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Better Auth browser client. Requests go to this app's own origin
 * (`/api/v1/auth/*`) and are proxied to the backend, which owns the session
 * cookie. The client never sees or stores a token.
 */
export const authClient = createAuthClient({ basePath: "/api/v1/auth", plugins: [emailOTPClient()] });
