# Architecture (as implemented)

Target architecture is in [SRS.md](SRS.md) §6–7. This file records what exists.

## Layout
`frontend/` (Next.js), `backend/` (empty), `rag_agent/` (empty). The repository
keeps these three top-level folders; each holds only its own code.

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
| Auth | `/login`, `/signup` | Marked "not available yet" placeholders | Step 3 |
| Worker profile | `ProfessionalCard` links to `/workers/[id]` | Route not built; card never rendered without data | Step 3+ |
