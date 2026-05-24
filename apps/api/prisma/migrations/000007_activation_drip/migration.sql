-- Track which activation drip emails each user has received so the
-- maintenance scheduler never duplicates an email even if the worker
-- restarts mid-tick.
ALTER TABLE "User" ADD COLUMN "activationDay2SentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "activationDay5SentAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "reactivationDay14SentAt" TIMESTAMP(3);

-- We query users by these timestamps + createdAt + a "no tool calls yet"
-- join in the scheduler. A partial index on the "not yet sent" rows keeps
-- the scan tiny since most rows will have a value once the cohort ages out.
CREATE INDEX "User_activation_drip_idx" ON "User"("createdAt") WHERE
  "activationDay2SentAt" IS NULL
  OR "activationDay5SentAt" IS NULL
  OR "reactivationDay14SentAt" IS NULL;
