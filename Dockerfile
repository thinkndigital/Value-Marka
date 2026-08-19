# Cloud Run image for Value Marka. Multi-stage build against Next.js's
# `output: "standalone"` bundle (see next.config.ts) — the final image ships
# only the traced production dependencies, not the full node_modules tree.
#
# Debian-based (not Alpine): Prisma's generated client is fine on either in
# this project's driver-adapter setup (no native engine binaries — see
# DEPLOYMENT.md), but Debian avoids the historical musl/OpenSSL surprises
# other native deps (e.g. sharp) can hit on Alpine.

FROM mirror.gcr.io/library/node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM mirror.gcr.io/library/node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Only needed so `prisma generate`/`next build` can load prisma.config.ts
# (it validates DATABASE_URL is *set*, never connects at build time — no
# real database is reachable or required during the image build).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate
RUN npm run build

FROM mirror.gcr.io/library/node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
EXPOSE 8080

CMD ["node", "server.js"]
