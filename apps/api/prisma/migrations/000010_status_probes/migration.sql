-- Server-side status probes — feeds the public mcpspend.com/status page with
-- real uptime history rather than the client-only check that just shows
-- "operational right now from your browser".
CREATE TABLE "StatusCheck" (
  "id" TEXT NOT NULL,
  "probe" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "latencyMs" INTEGER,
  "httpCode" INTEGER,
  "errorMsg" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StatusCheck_pkey" PRIMARY KEY ("id")
);

-- Two indexes: per-probe scan (for uptime per service) + global by date
-- (for retention cleanup).
CREATE INDEX "StatusCheck_probe_createdAt_idx"
  ON "StatusCheck"("probe", "createdAt" DESC);
CREATE INDEX "StatusCheck_createdAt_idx" ON "StatusCheck"("createdAt");
