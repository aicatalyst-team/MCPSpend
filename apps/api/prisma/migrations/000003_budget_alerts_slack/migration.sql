-- Slack webhook + throttled budget alerts.
-- Email already exists in templates.ts (budgetAlertEmail) — this adds the org
-- columns needed to actually trigger it: a destination Slack URL and a
-- de-duplication marker so we don't spam users when usage hovers around the
-- threshold.

ALTER TABLE "Organization"
    ADD COLUMN "slackWebhookUrl"      TEXT,
    ADD COLUMN "lastBudgetAlertAt"    TIMESTAMP(3),
    ADD COLUMN "lastBudgetAlertLevel" INTEGER;
