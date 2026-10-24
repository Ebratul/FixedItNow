# FixedItNow

A Bangladesh-focused service marketplace that connects customers with trusted
local service professionals. Requirements and architecture live in
[docs/SRS.md](docs/SRS.md).

## Repository layout

| Folder | Contents |
| --- | --- |
| [`frontend/`](frontend) | Next.js web application (public site now; dashboards later). Frontend code only. |
| [`backend/`](backend) | Main API (NestJS 12, Prisma 7, PostgreSQL, Better Auth). Backend code only. |
| [`rag_agent/`](rag_agent) | AI assistant / RAG service. AI-agent code only. Not started yet. |
| [`docs/`](docs) | SRS, architecture notes, and the implementation plan. |

## Running locally

Full instructions, environment variables, and Google OAuth setup: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

```bash
# database + backend
cd backend
docker compose up -d db            # or use your own PostgreSQL
cp .env.example .env               # edit; set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm install && npx prisma migrate dev && npm run db:seed
npm run start:dev                  # http://localhost:4000

# frontend (another terminal)
cd frontend
cp .env.example .env.local
npm install && npm run dev         # http://localhost:3000
```

In development, verification and password-reset links are printed in the backend terminal.

Checks: `npm run lint`, `npm run typecheck`, `npm test` in each of `frontend/` and `backend/`;
`npm run test:e2e` in `backend/` (needs a disposable `*_test` database).

## Status

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). The public website, accounts
(email/password and Google), email verification, password reset, and customer/worker onboarding are
implemented, along with public service categories, a searchable professional directory, public profiles,
and favorites (professionals appear only after an admin approves and the owner publishes). Customers can request bookings, receive quotes,
reschedule, cancel and open disputes, and workers manage availability ([docs/BOOKINGS.md](docs/BOOKINGS.md)).
Payments, reviews, messaging, notifications, an admin dashboard UI, and identity-document verification are not built yet, and the UI says so rather than faking them. Google sign-in and
real email delivery need your own credentials and have not been verified against the real services.

Docs: [BOOKINGS](docs/BOOKINGS.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [API](docs/API.md) · [SECURITY](docs/SECURITY.md) · [DEPLOYMENT](docs/DEPLOYMENT.md)
