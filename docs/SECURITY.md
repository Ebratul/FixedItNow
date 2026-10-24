# Security (as implemented in Step 3)

Scope: authentication, sessions, authorization, onboarding. Payment, messaging,
file upload, AI, and admin UI are later steps and are **not** covered.

## Controls

| Area | What is in place |
| --- | --- |
| Credentials | Better Auth hashes passwords with **scrypt**; only the hash is stored. Min 10, max 128 chars. No custom crypto in this repo. |
| Sessions | Server-side sessions in PostgreSQL. Cookie `HttpOnly`, `SameSite=Lax`, `Secure` + `__Secure-` prefix in production (test-verified). No token in localStorage or any JS-readable storage. 7-day expiry, refreshed daily. Cookie cache **disabled**, so revocation is immediate. New random token on every login (no fixation). |
| Authentication vs authorization | `AuthGuard` (global, **default deny**) only establishes identity. `AdminGuard`, `ApprovedWorkerGuard`, and pure functions in `backend/src/auth/policies.ts` decide permissions. Role is read from the database on every request. |
| Admin creation | Only `npm run admin:grant -- <email>` (needs DB access, verified user, writes audit log). No API, form field, query param, or request body can set a role (tested). |
| IDOR | "Me" endpoints take no id and always act on the session user. Strict Zod schemas **reject** unknown keys (`userId`, `id`, `role`, `verificationStatus`...) instead of ignoring them. |
| Worker verification | `onboardingStatus` and `verificationStatus` are separate. Workers can only submit (`PENDING`). Only an admin review sets `VERIFIED`/`REJECTED`/`RESUBMISSION_REQUIRED`; reviewers cannot review themselves; each decision is audit-logged. |
| Account enumeration | Sign-up, sign-in, resend, and password-reset give identical responses for known and unknown emails (tested). The real owner receives a notice email on duplicate sign-up. |
| Email verification | Required before any session exists. Provider-generated signed, 1-hour tokens; reset tokens are single-use and revoke all sessions. |
| CSRF / origin | Better Auth origin check is **explicitly enabled** (it is silently off under `NODE_ENV=test` otherwise). App routes additionally require `Origin`/`Referer` = web origin for unsafe methods. `SameSite=Lax` cookies. No CORS is enabled (same-origin via proxy). |
| Open redirects | `callbackURL`, `redirectTo`, `errorCallbackURL` validated against trusted origins by Better Auth (tested: absolute, `//host`, `/\host`). The web app's `?next=` goes through `safeNext()` (unit-tested). |
| OAuth (Google) | Authorization-code flow with `state` and PKCE (S256), identity scopes only, secret server-side only. **Implicit account linking is disabled** (see below). |
| Rate limiting | Better Auth limits on auth endpoints; `@nestjs/throttler` (120/min/IP) on the rest. Production uses DB-backed storage for auth limits. |
| Input validation | Zod on every request body/query on the server; the web app validates too but is not trusted. |
| Logging | Mail failures log kind + error only, never recipient or link. Passwords/tokens are never logged. **Dev console mail transport prints links (with tokens) and is refused in production.** |
| Headers | `helmet` on the API; baseline headers (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`) on the web app. |
| Secrets | `.env` is git-ignored; examples contain placeholders only. Env validation fails fast on weak/missing secrets and unsafe production settings. |

## Discovery and privacy (Step 4)

| Area | What is in place |
| --- | --- |
| Visibility | One shared filter (`ELIGIBLE_WORKER`) is spread into every public query; hidden, unpublished, suspended, draft and unknown profiles return an identical `404`. Search terms and filters cannot widen it (tested). |
| Private data | Public responses use explicit `select`s: no email, user id, review note, suspension reason, or verification data (tested by scanning serialized responses). Profile identifiers are slugs (`name-8hex`), not user ids or emails. |
| Search safety | Prisma query API only (no raw SQL). `sort` is a closed enum; numeric/enum filters are bounded; unknown params ignored. `%`, `_`, `\` are escaped so they match literally. Injection-looking input returns normal empty results (tested). |
| Ownership | Owner publish/unpublish act on the session's profile; the edit schema rejects `slug`, `publishedAt`, `suspendedAt`, `startingPriceBdt`, `verificationStatus`, `id`, `userId`. Only admins can suspend; an admin cannot moderate themselves; reasons stay internal. |
| Favorites | Session-only identity; unique constraint prevents duplicates under concurrency (tested with parallel requests); lists are private; own-profile and non-public targets rejected. The browser cache of favorite ids is cleared when the signed-in user changes. |
| Rendering | Worker text is rendered as React text (escaped); there are no user-provided links, HTML or images. A `<script>`/`<img onerror>` payload renders inert (tested). |
| Rate limiting | `GET /workers` is limited to 60/min/IP on top of the global 120/min. |
| Categories | No write endpoints exist; unauthenticated, ordinary-user and admin write attempts change nothing (tested). |

Findings in Step 4:
1. Prisma's `contains` does **not** escape `%`/`_`, so `q=%` matched every profile. Fixed with `escapeLike()` and a test.
2. `startingPriceBdt` had to be backfilled for existing rows; done additively in the migration.
3. `/workers/[slug]` and `/services/[slug]` unknown pages are soft-404s (see ARCHITECTURE).

Known limitations (Step 4): edits to a **published** profile go live immediately without re-review (moderation
is suspend-after-the-fact); no profile photos (initials avatar only, no upload endpoint); `VERIFIED` still
means "admin reviewed the profile", not an identity check.

## Account-linking policy

Google sign-in **never** auto-merges into an existing account because the email
matches (`disableImplicitLinking: true`, no trusted providers). This blocks
pre-hijacking: an attacker registering a victim's email with a password they
control and waiting for the victim to sign in with Google. A user who has both
must log in with their password and press "Connect Google" on `/account`.
Consequence: someone who registered with a password and later clicks "Continue
with Google" gets a clear `account_not_linked` message instead of silent merging.

## Findings during implementation

1. **Better Auth disables origin/redirect validation when `NODE_ENV=test`** by default. Tests initially "passed" an open redirect. Fixed by setting `advanced.disableOriginCheck=false` explicitly and asserting it in tests.
2. **Next.js rewrites do not set `X-Forwarded-For` and pass client-supplied values through.** Behind the rewrite alone, Better Auth cannot identify clients (rate limiting would be skipped or spoofable). Mitigation: production **requires** `TRUSTED_PROXIES` and a real reverse proxy that sets the header; rotation-spoofing is covered by a test. See `docs/DEPLOYMENT.md`.
3. `sendOnSignIn` produced verification links landing on `/`; replaced by an explicit resend with the right callback.
4. Starter template pulled in `@nestjs/mau` with high-severity advisories; removed (unused).

## Not done / known limitations

- **Google OAuth is not verified end to end** (no credentials). Config, state, PKCE, redirect URI, error handling and linking policy are tested; a real token exchange is not.
- **SMTP verified only against a local sink**, not a real provider; deliverability (SPF/DKIM) is untested.
- Identity-document upload/verification does not exist, so `VERIFIED` means "admin reviewed the profile", not "identity checked". The UI says so; no public listing or badge exists yet.
- No Terms/Privacy pages or acceptance checkbox (no approved legal text). Needed before launch.
- No CAPTCHA, no 2FA, no breached-password check, no account lockout beyond rate limits, no email-change or account-deletion flow.
- No Content-Security-Policy on the web app (needs a nonce-based policy).
- Rate-limit counters for non-auth routes are in-memory (per instance); use Redis when running more than one instance.
- Admin has no UI yet (API + operator script only).
- Dependency/vulnerability scanning is a manual `npm audit` (0 vulnerabilities at the time of writing); no CI yet.
