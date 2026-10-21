# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=24.19.0-bookworm-slim

FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

FROM base AS builder
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# Prisma 7 reads its datasource URL from prisma.config.ts during generation.
# This non-routable placeholder is build-only and is not copied into the runtime stage.
RUN DATABASE_URL="postgresql://127.0.0.1:5432/build?schema=public" npm run db:generate
RUN ./node_modules/.bin/next build

FROM base AS maintenance-runner
ENV NODE_ENV=production
COPY scripts/run-maintenance-job.mjs ./scripts/run-maintenance-job.mjs
ENTRYPOINT ["node", "scripts/run-maintenance-job.mjs"]

FROM base AS web
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN mkdir -p .next && chown node:node .next
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/healthz').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "server.js"]

FROM base AS document-processing-worker
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/server ./server
COPY --from=builder /app/scripts/staging-target-guard.ts ./scripts/staging-target-guard.ts
COPY --from=builder /app/scripts/document-processing-worker.ts ./scripts/document-processing-worker.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/package.json ./package.json
RUN node --conditions=react-server --import tsx -e "import('./server/database/database-url.ts')"
USER node
CMD ["node", "--conditions=react-server", "--import", "tsx", "scripts/document-processing-worker.ts"]
