-- AuditLog: append-only record of sensitive actions per organization.
-- Indexed for the two access patterns: "show me this org's recent activity"
-- and "show me every cancel across the platform" (the latter for support).

CREATE TABLE "AuditLog" (
  "id"             TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId"         TEXT,
  "actorEmail"     TEXT,
  "action"         TEXT NOT NULL,
  "target"         TEXT,
  "metadata"       JSONB,
  "ipAddress"      TEXT,
  "userAgent"      TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditLog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
);

CREATE INDEX "AuditLog_organizationId_createdAt_idx"
  ON "AuditLog" ("organizationId", "createdAt");

CREATE INDEX "AuditLog_action_createdAt_idx"
  ON "AuditLog" ("action", "createdAt");
