-- Lower free-tier monthly call limit from 50k to 25k. 50k let heavy users
-- live on free forever. Existing FREE orgs are migrated to the new limit.

ALTER TABLE "Organization" ALTER COLUMN "callsLimit" SET DEFAULT 25000;

UPDATE "Organization"
   SET "callsLimit" = 25000
 WHERE "plan" = 'FREE'
   AND "callsLimit" = 50000;
