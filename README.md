# FixedItNow

A Bangladesh-focused service marketplace that connects customers with trusted
local service professionals. Requirements and architecture live in
[docs/SRS.md](docs/SRS.md).

## Repository layout

| Folder | Contents |
| --- | --- |
| [`frontend/`](frontend) | Next.js web application (public site now; dashboards later). Frontend code only. |
| [`backend/`](backend) | Main API. Backend code only. Not started yet. |
| [`rag_agent/`](rag_agent) | AI assistant / RAG service. AI-agent code only. Not started yet. |
| [`docs/`](docs) | SRS, architecture notes, and the implementation plan. |

## Running the frontend

```bash
cd frontend
cp .env.example .env.local   # optional; see the file for NEXT_PUBLIC_SITE_URL
npm install
npm run dev                  # http://localhost:3000
```

Checks: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

## Status

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). The public
website is implemented as a preview. Accounts, professional listings, search,
and bookings are not built yet, and the UI says so rather than faking them.
