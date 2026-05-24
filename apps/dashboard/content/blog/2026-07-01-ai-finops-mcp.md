---
title: "AI FinOps for the MCP era: why per-call cost attribution is becoming table stakes"
excerpt: "Cloud FinOps took 5 years to mature. AI FinOps is repeating the same arc — but the unit of cost is now the MCP tool call, not the EC2 instance."
publishedAt: "2026-07-01"
author: "Andrei Sirbu"
tags: ["finops", "industry", "thesis"]
---

If you remember the early days of cloud, you'll recognize the pattern. Around 2014-2018, companies got hit with surprise AWS bills because they had no per-team, per-environment, per-feature attribution. The solution arrived in waves:

1. **2015:** Cost & Usage Reports + custom dashboards (Vantage, CloudHealth)
2. **2017:** Tag-based showback / chargeback (every infrastructure team's standard)
3. **2019:** Real-time anomaly detection (alerts on spike-vs-baseline)
4. **2021:** Unit economics (cost per request, cost per active user)

Each wave needed new tooling. None of them existed in 2014. By 2022 you couldn't run a serious cloud team without them.

**AI agents are now where cloud was in 2015.**

## The unit shift

Cloud FinOps measures `$ per EC2-hour` or `$ per S3-GB-month`. The unit is a resource consumed over time.

AI FinOps in the LLM-only era (2023-2024) measured `$ per chat completion`. That worked when one prompt = one cost event. Tools like Helicone, Langfuse and PostHog built their dashboards around that unit.

But agentic workflows broke this model. A single user prompt now triggers 30-80 MCP tool calls in the background. The unit needs to shift to:

```
$ per MCP tool call
× attributed to:
    - which MCP server
    - which agent / IDE
    - which project / customer
    - which prompt / session
```

That's the granularity that lets you do the things FinOps did for cloud:

- **Showback:** "Customer ACME's agent activity cost $312 this month — bill it back to their account."
- **Anomaly detection:** "Playwright cost jumped 5× yesterday because someone shipped an agent that scrapes 200 pages instead of 20."
- **Unit economics:** "Our AI feature costs $0.04 per query — at $4/month subscription that's profitable above 10 queries."
- **Optimization triage:** "playwright/browser_navigate is 40% of our spend. Fix that first."

None of these are possible with LLM-call-level data alone.

## Why MCP makes this finally tractable

Pre-MCP, every agent integration was custom code calling provider SDKs. There was no standard observation point. You either instrumented every codebase by hand (expensive, brittle) or you put a proxy in front of OpenAI/Anthropic (limited — misses tool calls).

MCP changed this. Every MCP server speaks the same JSON-RPC dialect over stdio or HTTP. **One proxy can observe every tool call**, regardless of which server, which client, which provider. It's the FinOps equivalent of EC2 finally having consistent tags.

## What "good" looks like in 2026-2027

Companies that scale AI agent usage will adopt the same FinOps maturity ladder cloud did, just on a 2-3x faster timeline:

| Cloud FinOps year | Practice | AI FinOps equivalent |
|---|---|---|
| 2015 | Custom CUR dashboards | Per-tool cost dashboard |
| 2017 | Tag-based showback | Per-customer attribution |
| 2019 | Real-time anomaly alerts | Tool-cost spike alerts (3× baseline) |
| 2021 | Unit economics | $ per agent task / per user query |

**My prediction:** in 18 months, the question "what does it cost when a customer asks our agent X?" will be as foundational for AI-product teams as "what does it cost to serve a page?" was for cloud-native teams in 2018. The teams without per-tool attribution will be flying blind.

## How MCPSpend fits

We're building the AI FinOps stack at the MCP layer specifically — not LLM-call observability (Helicone does that better), not generic event analytics (PostHog does that better). Just the missing layer: every MCP tool call, attributed to its tool, server, project, end-customer.

If you're running agentic workflows seriously, you want this layer regardless of whether it's us providing it.

## Try it

```bash
npx @mcpspend/proxy add
```

Free 25K calls/month. EU-hosted, GDPR-ready, MIT-licensed proxy on npm.

[Pricing](/pricing) · [Compare with Helicone, Langfuse, PostHog](/compare) · [Customer story: 38% cost cut in 3 weeks](/customers/mcpspend-itself)
