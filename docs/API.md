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
| `GET /categories` | Public | Active categories `{ slug, name, description, workerCount }`. `workerCount` is **computed** from publicly listed workers. |
| `GET /categories/:slug` | Public | One active category (same shape under `category`). `404` for unknown, malformed, or inactive slugs. |
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

## Discovery (Step 4)

### Public listing rules
A worker appears in **any** public read only if all hold: onboarding `SUBMITTED`, verification `VERIFIED`
(admin-approved), the owner **published** it, an admin has **not suspended** it, and it has a slug.
This is a single shared filter (`ELIGIBLE_WORKER`) used by search, profile, category counts and favorites.

### `GET /workers` (Public)
Search the directory. Throttled to 60 requests/min/IP. **Never** returns per-viewer data (no favorite flags).

| Query param | Rule |
| --- | --- |
| `q` | Free text, trimmed, <= 80 chars. Blank = ignored. Split on whitespace (max 5 terms); every term must match the name, headline, bio, or an active category name (case-insensitive). `%`, `_` and `\` are matched literally. |
| `category` | Category slug (`^[a-z0-9-]{1,50}$`); must be an **active** category. |
| `location` | One of the 8 divisions (exact, e.g. `Dhaka`). Text/area match, **not** distance. |
| `maxPrice` | Integer 50-1,000,000. Matches workers whose cheapest *priced* service is <= value; quote-only workers are excluded. |
| `minExperience` | Integer 0-60 (years). |
| `sort` | `newest` (default, by publish time), `experience`, `price_asc`, `price_desc`. Missing values sort last. Ties always break on `id`, so ordering is deterministic. |
| `page` | Integer 1-500 (default 1). |
| `pageSize` | Integer 1-48 (default 12). |

Invalid values return `400` (`Validation failed` + `errors[]`). Unknown parameters are ignored, never used.
Response: `{ workers: Card[], page, pageSize, total, totalPages, sort }`. An empty directory is `200` with `workers: []`.

`Card`: `id, slug, displayName, headline, primaryCategory, categories[], serviceAreas[], experienceYears, startingPriceBdt, verification ("VERIFIED"), rating (null), reviewCount (0), publishedAt`.
`rating`/`reviewCount` are explicitly null/0 because no review feature exists yet.

### `GET /workers/:slug` (Public)
Public profile: card fields plus `bio, languages, updatedAt, services[{ category, pricingModel, basePriceBdt, pricingNotes }]`.
Hidden, unpublished, suspended, draft, malformed and unknown slugs all return the **same `404`**.
**Never** includes email, user id, review notes, suspension data, or verification details.

### Owner endpoints (session required)
| Method & path | Description |
| --- | --- |
| `PUT /me/worker-profile` | Unchanged from Step 3 (strict schema). Also recomputes `startingPriceBdt`. `slug`, `publishedAt`, `suspendedAt`, `startingPriceBdt`, `verificationStatus`... are **rejected** (`400`). |
| `POST /me/worker-profile/publish` | Make the profile public. `409` unless approved; `403` if suspended; `400` if no profile. Idempotent; allocates the slug once (`<name>-<8 hex>`, stable thereafter). |
| `POST /me/worker-profile/unpublish` | Remove from public view. Idempotent; keeps the slug. |

`GET /me` (`worker.profile`) now also returns `slug`, `publishedAt`, `suspendedAt`, `startingPriceBdt`
(never the suspension reason).

### Favorites (session required; owner is always the session user)
| Method & path | Description |
| --- | --- |
| `GET /me/favorites?page&pageSize` | Caller's favorites as cards (max pageSize 48). Workers no longer public are hidden. |
| `GET /me/favorites/ids` | Ids of the caller's still-listed favorites (max 500) to render heart state. |
| `PUT /me/favorites/:workerId` | Add (idempotent). `:workerId` is a worker-profile UUID. `404` if not publicly listed, `400` if it is your own profile or not a UUID. |
| `DELETE /me/favorites/:workerId` | Remove (idempotent, allowed even after the worker was unlisted). |

### Admin (admin only)
| Method & path | Description |
| --- | --- |
| `POST /admin/workers/:id/suspension` | `{ suspended: boolean, reason? }` (reason required to suspend; stored internally, never returned). Audit-logged; an admin cannot moderate their own profile. |
| `GET /admin/workers` | Rows now include `published` and `suspended`. |

There are **no** category create/update/delete endpoints (categories are seed/migration managed).
