---
title: "I built MCPSpend because Claude Desktop kept eating my money"
excerpt: "An honest writeup of building the first cost-observability tool for the Model Context Protocol — what worked, what surprised me, and the numbers nobody talks about."
publishedAt: "2026-05-24"
author: "Andrei Sirbu"
tags: ["launch", "mcp", "engineering"]
---

It's late 2025. I'm running 4 agents in parallel — Claude Desktop, Cursor, Windsurf, plus a few custom MCP servers I wrote for client work. Bills from Anthropic and OpenAI keep climbing. I check the dashboards and see the totals, but I have zero idea **which** tool call, **which** server, **which** project is actually expensive.

Existing AI observability tools fall in two buckets:

- **LLM-layer**: Helicone, Langfuse, Portkey. They see every chat completion. Brilliant. But invisible to the MCP tool layer — they only see "Claude answered the prompt", not "Claude called `read_file` 47 times to answer it".
- **Generic analytics**: PostHog, Mixpanel. Powerful, but you build the schema yourself. By the time you've instrumented every `tools/call`, you've shipped half of MCPSpend.

I had two options: stitch something together in spreadsheets every month, or build it.

I built it. Here's what 3 weeks of nights-and-weekends produced.

## How MCPSpend works (60 seconds)

```bash
npx @mcpspend/proxy add
```

That's it. One command. The CLI auto-detects Claude Desktop, Cursor, Windsurf, VS Code, and Claude Code on your machine, finds every MCP server you've configured, and rewrites the config to wrap each one with a transparent proxy.

The proxy sits between your MCP client and your MCP server — same stdio protocol, same JSON-RPC messages going through unchanged. But on every `tools/call`, the proxy records:

- Server name + tool name
- Latency
- Success / error
- Approximate payload size (bytes → tokens via per-model estimates)

Then it streams that metadata to `api.mcpspend.com/v1/ingest` over HTTPS, authenticated with your API key.

What the proxy does **not** send: the actual tool arguments, the actual tool responses, your file contents, your prompts. Privacy-by-design, not as marketing copy.

## The dashboard answers the questions I had

1. **"Which tool is eating my budget?"** — top-N tools by cost, with gradient bars showing the relative ratios. The top 3 get amber dots so my eye goes there first.
2. **"How much is each agent run actually costing?"** — sessions view with drill-down. I can see one Claude Code session that spent 47 cents over 2 hours, mostly on Playwright `browser_navigate`.
3. **"Will I hit my budget this month?"** — linear projection from the daily average. With Slack alerts at 50/80/100% so I don't get surprised.
4. **"Which customer / project drove this month's bill?"** — projects assign each MCP server to a label. Per-project totals. Eventually CSV export for the CFO.

## The 3 things that surprised me building this

### 1. MCP tool calls happen ~30x more than LLM calls

A single prompt to Claude Desktop with "find all the React components that import this hook" triggers maybe one LLM round-trip — but 50-80 MCP tool calls (filesystem reads, greps, etc.). Existing tools that count "requests" undercount AI agent activity by an order of magnitude.

This was the entire reason MCPSpend's free tier is 25,000 calls/month instead of 10K. The unit is fundamentally different.

### 2. Closed IDEs are a moat, not a limitation

Cursor and Claude Desktop don't expose hooks. You can't wrap the SDK. The only way to observe what they're doing is from outside — by intercepting the MCP protocol.

This is bad news for tools that work via SDK instrumentation. It's great news for a transparent stdio proxy — the proxy doesn't care if the consumer is closed source. **MCPSpend works in IDEs where every other observability tool is blind.** I didn't fully appreciate this until 2 weeks in.

### 3. Auto-detect saves the product

The first version required users to manually edit JSON config files. Setup took 10 minutes per IDE. Drop-off was brutal.

V2 added `add` mode that auto-detects every MCP client on your machine, lists the servers it found, asks for confirmation, then rewrites the configs in-place (with `.mcpspend.bak` backups). Setup is now under 60 seconds. Conversion to "first tool call observed" went from ~30% to ~80%.

If your product depends on config-file editing, autodetect is not nice-to-have — it's the difference between shipping and not shipping.

## The stack

```
Proxy:     TypeScript, ~800 LOC, MIT on npm
           No runtime deps beyond Node std lib
           Auto-publishes to npm + Smithery via GitHub Actions

API:       Express + Prisma 6 + Postgres 16
           BullMQ workers on Redis
           Stripe billing, Resend for transactional email
           Audit log, GDPR Art. 15/17/20 self-serve

Dashboard: Next.js 15, Tailwind, Recharts → SVG sparklines
           Cookie consent banner (GDPR opt-in), GA4 only after consent

Infra:     Coolify on Hostinger EU VPS
           AES-256-GCM for secrets at rest, SHA-256 for API key hashes
           Public SECURITY.md + RFC 9116 security.txt
           SOC 2 Type I in progress with Vanta
```

The whole proxy fits in a single small file. The complex part isn't the protocol — it's the auto-detection logic that handles 5 different IDEs' config quirks.

## Where MCPSpend is today

- **Free tier**: 25,000 tool calls/month, forever, no card required
- **Pro**: $29/month, 1M calls, unlimited projects, CSV export, Slack alerts, 90-day retention
- **Team**: $99/month, 10M calls, audit log, members + roles
- **Enterprise**: $499/month, unlimited, DPA, dedicated deploy option
- **Self-host**: the proxy is MIT, the MCP server is MIT, run the whole thing locally if you want

Listed on Smithery, the official MCP Registry, mcp.so, glama.ai, and several MCP catalogs.

## What I'd love feedback on

If you try it (`npx @mcpspend/proxy add`), I'd love to hear:

1. **Where the install flow surprised you** — did auto-detection find the right configs?
2. **Which dashboard view should I build next** — what cost question are you currently not getting answered?
3. **The cost estimates** — they're per-model, derived from token counts. How close are they to your actual provider invoices?

Issues / PRs welcome at [github.com/andreisirbu91-lab/MCPSpend](https://github.com/andreisirbu91-lab/MCPSpend).

I'm shipping in public — monthly revenue updates on [Indie Hackers](https://www.indiehackers.com). DMs open on X [@andreisirbu91](https://x.com/andreisirbu91).

— Andrei, building MCPSpend solo from Bucharest 🇷🇴
