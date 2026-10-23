# Implementation plan

Roadmap phases follow [SRS.md](SRS.md) §15.

## Step 1: Git identity audit — done
## Step 2: Design system and public website — done (preview)

Pages: `/`, `/services`, `/workers`, `/how-it-works`, `/become-a-worker`,
`/about`, `/help`, `/contact`, 404 and error pages. (`/login` and `/signup` were
placeholders in Step 2; Step 3 replaced them with real auth, and `/signup` now redirects to `/register`.) `/privacy` and `/terms` are intentionally not created:
no approved legal text exists and none is invented.

Connected to real behaviour: navigation (header, mobile dialog, services
dropdown), hero search → `/workers` query params, category filter on
`/services`, FAQ disclosure, skip link.
Presentation-only / awaiting later steps: category data, professional data,
search results, login/signup, contact channels.

Dependencies added: `lucide-react` (icons). Dev: `vitest`, `@vitejs/plugin-react`,
`jsdom`, `@testing-library/*` (component tests); `@types/node` raised to ^24 to
satisfy Vitest peer ranges (runtime is Node 24).

### Verification performed
- `npm run lint`, `npm run typecheck`, `npm test` (13 tests), `npm run build`, `npm audit` (0 vulnerabilities).
- Real Chrome against the production build at 375, 430, 768, 1366, 1440 px on
  every route: no horizontal overflow, no console errors (other than the
  intentional 404 page).
- axe-core at 375 and 1440 px on every route: no violations.
- Interaction checks: mobile menu, Escape, dropdown (keyboard, outside click),
  search validation and navigation, category filter and empty state, all
  internal links resolve.

### Known gaps
- Bangla copy is not written yet; only the font fallback is in place (FR-PUB-04).
- No Lighthouse run; no cross-browser testing beyond Chromium.
- Toast and pagination components are not built (nothing uses them yet).
- Set `NEXT_PUBLIC_SITE_URL` in production for OG URLs and the sitemap.


## Step 3: Authentication, Google OAuth, onboarding, authorization — implemented (see status below)

**Architecture:** Better Auth inside a new NestJS 12 + Prisma 7 + PostgreSQL backend; web app proxies
`/api/v1/*`. Details: [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md), [SECURITY.md](SECURITY.md), [DEPLOYMENT.md](DEPLOYMENT.md).

**Routes (web):** `/login`, `/register` (`/signup` redirects), `/forgot-password`, `/reset-password`,
`/verify-email`, `/onboarding`, `/onboarding/customer`, `/onboarding/worker` (5-step wizard with saved
progress), `/account`.

### Status
| Capability | Status |
| --- | --- |
| Email/password registration, login, logout | **Implemented and verified** (API tests + real browser run) |
| Email verification (required before login) | **Implemented and verified** (console transport; SMTP verified against a local sink only) |
| Password reset (single-use, revokes sessions) | **Implemented and verified** |
| Sessions (HttpOnly/SameSite/Secure-in-prod, revocation) | **Implemented and verified** |
| Customer onboarding | **Implemented and verified** |
| Worker onboarding + submit for review | **Implemented and verified** |
| One account with both capabilities | **Implemented and verified** |
| Workers cannot self-approve; users cannot self-assign admin | **Implemented and verified** (tests) |
| Backend authorization (default-deny, admin, approved-worker, ownership) | **Implemented and verified** |
| Admin review API + audit log; `admin:grant` operator script | **Implemented and verified** (no admin UI) |
| Rate limiting (auth + API) | **Implemented and verified** locally; production needs a proxy + `TRUSTED_PROXIES` |
| Google OAuth | **Implemented, NOT externally verified.** Config/state/PKCE/redirect URI/errors/linking policy tested; a real login needs Google credentials |
| Real SMTP provider | **Implemented, NOT externally verified** (needs provider credentials) |
| Identity-document upload/verification | **Not implemented** (later step) |
| Terms/Privacy pages + acceptance | **Not implemented** (no approved text) |
| Admin UI, 2FA, email change, account deletion | **Not implemented** |

### Verification performed
- Backend: `npm run typecheck`, `npm run lint`, `npm test` (24 unit), `npm run test:e2e` (87 integration tests on a real PostgreSQL test database), `npm run build`, `npm audit` (0 vulnerabilities).
- Frontend: `npm run lint`, `npm run typecheck`, `npm test` (65 tests), `npm run build`, `npm audit` (0 vulnerabilities).
- Real Chrome against the running stack: registration -> verification link -> onboarding (customer + 5-step worker wizard, resume after reload) -> submit -> logout -> wrong/unknown-email login -> password reset (single-use) -> open-redirect `?next=` ignored.
- axe-core and horizontal-overflow checks on all auth/onboarding/account pages at 375, 430, 768, 1366, 1440 px: no violations.

### Known gaps
See [SECURITY.md](SECURITY.md) "Not done / known limitations".

## Step 4: next (not started)
