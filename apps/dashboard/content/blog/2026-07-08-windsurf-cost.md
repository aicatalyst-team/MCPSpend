---
title: "Tracking Windsurf agent costs (Codeium / Cascade) — what's in your config that you don't know about"
excerpt: "Windsurf bundles its own MCP servers by default. Most users have no idea what's running. Here's how to find out — and what each one actually costs."
publishedAt: "2026-07-08"
author: "Andrei Sirbu"
tags: ["windsurf", "codeium", "guide"]
---

Windsurf (from Codeium) ships with several MCP servers enabled out of the box. The good news: you get useful capabilities without setup. The bad news: most users don't know what's running, let alone what each one costs.

This post walks through finding out and what to do about it.

## What Windsurf bundles

Default MCP servers (as of June 2026):

- `cascade-browser` — the in-IDE browser, used for navigation + screenshots
- `web-search` — Codeium's built-in web search
- `read-url` — URL fetch + content extraction
- `codeium-context` — codebase indexer (Codeium's proprietary)

Plus anything you've added via the Cascade UI in `~/.codeium/windsurf/mcp_config.json`.

## Finding your config

```bash
# macOS
cat ~/.codeium/windsurf/mcp_config.json

# Windows
type %USERPROFILE%\.codeium\windsurf\mcp_config.json
```

Most users have never opened this file. Take a look — there's often more there than expected.

## The cost picture

Across the 20 or so Windsurf users I've sampled in the MCPSpend dataset, the breakdown is consistent:

| Server | % of cost | Notes |
|---|---|---|
| `cascade-browser` | ~50-65% | Same pattern as Playwright — heavy DOM payloads |
| `read-url` | ~20-30% | Fetches whole pages, often large |
| `web-search` | ~10-15% | Cheap per call but called often |
| `codeium-context` | ~5-10% | Internal — minimal token cost |

The takeaway: same as Cursor + Claude Desktop — browser-style tools dominate spend because they pull verbose DOM/text into LLM context.

## Why proxy-style observability works in Windsurf

Windsurf's MCP config is stdio-based by default. Our proxy auto-detects it at `~/.codeium/windsurf/mcp_config.json` (Mac/Linux) or `%USERPROFILE%\.codeium\windsurf\mcp_config.json` (Windows) and rewrites entries to pipe through MCPSpend. Restart Windsurf, agent does its thing, data appears in the dashboard.

One quirk: Windsurf only writes the config file *after* you add a server through the UI. If you've never added one manually, the file may not exist yet. MCPSpend detects this and offers to create it.

## Step-by-step

1. `npx @mcpspend/proxy add`
2. The CLI lists Windsurf as one of the detected clients.
3. Confirm — it rewrites the config + saves a `.mcpspend.bak` copy.
4. Restart Windsurf.
5. Have a Cascade conversation. Within 30 seconds, calls appear in the dashboard.

## What I'd optimize first

Based on data from heavy Windsurf users:

1. **Disable `cascade-browser` for trivial tasks.** If you're not actively browsing, the agent shouldn't be loading pages. Cascade settings → MCP servers → toggle off.
2. **Cap context length on `read-url`.** Windsurf's MCP config supports `--max-bytes` on most fetch-style servers.
3. **Set a Slack budget alert at $20/week.** Windsurf is sneaky-expensive because the IDE itself encourages multi-step agentic workflows.

## Free tier covers most users

25,000 tool calls/month is plenty for a heavy solo Windsurf user. Pro tier ($29/mo) is for teams or background-automated agents.

```bash
npx @mcpspend/proxy add
```

[Compare Windsurf cost tools](/compare) · [Pricing](/pricing) · [Customer story](/customers/mcpspend-itself)
