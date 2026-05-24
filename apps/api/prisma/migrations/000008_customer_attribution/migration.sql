-- Per-end-customer attribution: lets resellers / agencies / SaaS-on-MCP
-- tag every tool call with their own customer identifier so the dashboard
-- can show "what did each of MY customers cost MCPSpend-wise this month".
-- Promised in the public pricing page; this delivers it end-to-end.

ALTER TABLE "ToolCall" ADD COLUMN "customerLabel" TEXT;

-- Index supports the per-customer top-N query under /api/stats/customers.
-- Partial index on the non-NULL rows keeps it tiny when most customers
-- don't set the label.
CREATE INDEX "ToolCall_org_customer_calledAt_idx"
  ON "ToolCall"("organizationId", "customerLabel", "calledAt" DESC)
  WHERE "customerLabel" IS NOT NULL;
