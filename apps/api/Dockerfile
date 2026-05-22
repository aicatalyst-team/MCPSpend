FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.0

# ── Dependencies ──────────────────────────────────────────────
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --filter @mcpspend/api

# ── Build ─────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app
COPY apps/api ./apps/api
RUN pnpm --filter @mcpspend/api run db:generate
RUN pnpm --filter @mcpspend/api run build

# ── Production image ──────────────────────────────────────────
FROM node:20-alpine AS runner
RUN npm install -g pnpm@9.15.0
WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --filter @mcpspend/api --prod

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

WORKDIR /app/apps/api

# Run migrations then start API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

EXPOSE 4000
