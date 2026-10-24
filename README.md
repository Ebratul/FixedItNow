# FixedItNow

A Bangladesh-focused service marketplace that connects customers with trusted
local service professionals. Requirements and architecture live in
[docs/SRS.md](docs/SRS.md).

## Repository layout

| Folder | Contents |
| --- | --- |
| [`frontend/`](frontend) | Next.js web application (public site now; dashboards later). Frontend code only. |
| [`backend/`](backend) | Main API (NestJS 12, Prisma 7, PostgreSQL, Better Auth). Backend code only. |
| [`rag_agent/`](rag_agent) | AI assistant service (Python FastAPI): intent extraction, curated-knowledge retrieval, safe search tool. AI code only. |
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
`npm run test:e2e` in `backend/` (needs a disposable `*_test` database); `pytest`, `ruff check .`, `mypy` and `python -m evals.run_eval` in `rag_agent/` (see [docs/AI.md](docs/AI.md)).

## Status

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). The public website, accounts
(email/password and Google), email verification, password reset, and customer/worker onboarding are
implemented, along with public service categories, a searchable professional directory, public profiles,
and favorites (professionals appear only after an admin approves and the owner publishes). Customers can request bookings, receive quotes,
reschedule, cancel and open disputes, and workers manage availability ([docs/BOOKINGS.md](docs/BOOKINGS.md)).
Customers can pay a confirmed booking through bKash or SSLCOMMERZ and request refunds ([docs/PAYMENTS.md](docs/PAYMENTS.md)): the code is in place and tested against mocked providers, but **neither provider has been run against its real sandbox**, so each stays disabled until you configure credentials. Worker payouts, messaging, notifications, a general admin dashboard UI (only the moderation console exists), and identity-document verification are not built yet, and the UI says so rather than faking them. Google sign-in and
real email delivery need your own credentials and have not been verified against the real services.

Customers can also describe a need in natural language at `/assistant` ([docs/AI.md](docs/AI.md)): a separate Python service turns the request into filters and the API shows real, database-verified professionals. It is implemented and tested with mocks and a fake model; **no real OpenRouter request or real model has been tested**, so it needs your key and model choice, and it stays off until configured. The normal search is unaffected.

Customers can review a completed booking (one per booking, editable for 14 days); ratings and review counts on profiles, search and favourites are real and computed from those reviews. Signed-in members can post, comment and like in the community, report content, and propose and vote on features; administrators moderate through a report queue with an audit trail ([docs/COMMUNITY.md](docs/COMMUNITY.md)). Sentiment analysis was deliberately not built. A moderation UI exists at `/admin/moderation` (administrators only).

Docs: [COMMUNITY](docs/COMMUNITY.md) · [AI](docs/AI.md) · [PAYMENTS](docs/PAYMENTS.md) · [BOOKINGS](docs/BOOKINGS.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [API](docs/API.md) · [SECURITY](docs/SECURITY.md) · [DEPLOYMENT](docs/DEPLOYMENT.md)
