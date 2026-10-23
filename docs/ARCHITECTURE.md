# Architecture (as implemented)

Target architecture is in [SRS.md](SRS.md) §6–7. This file records what exists.

## Layout
`frontend/` (Next.js), `backend/` (NestJS API + Prisma), `rag_agent/` (empty).
The repository keeps these three top-level folders; each holds only its own code.

```
Browser --(same origin)--> Next.js web app (:3000)
                              |  rewrites /api/v1/*  (dev; use a reverse proxy in production)
                              v
                         NestJS API (:4000)  --Prisma--> PostgreSQL
                              |-- Better Auth (mounted at /api/v1/auth/*)
                              '-- SMTP (email)        Google OAuth (optional)
```

## Backend (Step 3)
- **NestJS 12 (ESM), Express 5, Prisma 7 (pg driver adapter), PostgreSQL, Vitest.**
- **Authentication provider: [Better Auth](https://better-auth.com) 1.7** (maintained library; no
  hand-written crypto). It owns password hashing, sessions, email-verification and reset tokens,
  Google OAuth, origin checks, and auth-endpoint rate limiting. It is built in
  `backend/src/auth/auth.factory.ts` and mounted at `/api/v1/auth/*` before the JSON body parser
  (`backend/src/app.setup.ts`).
- **Sessions:** server-side rows in PostgreSQL + an HttpOnly cookie. Cookie cache is off so logout,
  password reset and "log out other devices" take effect immediately. `sign-out` revokes only the
  **current** session; `revoke-other-sessions` and password reset revoke the rest.
- **Authentication is separate from authorization.** `AuthGuard` (global, default deny) only
  establishes who the caller is. Permissions are decided by `AdminGuard`, `ApprovedWorkerGuard`,
  and the pure functions in `src/auth/policies.ts`. The role is read from the database on every request.
- **Request pipeline:** helmet -> Better Auth handler (`/api/v1/auth/*`) -> JSON parser ->
  `OriginGuard` (CSRF) -> `ThrottlerGuard` -> `AuthGuard` -> route guards -> Zod validation -> service.
- **Modules:** `config` (validated env), `prisma`, `mail`, `auth`, `categories`, `me` (customer profile),
  `worker` (onboarding + approved-worker workspace), `admin` (review queue), `health`.

## Data model (Prisma, `backend/prisma/schema.prisma`)
- Better Auth core: `user`, `session`, `account`, `verification`, `rateLimit`. `user.role` (`USER`|`ADMIN`) is DB-only.
- `customer_profile` (1:1 with user), `worker_profile` (1:1 with user), `worker_service`
  (worker x category with pricing), `service_category` (seeded), `audit_log`.
- **One account, both capabilities:** capabilities are *rows*, not roles: having a `customer_profile`
  and/or a `worker_profile`. Nothing requires separate accounts.
- `worker_profile.onboardingStatus` (`DRAFT`|`SUBMITTED`) is separate from `verificationStatus`
  (`NOT_SUBMITTED`|`PENDING`|`VERIFIED`|`REJECTED`|`RESUBMISSION_REQUIRED`).

## Account linking
Google never auto-links to an existing email account (see SECURITY.md). Linking is explicit
(`linkSocial`) for a signed-in user.

## Frontend
- Next.js 16 App Router with Cache Components enabled. Pages are static; the
  only runtime-dynamic route is `/workers`, which reads `searchParams` inside a
  `<Suspense>` boundary.
- Tailwind v4 with tokens in `src/app/globals.css`: navy `brand-*`, teal
  `accent-*`, neutrals (`canvas`, `surface`, `line`, `ink*`), status colours,
  `rounded-control|card|panel`, `shadow-card|lift|pop`, type scale
  (`text-display|h1|h2`). Font: Plus Jakarta Sans with Noto Sans Bengali fallback.
- Icons: `lucide-react` only. No emoji, no external images.
- Light theme only (the starter's dark-mode block was removed so the palette
  stays consistent with the SRS visual direction).

## Integration boundaries (for later steps)
| Boundary | File | Today | Replace with |
| --- | --- | --- | --- |
| Categories | `src/lib/categories.ts` | Presentation-only seed list | `GET /api/v1/categories` |
| Professionals | `src/lib/professionals.ts` | Returns `[]` (never fabricates) | `GET /api/v1/workers` |
| Search | `src/components/home/search-form.tsx` → `/workers?q&location&category` | Navigates; page shows honest empty state | Search API results |
| Auth | `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email` | Real (Better Auth via backend) | - |
| Account / onboarding | `/account`, `/onboarding`, `/onboarding/customer`, `/onboarding/worker` | Real; data from `/api/v1/me*` | - |
| Worker profile | `ProfessionalCard` links to `/workers/[id]` | Route not built; card never rendered without data | Step 4+ |
| Categories (worker onboarding) | `GET /api/v1/categories` | Real (DB). The public marketing pages still use `src/lib/categories.ts` | Unify in the discovery step |

### Frontend auth notes
- `src/lib/auth-client.ts`: Better Auth browser client (same origin). `src/lib/api.ts`: typed fetch for app endpoints.
- `src/proxy.ts` is an **optimistic** gate (cookie present?). Real enforcement is the backend; pages also call `/me` and redirect on `401`.
- Header/mobile nav reflect the session (`authClient.useSession`) for convenience only.
