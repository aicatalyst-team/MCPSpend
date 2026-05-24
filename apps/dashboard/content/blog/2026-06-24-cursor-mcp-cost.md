---
title: "Cursor MCP costs: a transparent breakdown across 8 popular MCP servers"
excerpt: "Real numbers from 30 days of Cursor + MCP usage. Per-tool cost, per-session distribution, and the 3 tools you should optimize first."
publishedAt: "2026-06-24"
author: "Andrei Sirbu"
tags: ["cursor", "cost-analysis", "data"]
---

Cursor's `mcp.json` is the simplest way to add MCP servers to any agentic IDE. But once you have 5-10 servers wired up, cost attribution becomes a black box — Cursor itself doesn't tell you which server is the expensive one.

This post breaks down 30 days of real Cursor + MCP usage across the most popular servers I've seen in user installations.

## The setup

```jsonc
// ~/.cursor/mcp.json (before MCPSpend wraps it)
{
  "mcpServers": {
    "filesystem":  { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path"] },
    "github":      { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] },
    "playwright":  { "command": "npx", "args": ["-y", "@playwright/mcp"] },
    "sqlite":      { "command": "uvx", "args": ["mcp-server-sqlite", "--db-path", "/path/to.db"] },
    "fetch":       { "command": "uvx", "args": ["mcp-server-fetch"] },
    "postgres":    { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-postgres", "postgres://..."] },
    "memory":      { "command": "npx", "args": ["-y", "@modelcontextprotocol/server-memory"] },
    "time":        { "command": "uvx", "args": ["mcp-server-time"] }
  }
}
```

8 servers. That's a typical heavy-Cursor user.

## The 30-day breakdown

| Server | Calls | Cost | $/call avg |
|---|---|---|---|
| playwright | 2,140 | $5.42 | $0.00253 |
| filesystem | 984 | $1.71 | $0.00174 |
| github | 612 | $1.40 | $0.00229 |
| fetch | 511 | $1.05 | $0.00205 |
| sqlite | 287 | $0.66 | $0.00230 |
| postgres | 142 | $0.37 | $0.00261 |
| memory | 89 | $0.18 | $0.00202 |
| time | 23 | $0.04 | $0.00174 |

**Top finding:** Playwright is 5.4× the next-biggest server. If you use it, that's where to look first.

## The per-tool drill-down

Inside Playwright, the cost distribution is even more skewed:

- `browser_navigate` — 71% of Playwright spend
- `browser_take_screenshot` — 14%
- `browser_click` — 8%
- everything else — 7%

`browser_navigate` returns the full page DOM by default. For a moderately complex site that's 80-150 KB of HTML → 20K-40K tokens stuffed into context every time. Three optimizations that helped:

1. **Scrape DOM subtree, not full page.** Use `browser_evaluate` to grab `document.querySelector('main').outerHTML` instead — typically 5-10× smaller payload.
2. **Cache navigations within a session.** If your agent visits the same URL twice in 60 seconds, the second `browser_navigate` is wasted.
3. **Use `browser_snapshot` for state checks.** It returns accessibility tree (text-only), not HTML — way cheaper.

## How to do this analysis yourself

```bash
npx @mcpspend/proxy add
```

That's the entire setup. The CLI auto-detects Cursor's config, wraps every MCP server, and starts streaming data. Open the dashboard, wait a week of normal use, and the same table above appears for *your* usage.

Free tier covers 25,000 tool calls/month — that's a heavy Cursor user.

## Counterpoint: when not to do this

If you only use 1-2 MCP servers and your monthly bill from Anthropic is under $20, this is overkill. The value kicks in around 5+ servers or $30+/month in Cursor usage. Below that, the manual mental model works fine.

## Try it

[`npx @mcpspend/proxy add`](https://www.npmjs.com/package/@mcpspend/proxy) · MIT licensed · [pricing](/pricing) · [security](/security)
