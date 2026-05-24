-- Dollar-denominated monthly budget alerts.
-- The existing budget alert system fires on % of plan call limit. This adds
-- an orthogonal track that fires on % of a user-defined dollar budget. Both
-- can be active for the same org — one might trip before the other.

ALTER TABLE "Organization"
    ADD COLUMN "monthlyBudgetUsd"    DOUBLE PRECISION,
    ADD COLUMN "lastSpendAlertAt"    TIMESTAMP(3),
    ADD COLUMN "lastSpendAlertLevel" INTEGER;
