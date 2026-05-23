FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.0

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/dashboard/package.json ./apps/dashboard/
RUN pnpm install --frozen-lockfile --filter @mcpspend/dashboard

FROM deps AS builder
WORKDIR /app
COPY apps/dashboard ./apps/dashboard
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @mcpspend/dashboard run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/dashboard/.next/standalone ./
COPY --from=builder /app/apps/dashboard/.next/static ./apps/dashboard/.next/static
RUN mkdir -p ./apps/dashboard/public
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public/

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/dashboard/server.js"]
