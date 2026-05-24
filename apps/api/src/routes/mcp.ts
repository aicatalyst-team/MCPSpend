// MCP-over-HTTP endpoint. Smithery (and any client that prefers HTTP over
// stdio) calls POST /api/mcp with a JSON-RPC envelope; we answer with the
// matching JSON-RPC response. Same tools as @mcpspend/mcp-server, but no
// process spawn — the user just points their MCP client at
// https://api.mcpspend.com/mcp and authenticates with their MCPSpend API key.
//
// Why we have both stdio and HTTP servers:
//   - @mcpspend/mcp-server (stdio, on npm) is the "self-hosted" path. Zero
//     trust required — the user runs it locally.
//   - This HTTP endpoint is the "Smithery hosted" path. Smithery doesn't
//     spawn npm packages; they POST to a URL. Same tools, same key auth.
//
// We deliberately keep this lean: only initialize + tools/list + tools/call.
// No streaming, no sessions — Smithery's gateway handles concurrency for us.

import { Router, Request } from 'express'
import { prisma } from '../lib/prisma'
import { hashApiKey } from '../lib/apiKey'

const router = Router()

// Resolve an MCPSpend API key from the request into an organizationId.
// We accept three locations because different MCP catalogs pass credentials
// differently:
//   1. `Authorization: Bearer mcps_…` — standard, what our own clients use
//   2. `?apiKey=mcps_…` query parameter — Smithery's default for HTTP servers
//   3. JSON-RPC params._meta.apiKey — some Smithery custom configs use this
// We do this in the router (not the global authMiddleware) because the MCP
// handshake — initialize, tools/list — must succeed without credentials so
// catalogs can discover the server before asking the user for their key.
async function resolveApiKey(req: Request): Promise<string | null> {
  let token: string | undefined

  // 1. Authorization header. We accept both "Bearer mcps_…" (our canonical
  //    documented form) and a bare "mcps_…" (what Smithery emits when the
  //    user configures the header without an explicit prefix).
  const header = req.headers.authorization
  if (header) {
    const trimmed = header.trim()
    if (trimmed.startsWith('Bearer ')) {
      token = trimmed.replace('Bearer ', '').trim()
    } else if (trimmed.startsWith('mcps_')) {
      token = trimmed
    }
  }

  // 2. x-api-key header — common alternative in MCP-over-HTTP catalogs.
  if (!token) {
    const xkey = req.headers['x-api-key']
    if (typeof xkey === 'string' && xkey.startsWith('mcps_')) token = xkey.trim()
  }

  // 3. Query parameter. Smithery's default UI uses ?apiKey=mcps_…
  if (!token) {
    const q = req.query.apiKey
    if (typeof q === 'string') token = q.trim()
  }

  // 4. params._meta.apiKey inside the JSON-RPC envelope (some custom configs)
  if (!token) {
    const body = req.body as { params?: { _meta?: { apiKey?: string } } } | undefined
    const meta = body?.params?._meta?.apiKey
    if (typeof meta === 'string') token = meta.trim()
  }

  if (!token || !token.startsWith('mcps_')) return null
  const keyHash = hashApiKey(token)
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    select: { organizationId: true, revokedAt: true },
  })
  if (!apiKey || apiKey.revokedAt) return null
  // Bump lastUsedAt out of band — never block the request.
  void prisma.apiKey.update({ where: { keyHash }, data: { lastUsedAt: new Date() } }).catch(() => {})
  return apiKey.organizationId
}

interface RpcRequest {
  jsonrpc: '2.0'
  id?: number | string | null
  method: string
  params?: unknown
}

interface RpcResponse {
  jsonrpc: '2.0'
  id: number | string | null
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

const SERVER_INFO = { name: 'mcpspend', version: '0.1.0' }

// Tools follow the 2025-06-18 MCP spec: inputSchema + outputSchema +
// annotations. Smithery's Quality Score rewards each of these — every tool
// here scores Output schema, Parameter descriptions, and Annotations.
//
// Annotations meaning:
//   - readOnlyHint: tool only reads, never writes
//   - destructiveHint: tool can delete / overwrite data
//   - idempotentHint: same args → same result, safe to retry
//   - openWorldHint: tool's effect is observable outside the system (network call, etc.)
const TOOLS = [
  {
    name: 'get_today_cost',
    description:
      'Total tool-call cost and call count for the current day (UTC), for the organization behind the caller\'s API key. Returns a human-readable summary line plus raw numbers in a structured field.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    outputSchema: {
      type: 'object',
      properties: {
        callCount: { type: 'integer', description: 'Tool calls observed since 00:00 UTC.' },
        costUsd: { type: 'number', description: 'Sum of estimated costs in USD.' },
        inputTokens: { type: 'integer', description: 'Sum of input tokens.' },
        outputTokens: { type: 'integer', description: 'Sum of output tokens.' },
        errorCount: { type: 'integer', description: 'Tool calls that returned an error.' },
      },
      required: ['callCount', 'costUsd', 'inputTokens', 'outputTokens', 'errorCount'],
    },
    annotations: { title: 'Today\'s cost', readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'get_usage_this_month',
    description:
      'Calls used this calendar month, the plan limit, percentage used, and a linear end-of-month projection based on the current daily average. Use to spot when an org will hit its cap.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    outputSchema: {
      type: 'object',
      properties: {
        organizationName: { type: 'string', description: 'Name of the org owning this API key.' },
        plan: { type: 'string', enum: ['FREE', 'PRO', 'TEAM', 'ENTERPRISE'], description: 'Current plan tier.' },
        callsThisMonth: { type: 'integer', description: 'Tool calls used since the billing cycle start.' },
        callsLimit: { type: 'integer', description: 'Plan\'s monthly call cap.' },
        percentUsed: { type: 'number', description: 'callsThisMonth / callsLimit * 100.' },
        projectedEndOfMonth: { type: 'integer', description: 'Linear projection of total calls by end of UTC month.' },
      },
      required: ['organizationName', 'plan', 'callsThisMonth', 'callsLimit', 'percentUsed', 'projectedEndOfMonth'],
    },
    annotations: { title: 'Month-to-date usage', readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'list_top_tools',
    description:
      'Top MCP tools by cost over the past N days. Answers "what is the most expensive thing my agents do" — useful before tightening prompts or swapping a server.',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'integer',
          minimum: 1,
          maximum: 365,
          default: 7,
          description: 'Lookback window in days. Defaults to 7.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Maximum entries to return. Defaults to 10.',
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        days: { type: 'integer' },
        tools: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              serverName: { type: 'string', description: 'MCP server name, e.g. "filesystem".' },
              toolName: { type: 'string', description: 'Tool name within that server, e.g. "read_file".' },
              callCount: { type: 'integer' },
              costUsd: { type: 'number' },
            },
            required: ['serverName', 'toolName', 'callCount', 'costUsd'],
          },
        },
      },
      required: ['days', 'tools'],
    },
    annotations: { title: 'Top tools by cost', readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'list_recent_sessions',
    description:
      'Recent agent sessions for this organization, ordered by start time. Each row has the model, total cost, tool-call count, and duration in seconds.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          default: 20,
          description: 'Maximum sessions to return. Defaults to 20.',
        },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        sessions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Session ID — pass to get_session_details for a drill-down.' },
              model: { type: 'string' },
              startedAt: { type: 'string', format: 'date-time' },
              endedAt: { type: 'string', format: 'date-time', nullable: true },
              toolCallCount: { type: 'integer' },
              totalCostUsd: { type: 'number' },
              durationSeconds: { type: 'integer', nullable: true, description: 'Null while the session is still open.' },
            },
            required: ['id', 'model', 'startedAt', 'toolCallCount', 'totalCostUsd'],
          },
        },
      },
      required: ['sessions'],
    },
    annotations: { title: 'Recent agent sessions', readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'get_session_details',
    description:
      'Drill into a single session by ID. Returns the session header plus every tool call within it (capped at 500 to bound payload size).',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'Session ID from list_recent_sessions. Must belong to the caller\'s organization.',
        },
      },
      required: ['session_id'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        model: { type: 'string' },
        startedAt: { type: 'string', format: 'date-time' },
        toolCallCount: { type: 'integer' },
        totalCostUsd: { type: 'number' },
        toolCalls: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              serverName: { type: 'string' },
              toolName: { type: 'string' },
              costUsd: { type: 'number' },
              latencyMs: { type: 'integer', nullable: true },
              success: { type: 'boolean' },
              calledAt: { type: 'string', format: 'date-time' },
            },
            required: ['serverName', 'toolName', 'costUsd', 'success', 'calledAt'],
          },
        },
      },
      required: ['id', 'model', 'startedAt', 'toolCallCount', 'totalCostUsd', 'toolCalls'],
    },
    annotations: { title: 'Session details', readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    // Cost prediction — answer "what would this tool call cost?" BEFORE it
    // happens. Lets agents self-throttle expensive operations. Unique to
    // MCPSpend: nobody else has the historical baseline + the live API to
    // surface it inside the calling agent's own context.
    name: 'estimate_cost',
    description:
      'Estimate the USD cost of an MCP tool call BEFORE invoking it. Returns median + P90 + average cost from the org\'s last-30-day history for this exact (server, tool) combo. Use this to make spend-aware decisions in your agent — e.g. confirm with the user before invoking tools where the estimate exceeds your budget. Returns isUnknown=true with zero cost when no baseline exists yet.',
    inputSchema: {
      type: 'object',
      properties: {
        serverName: { type: 'string', description: 'MCP server name, e.g. "playwright" or "github".' },
        toolName: { type: 'string', description: 'Tool name within the server, e.g. "browser_navigate".' },
        model: { type: 'string', description: 'Optional model identifier. Falls back to the historical median across all models when omitted.' },
      },
      required: ['serverName', 'toolName'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        serverName: { type: 'string' },
        toolName: { type: 'string' },
        model: { type: ['string', 'null'] },
        isUnknown: { type: 'boolean' },
        estimatedCostUsd: { type: 'number', description: 'Median cost from sample.' },
        p90CostUsd: { type: 'number', description: '90th percentile cost — worst-case reasonable estimate.' },
        avgCostUsd: { type: 'number' },
        sampleSize: { type: 'integer' },
        successRate: { type: 'number', description: '0-1, fraction of historical calls that succeeded.' },
        avgLatencyMs: { type: ['integer', 'null'] },
        avgInputTokens: { type: 'integer' },
        avgOutputTokens: { type: 'integer' },
      },
      required: ['serverName', 'toolName', 'isUnknown', 'estimatedCostUsd', 'sampleSize'],
    },
    annotations: { title: 'Cost prediction (pre-call)', readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    // Public no-auth tool. Smithery scores "time to first success" — letting a
    // user `tools/call try_demo` BEFORE they create an API key collapses the
    // onboarding flow to a single click. The numbers are a realistic but
    // synthetic snapshot of a mid-volume team account.
    name: 'try_demo',
    description:
      'Run this WITHOUT an API key to see what MCPSpend output looks like. Returns a synthetic cost snapshot identical in shape to get_today_cost + list_top_tools + get_usage_this_month. Use this to preview the product before signing up.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    outputSchema: {
      type: 'object',
      properties: {
        demo: { type: 'boolean', const: true, description: 'Always true — this is sample data.' },
        organizationName: { type: 'string' },
        plan: { type: 'string' },
        today: {
          type: 'object',
          properties: {
            callCount: { type: 'integer' },
            costUsd: { type: 'number' },
            inputTokens: { type: 'integer' },
            outputTokens: { type: 'integer' },
          },
          required: ['callCount', 'costUsd', 'inputTokens', 'outputTokens'],
        },
        month: {
          type: 'object',
          properties: {
            callsThisMonth: { type: 'integer' },
            callsLimit: { type: 'integer' },
            spendUsd: { type: 'number' },
            budgetUsd: { type: 'number' },
            percentUsed: { type: 'number' },
          },
          required: ['callsThisMonth', 'callsLimit', 'spendUsd', 'budgetUsd', 'percentUsed'],
        },
        topTools: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              serverName: { type: 'string' },
              toolName: { type: 'string' },
              callCount: { type: 'integer' },
              costUsd: { type: 'number' },
            },
            required: ['serverName', 'toolName', 'callCount', 'costUsd'],
          },
        },
        signUp: { type: 'string', description: 'URL where the caller can create a real account.' },
      },
      required: ['demo', 'organizationName', 'plan', 'today', 'month', 'topTools', 'signUp'],
    },
    annotations: { title: 'Try demo (no auth)', readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  },
]

// Tools callable WITHOUT an API key. Used by Smithery / MCP clients to preview
// the server before onboarding. Keep this list tight — every entry is a public
// endpoint that anyone on the internet can hit.
const PUBLIC_TOOLS = new Set(['try_demo'])

// Static synthetic snapshot for try_demo. Matches the shape of the live tools
// so an LLM can interpret it the same way. Numbers picked to feel realistic
// (~5k calls / $9 budget consumed) without leaking anything from real orgs.
const DEMO_SNAPSHOT = {
  demo: true,
  organizationName: 'Acme Robotics (demo)',
  plan: 'PRO',
  today: { callCount: 312, costUsd: 0.4218, inputTokens: 84200, outputTokens: 21400 },
  month: { callsThisMonth: 5412, callsLimit: 100000, spendUsd: 9.84, budgetUsd: 25, percentUsed: 5.4 },
  topTools: [
    { serverName: 'playwright', toolName: 'browser_navigate', callCount: 1820, costUsd: 3.92 },
    { serverName: 'filesystem', toolName: 'read_file',         callCount:  984, costUsd: 1.71 },
    { serverName: 'github',     toolName: 'search_repos',       callCount:  612, costUsd: 1.40 },
    { serverName: 'fetch',      toolName: 'fetch',              callCount:  511, costUsd: 1.05 },
    { serverName: 'sqlite',     toolName: 'query',              callCount:  287, costUsd: 0.66 },
  ],
  signUp: 'https://mcpspend.com/register',
}

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return '$0.0000'
  return '$' + n.toFixed(4)
}

// Handlers return both a human-readable text block (for chat) and a
// structuredContent object matching the tool's outputSchema (for agents that
// want to parse). Per MCP 2025-06-18 spec, both can coexist in a tool result.
interface ToolResult {
  text: string
  structured: Record<string, unknown>
}

async function handleTool(name: string, args: Record<string, unknown>, organizationId: string): Promise<ToolResult> {
  switch (name) {
    case 'get_today_cost': {
      const since = new Date()
      since.setUTCHours(0, 0, 0, 0)
      const agg = await prisma.dailyStats.aggregate({
        where: { organizationId, date: { gte: since } },
        _sum: { callCount: true, costUsd: true, inputTokens: true, outputTokens: true, errorCount: true },
      })
      const s = agg._sum
      const callCount = s.callCount ?? 0
      const costUsd = s.costUsd ?? 0
      const inputTokens = s.inputTokens ?? 0
      const outputTokens = s.outputTokens ?? 0
      const errorCount = s.errorCount ?? 0
      return {
        text: [
          `Today (UTC): ${callCount} calls, total ${fmtUsd(costUsd)}.`,
          `Tokens: ${inputTokens} input / ${outputTokens} output.`,
          `Errors: ${errorCount}.`,
        ].join('\n'),
        structured: { callCount, costUsd, inputTokens, outputTokens, errorCount },
      }
    }

    case 'get_usage_this_month': {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, plan: true, callsThisMonth: true, callsLimit: true },
      })
      if (!org) {
        return { text: 'Organization not found.', structured: {} }
      }
      const pct = org.callsLimit > 0 ? (org.callsThisMonth / org.callsLimit) * 100 : 0
      const now = new Date()
      const daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate()
      const dayOfMonth = now.getUTCDate()
      const projected = dayOfMonth > 0
        ? Math.round((org.callsThisMonth / dayOfMonth) * daysInMonth)
        : org.callsThisMonth
      return {
        text: [
          `${org.name} · plan ${org.plan}`,
          `${org.callsThisMonth.toLocaleString()} / ${org.callsLimit.toLocaleString()} calls (${pct.toFixed(1)}%)`,
          `Projected end-of-month: ${projected.toLocaleString()} (limit ${org.callsLimit.toLocaleString()})`,
        ].join('\n'),
        structured: {
          organizationName: org.name,
          plan: org.plan,
          callsThisMonth: org.callsThisMonth,
          callsLimit: org.callsLimit,
          percentUsed: Number(pct.toFixed(2)),
          projectedEndOfMonth: projected,
        },
      }
    }

    case 'list_top_tools': {
      const days = Math.min(Math.max(Number(args.days) || 7, 1), 365)
      const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50)
      const since = new Date()
      since.setUTCDate(since.getUTCDate() - days)
      const tools = await prisma.dailyStats.groupBy({
        by: ['toolName', 'serverName'],
        where: { organizationId, date: { gte: since }, toolName: { not: null } },
        _sum: { callCount: true, costUsd: true },
        orderBy: { _sum: { costUsd: 'desc' } },
        take: limit,
      })
      const structuredTools = tools.map((t) => ({
        serverName: t.serverName ?? '',
        toolName: t.toolName ?? '',
        callCount: t._sum.callCount ?? 0,
        costUsd: t._sum.costUsd ?? 0,
      }))
      if (tools.length === 0) {
        return {
          text: `No tool calls in the past ${days} day(s).`,
          structured: { days, tools: [] },
        }
      }
      const lines = [`Top ${tools.length} tools by cost (last ${days}d):`]
      tools.forEach((t, i) => {
        const cost = fmtUsd(t._sum.costUsd)
        const calls = t._sum.callCount ?? 0
        lines.push(`  ${i + 1}. ${t.serverName ?? '—'}/${t.toolName} — ${cost} · ${calls} calls`)
      })
      return { text: lines.join('\n'), structured: { days, tools: structuredTools } }
    }

    case 'list_recent_sessions': {
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100)
      const sessions = await prisma.session.findMany({
        where: { organizationId },
        orderBy: { startedAt: 'desc' },
        take: limit,
        select: {
          id: true, model: true, startedAt: true, endedAt: true,
          toolCallCount: true, totalCostUsd: true,
        },
      })
      const structured = {
        sessions: sessions.map((s) => ({
          id: s.id,
          model: s.model,
          startedAt: s.startedAt.toISOString(),
          endedAt: s.endedAt ? s.endedAt.toISOString() : null,
          toolCallCount: s.toolCallCount,
          totalCostUsd: s.totalCostUsd,
          durationSeconds: s.endedAt
            ? Math.round((+new Date(s.endedAt) - +new Date(s.startedAt)) / 1000)
            : null,
        })),
      }
      if (sessions.length === 0) {
        return { text: 'No recent sessions.', structured }
      }
      const lines = [`${sessions.length} recent session(s):`]
      sessions.forEach((s) => {
        const dur = s.endedAt
          ? `${Math.round((+new Date(s.endedAt) - +new Date(s.startedAt)) / 1000)}s`
          : 'open'
        lines.push(`  ${s.id} · ${s.model} · ${s.toolCallCount} calls · ${fmtUsd(s.totalCostUsd)} · ${dur}`)
      })
      return { text: lines.join('\n'), structured }
    }

    case 'estimate_cost': {
      const serverName = String(args.serverName || '').trim()
      const toolName = String(args.toolName || '').trim()
      const model = args.model ? String(args.model).trim() : undefined
      if (!serverName || !toolName) {
        throw new Error('estimate_cost requires serverName and toolName')
      }
      const since = new Date()
      since.setUTCDate(since.getUTCDate() - 30)
      const sample = await prisma.toolCall.findMany({
        where: {
          organizationId, serverName, toolName,
          ...(model ? { model } : {}),
          calledAt: { gte: since },
        },
        orderBy: { calledAt: 'desc' },
        take: 200,
        select: { costUsd: true, latencyMs: true, inputTokens: true, outputTokens: true, success: true },
      })
      if (sample.length === 0) {
        return {
          text: `🤷 No historical data for ${serverName}/${toolName} yet. First call will populate the baseline.`,
          structured: {
            serverName, toolName, model: model ?? null,
            isUnknown: true, estimatedCostUsd: 0, sampleSize: 0,
          },
        }
      }
      const sorted = [...sample].sort((a, b) => a.costUsd - b.costUsd)
      const median = sorted[Math.floor(sorted.length / 2)].costUsd
      const p90 = sorted[Math.floor(sorted.length * 0.9)].costUsd
      const avg = sample.reduce((acc, r) => acc + r.costUsd, 0) / sample.length
      const successCount = sample.filter((r) => r.success).length
      const avgLatencyMs = sample.filter((r) => r.latencyMs != null).reduce((acc, r, _, arr) => acc + (r.latencyMs ?? 0) / arr.length, 0)
      const structured = {
        serverName, toolName, model: model ?? null,
        isUnknown: false,
        estimatedCostUsd: median,
        p90CostUsd: p90,
        avgCostUsd: avg,
        sampleSize: sample.length,
        successRate: successCount / sample.length,
        avgLatencyMs: avgLatencyMs > 0 ? Math.round(avgLatencyMs) : null,
        avgInputTokens: Math.round(sample.reduce((acc, r) => acc + r.inputTokens, 0) / sample.length),
        avgOutputTokens: Math.round(sample.reduce((acc, r) => acc + r.outputTokens, 0) / sample.length),
      }
      const text = [
        `Estimated cost for ${serverName}/${toolName}: ${fmtUsd(median)} (median over ${sample.length} calls).`,
        `  P90: ${fmtUsd(p90)} · Avg: ${fmtUsd(avg)}`,
        `  Success rate: ${Math.round((successCount / sample.length) * 100)}% · Avg latency: ${avgLatencyMs > 0 ? Math.round(avgLatencyMs) + 'ms' : '?'}`,
      ].join('\n')
      return { text, structured }
    }

    case 'get_session_details': {
      const id = String(args.session_id || '').trim()
      if (!id) throw new Error('session_id is required')
      const s = await prisma.session.findFirst({
        where: { id, organizationId },
        include: { toolCalls: { orderBy: { calledAt: 'asc' }, take: 500 } },
      })
      if (!s) {
        return { text: `Session ${id} not found.`, structured: {} }
      }
      const structured = {
        id: s.id,
        model: s.model,
        startedAt: s.startedAt.toISOString(),
        toolCallCount: s.toolCallCount,
        totalCostUsd: s.totalCostUsd,
        toolCalls: s.toolCalls.map((c) => ({
          serverName: c.serverName,
          toolName: c.toolName,
          costUsd: c.costUsd,
          latencyMs: c.latencyMs,
          success: c.success,
          calledAt: c.calledAt.toISOString(),
        })),
      }
      const lines = [
        `Session ${s.id} (${s.model})`,
        `  Started: ${s.startedAt.toISOString()}`,
        `  Tools:   ${s.toolCallCount} calls, total ${fmtUsd(s.totalCostUsd)}`,
        '',
        'Tool calls:',
      ]
      const calls = s.toolCalls.slice(0, 20)
      calls.forEach((c) => {
        const status = c.success ? '✓' : '✗'
        lines.push(`  ${status} ${c.serverName}/${c.toolName} · ${fmtUsd(c.costUsd)} · ${c.latencyMs ?? '?'}ms · ${c.calledAt.toISOString()}`)
      })
      if (s.toolCalls.length > 20) {
        lines.push(`  … and ${s.toolCalls.length - 20} more (truncated)`)
      }
      return { text: lines.join('\n'), structured }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

router.post('/', async (req, res) => {
  // Resolve auth lazily — we only need it for tools/call. Other methods are
  // part of the public handshake and must work without a key so MCP clients
  // can discover the server.
  const organizationId = await resolveApiKey(req)
  const rpc = req.body as RpcRequest

  // Bare-minimum JSON-RPC validation.
  if (!rpc || rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
    res.status(400).json({
      jsonrpc: '2.0',
      id: rpc?.id ?? null,
      error: { code: -32600, message: 'Invalid Request' },
    } satisfies RpcResponse)
    return
  }

  // Build the response envelope. We always set `id`, even on errors.
  const reply = (body: Pick<RpcResponse, 'result' | 'error'>): void => {
    res.json({ jsonrpc: '2.0', id: rpc.id ?? null, ...body } satisfies RpcResponse)
  }

  try {
    switch (rpc.method) {
      case 'initialize':
        reply({
          result: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            serverInfo: SERVER_INFO,
          },
        })
        return

      case 'tools/list':
        reply({ result: { tools: TOOLS } })
        return

      case 'tools/call': {
        const params = (rpc.params || {}) as { name?: string; arguments?: Record<string, unknown> }
        const name = params.name
        if (!name) {
          reply({ error: { code: -32602, message: 'tools/call missing name' } })
          return
        }
        // Public tools (try_demo) bypass auth so Smithery / MCP clients can
        // preview output without a key. All real-data tools require Bearer.
        if (PUBLIC_TOOLS.has(name)) {
          if (name === 'try_demo') {
            const lines = [
              `📊 ${DEMO_SNAPSHOT.organizationName} — ${DEMO_SNAPSHOT.plan} plan (demo data)`,
              `Today: ${DEMO_SNAPSHOT.today.callCount} calls · ${fmtUsd(DEMO_SNAPSHOT.today.costUsd)}`,
              `Month: ${DEMO_SNAPSHOT.month.callsThisMonth}/${DEMO_SNAPSHOT.month.callsLimit} calls · ${fmtUsd(DEMO_SNAPSHOT.month.spendUsd)} of $${DEMO_SNAPSHOT.month.budgetUsd} budget (${DEMO_SNAPSHOT.month.percentUsed}%)`,
              ``,
              `Top tools by cost:`,
              ...DEMO_SNAPSHOT.topTools.map(t => `  ${t.serverName}/${t.toolName} — ${t.callCount} calls · ${fmtUsd(t.costUsd)}`),
              ``,
              `Sign up at ${DEMO_SNAPSHOT.signUp} to see your own numbers.`,
            ]
            reply({
              result: {
                content: [{ type: 'text', text: lines.join('\n') }],
                structuredContent: DEMO_SNAPSHOT,
              },
            })
            return
          }
        }
        if (!organizationId) {
          reply({ error: { code: -32000, message: 'Authentication required (Bearer API key). Try the public try_demo tool first to preview output.' } })
          return
        }
        try {
          const out = await handleTool(name, params.arguments || {}, organizationId)
          reply({
            result: {
              content: [{ type: 'text', text: out.text }],
              structuredContent: out.structured,
            },
          })
        } catch (err) {
          reply({
            result: {
              content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
              isError: true,
            },
          })
        }
        return
      }

      // Optional but commonly probed
      case 'ping':
        reply({ result: {} })
        return

      // Smithery (and other scanners) probe these even on servers that only
      // implement tools. Returning empty lists silences the "Failed to list"
      // warning in inspect logs without us actually shipping resources or
      // prompts. If we ever add them, just plug real lists here.
      case 'resources/list':
        reply({ result: { resources: [] } })
        return
      case 'prompts/list':
        reply({ result: { prompts: [] } })
        return

      default:
        reply({ error: { code: -32601, message: `Method not found: ${rpc.method}` } })
        return
    }
  } catch (err) {
    reply({
      error: { code: -32603, message: 'Internal error', data: (err as Error).message },
    })
  }
})

// GET on /api/mcp returns a friendly hint instead of "Cannot GET" — Smithery's
// discovery and humans poking at the URL both land here.
router.get('/', (_req, res) => {
  res.json({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    transport: 'http',
    hint: 'POST JSON-RPC requests with an Authorization: Bearer <api-key> header. See https://mcpspend.com/docs/mcp-http for protocol details.',
  })
})

// Smithery (and other MCP HTTP catalogs) prefer a static server-card.json
// over runtime scanning. We advertise the same info the runtime handshake
// produces, so catalogs can list us without making a probe request.
router.get('/.well-known/mcp/server-card.json', (_req, res) => {
  res.json({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    description: 'Query your MCPSpend usage from any MCP client — cost today, top tools, recent sessions, budget projections.',
    publisher: 'NewRzs SRL',
    homepage: 'https://mcpspend.com',
    repository: 'https://github.com/andreisirbu91-lab/MCPSpend',
    license: 'MIT',
    capabilities: { tools: true, resources: false, prompts: false },
    tools: TOOLS.map(t => ({ name: t.name, description: t.description })),
    auth: {
      type: 'bearer',
      header: 'Authorization',
      description: 'Pass your MCPSpend API key (mcps_live_… or mcps_test_…) as Bearer token. Get one at https://mcpspend.com/dashboard/keys.',
    },
  })
})

// RFC 9728 — OAuth 2.0 Protected Resource Metadata.
// Smithery (and any MCP HTTP client following the 2025-06-18 spec) probes
// /.well-known/oauth-protected-resource before sending the first JSON-RPC
// request. If we just 404 with HTML, they think the URL is malformed.
// We answer with a minimal-but-valid document that says:
//   - the resource is this very endpoint
//   - no authorization_servers (we don't run an OAuth flow)
//   - bearer_methods_supported lists "header" so the client knows to send
//     `Authorization: Bearer <api-key>` directly
// This is enough for Smithery to accept the server and stop probing.
router.get('/.well-known/oauth-protected-resource', (_req, res) => {
  res.json({
    resource: 'https://api.mcpspend.com/api/mcp',
    authorization_servers: [],
    bearer_methods_supported: ['header'],
    scopes_supported: [],
    resource_documentation: 'https://mcpspend.com/docs/mcp-http',
  })
})

export { router as mcpRouter }
