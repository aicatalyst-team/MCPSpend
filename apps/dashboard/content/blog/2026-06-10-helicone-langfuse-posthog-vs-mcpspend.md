---
title: "Helicone vs Langfuse vs PostHog vs MCPSpend — when to use which (and when to use all)"
excerpt: "Pick the right layer for your AI cost question. A practitioner's guide to four overlapping observability tools, with concrete examples of when each one wins."
publishedAt: "2026-06-10"
author: "Andrei Sirbu"
tags: ["comparison", "observability", "mcp"]
---

If you searched "AI cost observability" today you'd find four serious contenders: Helicone, Langfuse, PostHog, and MCPSpend. The first three predate the Model Context Protocol; MCPSpend is the youngest by ~2 years.

They overlap, but they don't compete. Each one answers a different shape of question. Here's the framework I use to pick.

## The layer model

```
┌─────────────────────────────────────────────────────────────┐
│  User asks Claude: "find the cheapest flight to Lisbon"     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ LLM-layer:  one chat completion                     │    │  ← Helicone
│  │                                                     │    │  ← Langfuse
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │ MCP tool calls (×30 typical):                │    │    │
│  │  │   playwright/navigate                        │    │    │  ← MCPSpend
│  │  │   filesystem/read_file                       │    │    │
│  │  │   fetch/fetch                                │    │    │
│  │  │   sqlite/query                               │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Product analytics (the whole thing)             ← PostHog   │
└─────────────────────────────────────────────────────────────┘
```

LLM-layer tools see the chat completion; MCPSpend sees the tool calls inside it; PostHog sees user-level events around it. Different layers, different questions.

## Helicone — when you control the LLM SDK

**Best for:** SaaS products that wrap OpenAI/Anthropic/Replicate SDK calls in their own backend.

You change `OPENAI_BASE_URL` to Helicone's proxy or swap the SDK for Helicone's wrapped one. Every LLM request goes through them; you get tokens, latency, prompt/response logging, cost.

**Strength:** Beautiful prompt/response viewer. Easy A/B testing across providers.

**Weakness:** Cannot see MCP tool calls (they happen between Claude Desktop and a local MCP server — Helicone is nowhere in that path). Cannot see inside closed IDEs (Cursor, Claude Desktop) because you can't swap their SDK.

**Use Helicone when:** "What did our SaaS chatbot cost this month, broken down by customer?"

## Langfuse — when you want prompt versioning + evals

**Best for:** Teams building LLM apps where prompt iteration is the bottleneck.

Langfuse adds an SDK call (`@trace`, `@span`) around each LLM call. You get traces, prompt version history, offline evals against test sets, user feedback loops.

**Strength:** Best prompt management on the market. Strong dev workflow.

**Weakness:** Same blindness to MCP tool calls as Helicone. Requires SDK instrumentation throughout the codebase.

**Use Langfuse when:** "Which prompt version converted better, v3.2 or v3.3, on our 500-example regression set?"

## PostHog — when you want one tool for everything

**Best for:** Teams that already run PostHog for product analytics and want one fewer vendor.

PostHog's LLM module accepts arbitrary AI events. You call `posthog.capture('$ai_generation', { ... })` from your code with whatever fields you want — tokens, cost, model, custom properties.

**Strength:** Same dashboard for product funnels + LLM events. Self-hostable. Massive free tier (1M events/month).

**Weakness:** You build the schema. No native concept of "tool", "server", "MCP". Setup to "useful AI cost view" is several hours.

**Use PostHog when:** "Show me users who hit the AI chat feature, completed signup, and then triggered ≥5 expensive prompts in the same session."

## MCPSpend — when you run agents

**Best for:** Anyone using Cursor, Claude Desktop, Windsurf, VS Code, Claude Code, or custom MCP-based agents.

MCPSpend wraps each MCP server with a transparent proxy. Every tool call gets logged — name, server, latency, cost. No SDK changes. Works in closed IDEs by sitting at the protocol level.

**Strength:** The only tool that natively understands MCP. Zero code changes. Per-tool/server/project breakdown. $ budget alerts. Audit log.

**Weakness:** Blind to LLM-layer details (you don't see prompts/responses). If your "agent" is a custom Python script that calls OpenAI directly without MCP, MCPSpend has nothing to wrap.

**Use MCPSpend when:** "Which MCP tool is driving 40% of my Cursor + Claude Desktop bill, and how do I stop it?"

## When to use ALL four

A real product team in 2026 might run:

| Layer | Tool | Why |
|---|---|---|
| Frontend events | PostHog | Funnels, session replay, feature flags |
| Internal LLM SaaS calls | Helicone | Prompt-level cost per customer |
| Internal LLM dev iteration | Langfuse | Prompt versioning + offline evals |
| Agent-driven dev work | MCPSpend | What are Cursor/Claude Desktop doing all day |

Total cost: ~$150-300/month on free + cheap tiers. The integration cost is near-zero because each tool slots into a different layer.

## The decision tree

```
Are you instrumenting an agent (uses MCP)?
├── YES → Add MCPSpend (free 25K calls/mo)
│       └── Also need LLM-level prompt logging?
│           ├── YES → Add Helicone or Langfuse
│           └── NO  → MCPSpend alone is enough
└── NO  → Are you building an LLM-only app (no tools)?
        ├── YES → Helicone (prod) or Langfuse (eval-heavy)
        └── NO  → You're probably building chatbots — PostHog is your friend
```

## My honest take after building MCPSpend

I'd never claim MCPSpend replaces Helicone, Langfuse, or PostHog. They each do something MCPSpend doesn't.

But every single existing tool is blind to the MCP tool layer where most modern agent activity happens. That's the gap we fill — and it's why we don't try to expand into prompt versioning or product analytics. Stay sharp at one layer.

If you're already running one of the others, MCPSpend slots in alongside without overlap. If you're not running any of them yet and your day-to-day involves Cursor or Claude Desktop, start with MCPSpend — the install is one command, the free tier covers a heavy solo dev, and the dashboards answer cost questions nothing else does.

[Try MCPSpend](/) — `npx @mcpspend/proxy add`. Or read the [Helicone comparison](/compare/helicone), [Langfuse comparison](/compare/langfuse), or [PostHog comparison](/compare/posthog) for the full feature matrices.
