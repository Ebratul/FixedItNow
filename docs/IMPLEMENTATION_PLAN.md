# Implementation plan

Roadmap phases follow [SRS.md](SRS.md) §15.

## Step 1: Git identity audit — done
## Step 2: Design system and public website — done (preview)

Pages: `/`, `/services`, `/workers`, `/how-it-works`, `/become-a-worker`,
`/about`, `/help`, `/contact`, `/login`*, `/signup`*, 404 and error pages.
(*placeholders; no auth.) `/privacy` and `/terms` are intentionally not created:
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

## Step 3: Authentication and dual-role onboarding — next
