# syntax=docker/dockerfile:1
# Build from frontend/:
#   docker build --build-arg BACKEND_URL=http://api:4000 -t fixeditnow-web .
# BACKEND_URL is baked into the /api/v1/* rewrite at BUILD time (Next reads it in next.config.ts),
# and is also read at run time by server components, so pass the same value to `docker run -e BACKEND_URL=...`.
# Behind a production reverse proxy that routes /api/v1/* straight to the API, the rewrite is never used.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG BACKEND_URL=http://localhost:4000
ENV BACKEND_URL=$BACKEND_URL NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* values are inlined at build time: pass NEXT_PUBLIC_SITE_URL here for production.
ARG NEXT_PUBLIC_SITE_URL=
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
