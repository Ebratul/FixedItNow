# API reference (as implemented)

Base path `/api/v1`. The browser reaches it through the web app's origin
(Next.js rewrites `/api/v1/*` to the backend), so cookies are first-party.
JSON in, JSON out. Errors use Nest's shape: `{ statusCode, error, message }`;
validation errors add `errors: [{ path, message }]`.

**Authentication** is a session cookie (`better-auth.session_token`, or
`__Secure-better-auth.session_token` in production). Every route requires a
valid session **unless marked Public**. **State-changing requests (POST/PUT/PATCH/DELETE)
must carry an `Origin` (or `Referer`) equal to the web app's origin**, otherwise `403`.

## Authentication (Better Auth, mounted at `/api/v1/auth/*`)

Full list: Better Auth docs. The ones the web app uses:

| Method & path | Purpose | Notes |
| --- | --- | --- |
| `POST /auth/sign-up/email` | Register `{ name, email, password, callbackURL? }` | Same `200` response whether or not the email exists; no session until verified. Password 10-128 chars. |
| `GET /auth/verify-email?token&callbackURL` | Verify email | Redirects to `callbackURL` (must be same-origin) and starts a session. |
| `POST /auth/send-verification-email` | Resend link `{ email, callbackURL }` | Same answer for unknown emails. Rate-limited. |
| `POST /auth/sign-in/email` | Log in `{ email, password }` | `401` for wrong password **and** unknown email (identical); `403 EMAIL_NOT_VERIFIED` only after a correct password. |
| `POST /auth/sign-in/social` | Start Google `{ provider: "google", callbackURL, ... }` | Returns Google URL (state + PKCE). Fails when Google is not configured. |
| `GET /auth/callback/google` | OAuth callback | Validates state; on failure redirects to the error URL with `?error=`. |
| `POST /auth/request-password-reset` | `{ email, redirectTo }` | Same answer for unknown emails. |
| `GET /auth/reset-password/:token?callbackURL` | Validates token, redirects with `?token=` | Invalid -> `?error=INVALID_TOKEN`. |
| `POST /auth/reset-password` | `{ newPassword, token }` | Revokes all sessions. Token is single-use. |
| `GET /auth/get-session` | Current session | |
| `POST /auth/sign-out` | End the **current** session | Other devices stay signed in. |
| `POST /auth/revoke-other-sessions` | End all other sessions | |
| `GET /auth/list-accounts`, `POST /auth/link-social` | Sign-in methods; explicitly link Google | Signed-in users only. |

Rate limits (per client IP): sign-in 5/min, sign-up 5/min, reset request 3/5 min,
reset 5/min, resend verification 3/5 min, everything else 100/min. `429` with `X-Retry-After`.

## Application endpoints

| Method & path | Access | Description |
| --- | --- | --- |
| `GET /health` | Public | `{ status: "ok" }`; `503` if the database is down. |
| `GET /config/auth` | Public | `{ googleEnabled, emailVerificationRequired, minPasswordLength }`. |
| `GET /categories` | Public | Active service categories `{ slug, name, description }`. |
| `GET /me` | Session | Caller's own account summary: `user`, `isAdmin`, `customer`, `worker`. |
| `PUT /me/customer-profile` | Session | Upsert own customer profile `{ displayName, preferredDivision? }`. |
| `PUT /me/worker-profile` | Session | Save a draft (any subset): `displayName, headline, bio, experienceYears, languages, serviceAreas, services[], onboardingStep`. **Strict**: unknown keys (e.g. `verificationStatus`, `userId`, `role`) -> `400`. |
| `POST /me/worker-profile/submit` | Session | Validates completeness, sets `onboardingStatus=SUBMITTED`, `verificationStatus=PENDING`. `409` if not submittable. Does **not** approve. |
| `GET /worker/workspace` | Approved worker | Requires `SUBMITTED` + `VERIFIED`. Foundation for worker-only features. |
| `GET /admin/workers?status=PENDING&page=1` | Admin | Review queue (includes email). |
| `POST /admin/workers/:id/verification` | Admin | `{ decision: VERIFIED\|REJECTED\|RESUBMISSION_REQUIRED, note? }`. Note required unless `VERIFIED`. Only `PENDING` profiles; reviewer cannot review themselves; writes an audit-log row. |

"Me" endpoints take **no user id**: the subject is always the session's user.

## Status codes you will see

`400` validation, `401` no/invalid session, `403` forbidden / cross-origin / unverified email,
`404` unknown id, `409` wrong state (e.g. already submitted), `429` throttled, `5xx` server.
Error bodies never include stack traces, SQL, or submitted values.
