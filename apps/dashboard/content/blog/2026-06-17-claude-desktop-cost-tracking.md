---
title: "How to track Claude Desktop costs (the missing observability layer)"
excerpt: "Anthropic shows you total usage; it doesn't show you which MCP tool spent it. Here's how to attribute every dollar to its tool, server, and project."
publishedAt: "2026-06-17"
author: "Andrei Sirbu"
tags: ["claude-desktop", "cost-tracking", "guide"]
---

If you use Claude Desktop with MCP servers (filesystem, GitHub, Playwright, custom), you've probably noticed that Anthropic's usage dashboard tells you *how much* you spent but not *what on*. This post walks through how to fix that in 60 seconds.

## What Anthropic shows you

Open `claude.ai/settings/usage` and you'll see:
- Total token usage by month
- Cost per model
- Daily breakdown

What's missing:
- Which MCP tool consumed the tokens
- Which project / conversation / time of day was expensive
- Whether one runaway agent session is dominating

For most users this is fine. For anyone running Playwright MCP, a custom database MCP, or multiple parallel agents, the missing breakdown is exactly where the surprises live.

## The minimum setup

Install MCPSpend's proxy:

```bash
npx @mcpspend/proxy add
```

That's it. The CLI auto-detects Claude Desktop's config (`claude_desktop_config.json` on macOS/Windows) and rewrites it to wrap every MCP server you have. Restart Claude Desktop, make any tool call, and the data lands in your dashboard in real time.

Total time: under a minute. Zero changes to Anthropic's settings.

## What you actually get

After 24 hours of normal usage, the dashboard shows you:

1. **Per-tool cost ranking.** Usually 2-3 tools account for 60-80% of spend.
2. **Per-session drill-down.** Click a session → see every tool call it made with cost and latency.
3. **Budget alerts.** Email or Slack when you hit 50/80/100% of a dollar threshold you set.
4. **Comparison week-over-week.** "Playwright cost 3× more than last week" surfaces fast.

## A real example

From my own Claude Desktop usage over the last 30 days:

| Tool | Calls | Cost | % of total |
|---|---|---|---|
| playwright/browser_navigate | 1,820 | $3.92 | 40% |
| filesystem/read_file | 984 | $1.71 | 17% |
| github/search_repos | 612 | $1.40 | 14% |
| _everything else_ | 1,996 | $2.81 | 29% |

Three tools = 71% of the bill. Knowing this, I refactored my QA agent to scrape a DOM subtree instead of the full page — Playwright cost dropped 60%.

## The free tier

MCPSpend's free plan is 25,000 tool calls per month, no credit card required. For most solo Claude Desktop users that's more than a month of heavy use. If you run automated agents that exceed that, Pro starts at $29/month.

## Try it

```bash
npx @mcpspend/proxy add
```

You'll get a dashboard URL within seconds. No SDK changes, no code edits, works alongside Anthropic's existing tooling without interference.

[See pricing](/pricing) · [Read the security model](/security) · [Compare with Helicone](/compare/helicone)
