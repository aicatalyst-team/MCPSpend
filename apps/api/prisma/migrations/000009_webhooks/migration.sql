-- Customer-defined webhooks: lets users POST our events to any URL they own
-- (PagerDuty, Datadog, Zapier, custom). Signed with HMAC-SHA256 so the
-- receiver can verify authenticity.

CREATE TABLE "Webhook" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "targetUrl" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "events" TEXT[] NOT NULL DEFAULT '{}',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastDeliveryAt" TIMESTAMP(3),
  "lastDeliveryStatus" INTEGER,
  "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Webhook_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Webhook_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Webhook_organizationId_idx" ON "Webhook"("organizationId");

-- One row per delivery attempt. Used by the dashboard "last 100 events" view
-- and by the auto-disable logic (5+ consecutive failures → flip isActive).
CREATE TABLE "WebhookEvent" (
  "id" TEXT NOT NULL,
  "webhookId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "httpStatus" INTEGER,
  "responseBody" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 1,
  "succeeded" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WebhookEvent_webhookId_fkey" FOREIGN KEY ("webhookId")
    REFERENCES "Webhook"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "WebhookEvent_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "WebhookEvent_webhookId_createdAt_idx"
  ON "WebhookEvent"("webhookId", "createdAt" DESC);
CREATE INDEX "WebhookEvent_organizationId_createdAt_idx"
  ON "WebhookEvent"("organizationId", "createdAt" DESC);
