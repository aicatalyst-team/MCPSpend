-- CompatReport: anonymous fingerprints sent by mcpspend CLI so we get alerted
-- when a target client changes its config schema and our discovery breaks.

CREATE TABLE "CompatReport" (
  "id"           TEXT NOT NULL,
  "cliVersion"   TEXT NOT NULL,
  "platform"     TEXT NOT NULL,
  "clientId"     TEXT NOT NULL,
  "status"       TEXT NOT NULL,
  "configFormat" TEXT,
  "fingerprint"  TEXT,
  "serverCount"  INTEGER,
  "wrappedCount" INTEGER,
  "errorSummary" TEXT,
  "ipHash"       TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompatReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompatReport_clientId_fingerprint_createdAt_idx"
  ON "CompatReport" ("clientId", "fingerprint", "createdAt");

CREATE INDEX "CompatReport_clientId_createdAt_idx"
  ON "CompatReport" ("clientId", "createdAt");
