# Browser end-to-end checks (real Chrome)

Not part of `npm test` or CI: they need a running stack, a scratch database and Chrome. They exercise the real UI against the real API:
overflow + axe at 375/430/768/1366/1440 px for the key pages, a public-page crawl (status codes, dead internal links, console errors,
Content-Security-Policy violations), and the main journeys (customer booking, review, community, proposals, moderation, access denials).

```bash
# 1. a scratch database (the seed REFUSES any database whose name does not end in _qa)
createdb fixeditnow_qa            # or: psql ... -c 'CREATE DATABASE fixeditnow_qa'
cd backend && DATABASE_URL=postgresql://USER:PASS@127.0.0.1:5436/fixeditnow_qa npx prisma migrate deploy && npx prisma db seed && npm run build

# 2. the API on :4100 and the production web build on :3101 (BACKEND_URL is baked into the build)
DATABASE_URL=... NODE_ENV=development PORT=4100 BETTER_AUTH_SECRET=<32+ random chars> BETTER_AUTH_URL=http://localhost:3101 \
  FRONTEND_ORIGIN=http://localhost:3101 MAIL_TRANSPORT=console RATE_LIMIT_ENABLED=false node dist/main &
cd ../frontend && BACKEND_URL=http://127.0.0.1:4100 npm run build && BACKEND_URL=http://127.0.0.1:4100 npx next start -p 3101 &

# 3. seed through the real API, then browse
export QA_BASE=http://localhost:3101 QA_DATABASE_URL=postgresql://USER:PASS@127.0.0.1:5436/fixeditnow_qa
node e2e/seed.mjs > e2e/seed.json && npm run e2e:browser
```

`seed.json` (contains test-session cookies), `shots/` and `result.json` are git-ignored. Set `CHROME_PATH` if Chrome is not at `/usr/bin/google-chrome`.
Afterwards rebuild the web app without `BACKEND_URL` for normal use and drop the scratch database.
