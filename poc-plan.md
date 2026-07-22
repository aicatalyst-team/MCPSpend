# PoC Plan: MCPSpend

## Project Classification
- **Type:** web-app
- **Key Technologies:** Node.js 20, TypeScript, Express, Prisma, PostgreSQL, BullMQ, Redis, Next.js 15, React 19, pnpm workspaces, Turborepo
- **ODH Relevance:** MCP observability platform demonstrates multi-container application deployment on OpenShift. The MCP protocol monitoring aligns with Red Hat AI's agentic AI story for tool cost attribution.

## PoC Objectives
1. Containerize the API and Dashboard using UBI-based images
2. Deploy as a multi-container application with PostgreSQL and Redis on OpenShift
3. Verify the API health endpoint and dashboard serve correctly
4. Demonstrate the multi-service architecture works end-to-end on the platform

## Infrastructure Requirements
- **Resource Profile:** medium
- **GPU Required:** no
- **Persistent Storage:** PostgreSQL PVC (1Gi)
- **Sidecar Containers:** none (PostgreSQL and Redis are separate pods)

## Test Scenarios

### Scenario 1: api-health
- **Description:** Check the API health endpoint
- **Type:** http
- **Input:** GET /health
- **Expected:** Returns 200 with {"status":"ok"}
- **Timeout:** 30 seconds

### Scenario 2: dashboard-load
- **Description:** Check the dashboard serves its frontend
- **Type:** http
- **Input:** GET /
- **Expected:** Returns 200 with HTML content
- **Timeout:** 30 seconds

### Scenario 3: api-public-status
- **Description:** Check the public status endpoint
- **Type:** http
- **Input:** GET /api/public/status
- **Expected:** Returns 200 with status information
- **Timeout:** 30 seconds

## Dockerfile Considerations
- Convert from node:20-alpine to ubi9/nodejs-22 (closest UBI Node.js image)
- The monorepo uses pnpm workspaces; build context needs root package.json and workspace configs
- Dashboard needs NEXT_PUBLIC_API_URL at build time
- API runs prisma migrate deploy at startup
- Worker shares API image with different CMD

## Deployment Considerations
- **Deployment model:** deployment (long-running services with ports)
- **Services:** API (port 4000), Dashboard (port 3000)
- **Infrastructure pods:** PostgreSQL (port 5432), Redis (port 6379)
- **Secrets:** JWT_SECRET, DATABASE_URL, REDIS_URL
- **PVC:** PostgreSQL data (1Gi)
