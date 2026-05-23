FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.0

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --filter @mcpspend/api

FROM deps AS builder
WORKDIR /app
COPY apps/api ./apps/api
RUN pnpm --filter @mcpspend/api run db:generate
RUN pnpm --filter @mcpspend/api run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["sh", "-c", "node -e 'require(\"@prisma/client\")' 2>/dev/null; npx prisma migrate deploy && node dist/index.js"]
