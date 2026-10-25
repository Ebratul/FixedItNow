<div align="center">

# 🛠️ FixedItNow

**A Bangladesh-focused marketplace that connects customers with trusted local service professionals.**

Find a verified electrician, plumber, cleaner or technician, book them, chat, pay with bKash and review the work, all in one place.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-Python%203.12-009688?logo=fastapi&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

[Requirements](docs/SRS.md) · [Architecture](docs/ARCHITECTURE.md) · [API](docs/API.md) · [Deployment](docs/DEPLOYMENT.md) · [Audit](docs/AUDIT.md)

</div>

---

## ✨ Features

| Area | What you get |
| --- | --- |
| 🔐 **Accounts** | Email + password, email + one-time code, Google sign-in, email verification, password reset ([AUTH](docs/AUTH.md)) |
| 🧑‍🔧 **Professionals** | Worker onboarding, admin approval, public profiles, service categories, searchable directory with filters, favourites |
| 📅 **Bookings** | Booking requests, quotes, worker availability, rescheduling, cancellation, disputes ([BOOKINGS](docs/BOOKINGS.md)) |
| 🔄 **Full job lifecycle** | Booking → in-app chat → arrival → payment gate → review ([WORKFLOW](docs/WORKFLOW.md)) |
| 💳 **Payments** | bKash and SSLCOMMERZ integrations, payment verification, append-only transaction records, refund workflow ([PAYMENTS](docs/PAYMENTS.md)) |
| ⭐ **Reviews & community** | One review per completed and paid booking, posts, comments, likes, reports, feature proposals and voting ([COMMUNITY](docs/COMMUNITY.md)) |
| 🤖 **AI assistant** | Describe a need in plain language at `/assistant`; a separate Python service turns it into filters and the API returns real, database-verified professionals ([AI](docs/AI.md)) |
| 🛡️ **Admin panel** | Roles and granular permissions, user / worker / booking / payment / support / content management, AI knowledge base, tamper-evident audit log ([ADMIN](docs/ADMIN.md)) |

## 🏗️ Architecture

```
                    ┌──────────────────────┐
   Browser  ───────▶│  frontend  (Next.js) │
                    └──────────┬───────────┘
                               │  /api/v1/*  (proxied)
                    ┌──────────▼───────────┐        ┌─────────────────────┐
                    │  backend (NestJS 12) │───────▶│ rag_agent (FastAPI) │
                    │  Prisma · Better Auth│        │ intent + knowledge  │
                    └──────────┬───────────┘        └─────────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │     PostgreSQL       │
                    └──────────────────────┘
```

The AI service never touches the database and is never called by browsers. It only extracts intent and phrases answers from curated knowledge; the API re-reads workers from PostgreSQL before showing anything.

### Repository layout

| Folder | Contents |
| --- | --- |
| [`frontend/`](frontend) | Next.js web application: public site, dashboards, assistant, admin UI |
| [`backend/`](backend) | Main API: NestJS 12, Prisma 7, PostgreSQL, Better Auth |
| [`rag_agent/`](rag_agent) | AI assistant service: FastAPI, intent extraction, curated-knowledge retrieval, safe search tool |
| [`docs/`](docs) | SRS, architecture, security, runbook, audit and per-feature design notes |
| [`.github/`](.github) | CI workflow |

## 🚀 Getting started

**Requirements:** Node 24, PostgreSQL 16+ (Docker optional), Python 3.12+ (only for the AI service).

```bash
# 1. Database + backend
cd backend
docker compose up -d db              # or use your own PostgreSQL
cp .env.example .env                 # set BETTER_AUTH_SECRET (openssl rand -base64 32)
npm install
npx prisma migrate dev
npm run db:seed
npm run start:dev                    # http://localhost:4000

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env.local
npm install
npm run dev                          # http://localhost:3000

# 3. AI assistant (optional, new terminal)
cd rag_agent
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
cp .env.example .env                 # set the service tokens; OPENROUTER_* is optional
set -a; . ./.env; set +a; .venv/bin/python -m app
```

In development the email verification code and password-reset links are printed in the backend terminal. All environment variables and Google OAuth setup are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Without OpenRouter credentials the AI service runs in a rule-based "simple mode".

## ✅ Checks

| Where | Commands |
| --- | --- |
| `frontend/` | `npm run lint` · `npm run typecheck` · `npm test` |
| `backend/` | `npm run lint` · `npm run typecheck` · `npm test` · `npm run test:e2e` (needs a disposable `*_test` database) |
| `rag_agent/` | `pytest` · `ruff check .` · `mypy` · `python -m evals.run_eval` |

CI runs these in [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## 📍 Project status

The project is **ready for staging, not for production** (see [docs/AUDIT.md](docs/AUDIT.md)).

**Built and tested:** public site, accounts and onboarding, discovery, bookings, payments, chat and in-app notifications, reviews, community and moderation, AI assistant, admin panel, container images and a CI workflow.

**Not verified against the real services** (no credentials were available; everything is tested against mocks or sandboxes):

- bKash and SSLCOMMERZ payments (bKash was only exercised in its sandbox by hand)
- Google sign-in and real SMTP email delivery
- OpenRouter / a real language model for the AI assistant

**Not built yet:** worker payouts, email/SMS notifications (notifications are in-app only), Terms of Service and Privacy Policy (no approved legal text exists, so none is invented).

## 🚢 Deployment

The three services are deployable as separate projects (for example on Vercel) or as containers. Dockerfiles, a disposable staging stack and a runbook for deployment, backup/restore, rollback and incident handling are provided: [docs/RUNBOOK.md](docs/RUNBOOK.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Behind a reverse proxy, set `TRUSTED_PROXIES` so rate limiting sees real client IPs ([docs/SECURITY.md](docs/SECURITY.md)).

## 📚 Documentation

[SRS](docs/SRS.md) · [ARCHITECTURE](docs/ARCHITECTURE.md) · [API](docs/API.md) · [AUTH](docs/AUTH.md) · [BOOKINGS](docs/BOOKINGS.md) · [WORKFLOW](docs/WORKFLOW.md) · [PAYMENTS](docs/PAYMENTS.md) · [COMMUNITY](docs/COMMUNITY.md) · [AI](docs/AI.md) · [ADMIN](docs/ADMIN.md) · [SECURITY](docs/SECURITY.md) · [DEPLOYMENT](docs/DEPLOYMENT.md) · [RUNBOOK](docs/RUNBOOK.md) · [AUDIT](docs/AUDIT.md) · [QA_REPORT](docs/QA_REPORT.md) · [IMPLEMENTATION_PLAN](docs/IMPLEMENTATION_PLAN.md)

## 🤝 Contributing

Keep each folder to its own code (`frontend/`, `backend/`, `rag_agent/`), run the checks above before opening a pull request, and never commit `.env` files or real credentials.
