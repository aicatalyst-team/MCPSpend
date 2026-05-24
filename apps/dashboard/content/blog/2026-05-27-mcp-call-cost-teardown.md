---
title: "What does a real MCP tool call actually cost?"
excerpt: "A teardown of 30 days of Cursor + Claude Desktop usage, broken down per server, per tool, per project. The cost curve is steeper than you think."
publishedAt: "2026-05-27"
author: "Andrei Sirbu"
tags: ["data", "mcp", "cost-analysis"]
---

Most "AI cost" articles talk in the abstract — "tokens are getting cheaper", "agents are expensive". Useful, but you can't act on it. So I pulled the raw data from my own MCPSpend account for the past 30 days and broke it down by every dimension MCPSpend tracks.

If you run agents in Cursor or Claude Desktop, this is what your numbers probably look like too.

## The headline

In 30 days I made **5,412 MCP tool calls** across **9 servers** in **3 projects**. Total estimated cost: **$9.84**.

That feels cheap. It is, for a solo dev. But it also hides the distribution that matters.

## Top tools by cost

| Tool | Calls | Cost | % of total |
|---|---|---|---|
| playwright/browser_navigate | 1,820 | $3.92 | 39.8% |
| filesystem/read_file | 984 | $1.71 | 17.4% |
| github/search_repos | 612 | $1.40 | 14.2% |
| fetch/fetch | 511 | $1.05 | 10.7% |
| sqlite/query | 287 | $0.66 | 6.7% |
| (everything else, 5 tools) | 1,198 | $1.10 | 11.2% |

Three tools account for **71% of the spend**. That's a fat-tail distribution most cost tracking is blind to — Helicone or Langfuse would just show you "$9.84 on Claude this month" and call it done.

## What this means in practice

When you can see the breakdown, you make different choices:

- **playwright/browser_navigate** at 39.8% is the biggest signal. Browser automation is verbose — every `navigate` call comes back with a giant DOM snapshot which gets stuffed into context. Could I prune the DOM before returning? Could I cache navigations across sessions?
- **filesystem/read_file** at 17.4% is mostly redundant. Cursor and Claude Desktop both re-read files multiple times in the same session. A small cache on the proxy side could halve this.
- **github/search_repos** at 14.2% is mostly me asking "where is this in the codebase" — could be answered by a local grep most of the time.

These are 3 optimisations I never would have considered without per-tool cost attribution.

## The per-project view

I split usage across 3 projects: `work-client-a` (browser-heavy QA agent), `mcpspend-itself` (this dashboard's own dev work), `side-experiments`.

- work-client-a: $5.84 (59% of spend, but billable so net positive)
- mcpspend-itself: $3.10 (31% — building the product is the product's biggest customer 😅)
- side-experiments: $0.90 (10%)

Per-project breakdown is the killer feature for anyone who:
- Bills clients for agentic work (need to show what each cost)
- Runs multiple internal experiments and wants to know which deserves more budget
- Has a budget split between teams

## The cost forecast

MCPSpend projects end-of-month based on linear extrapolation of the daily average. At day 24, I'm projected to hit **$12.30 for the month**, which is comfortably inside my $25 personal budget.

But three weeks ago I was projected for $30 (because I'd been doing more Playwright work). The Slack alert at 80% gave me a heads-up; I refactored the worst offender; the curve flattened.

That's the value of real-time observability vs end-of-month surprise.

## How to do this teardown yourself

If you have MCPSpend installed, the dashboard at [mcpspend.com/dashboard](https://mcpspend.com/dashboard) shows all of this out of the box — KPI cards, top tools, per-project totals.

If you don't yet, the free tier (25K calls/month, no card) is more than enough for a single-dev profile:

```bash
npx @mcpspend/proxy add
```

It auto-detects every MCP client on your machine, asks for confirmation, and starts logging. Data appears in under 60 seconds after the first tool call.

## Next time

Next post (Wed): "How I built the auto-detection logic that handles 5 different MCP-client config formats."

Subscribe to the [RSS feed](/blog/rss.xml) or follow me on [X](https://x.com/andreisirbu91) if useful.
