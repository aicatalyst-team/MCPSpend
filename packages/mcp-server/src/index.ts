#!/usr/bin/env node
// MCPSpend MCP server — lets you query your own MCPSpend usage from inside
// any MCP-aware client (Claude Desktop, Cursor, Windsurf, VS Code).
//
// Usage in client config:
//   {
//     "mcpServers": {
//       "mcpspend": {
//         "command": "npx",
//         "args": ["-y", "@mcpspend/mcp-server"],
//         "env": { "MCPSPEND_API_KEY": "mcps_live_xxx" }
//       }
//     }
//   }
//
// Tools exposed:
//   - get_today_cost
//   - get_usage_this_month
//   - list_top_tools
//   - list_recent_sessions
//   - get_session_details

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'

const VERSION = '0.1.0'
const DEFAULT_ENDPOINT = 'https://api.mcpspend.com'

interface OverviewResp {
  daily: { date: string; _sum: { costUsd: number | null; callCount: number | null } }[]
  totals: {
    costUsd: number | null
    callCount: number | null
    inputTokens: number | null
    outputTokens: number | null
    errorCount: number | null
  }
  topTools: { toolName: string; serverName: string | null; _sum: { costUsd: number | null; callCount: number | null } }[]
  topServers: { serverName: string; _sum: { costUsd: number | null; callCount: number | null } }[]
}

interface SessionResp {
  id: string
  agentName: string | null
  model: string
  startedAt: string
  endedAt: string | null
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  toolCallCount: number
  project: { id: string; name: string } | null
}

/**
 * Read the API key from the environment. Returns null when missing so callers
 * can decide what to do — most importantly, the server itself boots and
 * advertises tools/list even without a key. Introspection tools (Glama, the
 * MCP Inspector, Smithery scanners) rely on this, and so do humans who want
 * to inspect what the server exposes before signing up. tools/call returns
 * a friendly "set MCPSPEND_API_KEY" error in that case — the process never
 * exits behind the user's back.
 */
function readApiKey(): string | null {
  return process.env.MCPSPEND_API_KEY || null
}

const MISSING_KEY_MESSAGE =
  'MCPSPEND_API_KEY env var is not set. ' +
  'Get a key at https://mcpspend.com/dashboard/keys and add it to your MCP client config.'

function endpoint(): string {
  return process.env.MCPSPEND_ENDPOINT || DEFAULT_ENDPOINT
}

async function apiGet<T>(path: string, key: string): Promise<T> {
  const r = await fetch(endpoint() + path, {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!r.ok) {
    const body = await r.text().catch(() => '')
    throw new Error(`HTTP ${r.status}: ${body.slice(0, 200)}`)
  }
  return (await r.json()) as T
}

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return '$0.0000'
  return '$' + n.toFixed(4)
}

const TOOLS: Tool[] = [
  {
    name: 'get_today_cost',
    description:
      'Get total tool-call cost and call count for the current day (UTC). Returns a human-readable summary plus structured data.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'get_usage_this_month',
    description:
      'Returns calls used this month, plan limit, percentage used, and a projection for the rest of the month based on the current daily average. Use this to spot when an org is about to hit the cap.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'list_top_tools',
    description:
      'Top tools by total cost over the past N days. Optionally limit how many entries to return. Useful for finding "what is the most expensive thing my agents do".',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'integer', description: 'Days back to consider (1-365). Default 7.', minimum: 1, maximum: 365 },
        limit: { type: 'integer', description: 'Max entries to return (1-50). Default 10.', minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list_recent_sessions',
    description:
      'Recent agent sessions (each MCP-client process start = one session) with model, total cost, tool call count, and duration.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', description: 'Max sessions to return (1-100). Default 20.', minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
]

interface ToolCall {
  serverName: string
  toolName: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  latencyMs: number | null
  success: boolean
  calledAt: string
}

interface SessionDetailsResp extends SessionResp {
  toolCalls: ToolCall[]
}

TOOLS.push({
  name: 'get_session_details',
  description:
    'Drill into a single session by ID: returns the session summary plus every tool call (up to 500) with timing, cost, and success.',
  inputSchema: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Session ID from list_recent_sessions.' },
    },
    required: ['session_id'],
    additionalProperties: false,
  },
})

TOOLS.push({
  name: 'estimate_cost',
  description:
    'Estimate the USD cost of an MCP tool call BEFORE invoking it. Returns expected cost based on the historical average for this (server, tool, model) combo in this org over the last 30 days. Use this to make spend-aware decisions — e.g. confirm with the user before calling tools that would cost more than $0.10. Returns 0 + isUnknown=true when no history exists yet.',
  inputSchema: {
    type: 'object',
    properties: {
      serverName: { type: 'string', description: 'MCP server name, e.g. "playwright" or "github".' },
      toolName: { type: 'string', description: 'Tool name within that server, e.g. "browser_navigate".' },
      model: { type: 'string', description: 'Optional model identifier for cost lookup. Falls back to the historical median for this tool when omitted.' },
    },
    required: ['serverName', 'toolName'],
    additionalProperties: false,
  },
})

async function handleTool(name: string, args: Record<string, unknown>, key: string): Promise<string> {
  switch (name) {
    case 'get_today_cost': {
      const o = await apiGet<OverviewResp>('/api/stats/overview?days=1', key)
      const today = o.daily[o.daily.length - 1]?._sum || { costUsd: 0, callCount: 0 }
      return [
        `Today (UTC): ${today.callCount ?? 0} calls, total ${fmtUsd(today.costUsd)}.`,
        `Tokens: ${o.totals.inputTokens ?? 0} input / ${o.totals.outputTokens ?? 0} output.`,
        `Errors: ${o.totals.errorCount ?? 0}.`,
      ].join('\n')
    }

    case 'get_usage_this_month': {
      const me = await apiGet<{ memberships: { organization: { callsThisMonth: number; callsLimit: number; plan: string; name: string } }[] }>(
        '/api/auth/me', key,
      )
      const org = me.memberships[0]?.organization
      if (!org) return 'No organization found for this API key.'
      const pct = org.callsLimit ? (org.callsThisMonth / org.callsLimit) * 100 : 0
      // crude projection: daily avg * days remaining in month
      const now = new Date()
      const daysInMonth = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getUTCDate()
      const dayOfMonth = now.getUTCDate()
      const projected = dayOfMonth > 0
        ? Math.round((org.callsThisMonth / dayOfMonth) * daysInMonth)
        : org.callsThisMonth
      return [
        `${org.name} · plan ${org.plan}`,
        `${org.callsThisMonth.toLocaleString()} / ${org.callsLimit.toLocaleString()} calls (${pct.toFixed(1)}%)`,
        `Projected end-of-month: ${projected.toLocaleString()} (limit ${org.callsLimit.toLocaleString()})`,
      ].join('\n')
    }

    case 'list_top_tools': {
      const days = Math.min(Math.max(Number(args.days) || 7, 1), 365)
      const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 50)
      const o = await apiGet<OverviewResp>(`/api/stats/overview?days=${days}`, key)
      const tools = (o.topTools || []).slice(0, limit)
      if (tools.length === 0) return `No tool calls in the past ${days} day(s).`
      const lines = [`Top ${tools.length} tools by cost (last ${days}d):`]
      tools.forEach((t, i) => {
        const cost = fmtUsd(t._sum.costUsd)
        const calls = t._sum.callCount ?? 0
        lines.push(`  ${i + 1}. ${t.serverName ?? '—'}/${t.toolName} — ${cost} · ${calls} calls`)
      })
      return lines.join('\n')
    }

    case 'list_recent_sessions': {
      const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100)
      const sessions = await apiGet<SessionResp[]>(`/api/stats/sessions?limit=${limit}`, key)
      if (sessions.length === 0) return 'No recent sessions.'
      const lines = [`${sessions.length} recent session(s):`]
      sessions.forEach((s) => {
        const dur = s.endedAt
          ? `${Math.round((+new Date(s.endedAt) - +new Date(s.startedAt)) / 1000)}s`
          : 'open'
        lines.push(`  ${s.id} · ${s.model} · ${s.toolCallCount} calls · ${fmtUsd(s.totalCostUsd)} · ${dur}`)
      })
      return lines.join('\n')
    }

    case 'estimate_cost': {
      const serverName = String(args.serverName || '').trim()
      const toolName = String(args.toolName || '').trim()
      const model = args.model ? String(args.model).trim() : ''
      if (!serverName || !toolName) {
        throw new Error('estimate_cost requires serverName and toolName')
      }
      const qs = new URLSearchParams({ serverName, toolName, ...(model ? { model } : {}) })
      const r = await apiGet<{
        isUnknown: boolean
        estimatedCostUsd: number
        p90CostUsd?: number
        avgCostUsd?: number
        sampleSize: number
        successRate?: number
        avgLatencyMs?: number | null
        message?: string
      }>(`/api/stats/predict?${qs.toString()}`, key)

      if (r.isUnknown) {
        return [
          `🤷 No historical data for ${serverName}/${toolName} yet.`,
          `Estimated cost: $0 (unknown).`,
          'First call will populate the baseline.',
        ].join('\n')
      }

      const successPct = Math.round((r.successRate ?? 1) * 100)
      return [
        `Estimated cost for ${serverName}/${toolName}: ${fmtUsd(r.estimatedCostUsd)} (median over ${r.sampleSize} calls).`,
        `  P90: ${fmtUsd(r.p90CostUsd ?? 0)} · Avg: ${fmtUsd(r.avgCostUsd ?? 0)}`,
        `  Success rate: ${successPct}% · Avg latency: ${r.avgLatencyMs ?? '?'}ms`,
      ].join('\n')
    }

    case 'get_session_details': {
      const id = String(args.session_id || '').trim()
      if (!id) throw new Error('session_id is required')
      const s = await apiGet<SessionDetailsResp>(`/api/stats/sessions/${encodeURIComponent(id)}`, key)
      const lines = [
        `Session ${s.id} (${s.model})`,
        `  Started: ${s.startedAt}`,
        `  Tools:   ${s.toolCallCount} calls, total ${fmtUsd(s.totalCostUsd)}`,
        '',
        'Tool calls:',
      ]
      const calls = (s.toolCalls || []).slice(0, 20)
      calls.forEach((c) => {
        const status = c.success ? '✓' : '✗'
        lines.push(`  ${status} ${c.serverName}/${c.toolName} · ${fmtUsd(c.costUsd)} · ${c.latencyMs ?? '?'}ms · ${c.calledAt}`)
      })
      if ((s.toolCalls?.length || 0) > 20) {
        lines.push(`  … and ${s.toolCalls.length - 20} more (truncated)`)
      }
      return lines.join('\n')
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

async function main() {
  const server = new Server(
    { name: 'mcpspend', version: VERSION },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: rawArgs } = req.params
    const key = readApiKey()
    if (!key) {
      return {
        content: [{ type: 'text', text: MISSING_KEY_MESSAGE }],
        isError: true,
      }
    }
    try {
      const text = await handleTool(name, (rawArgs || {}) as Record<string, unknown>, key)
      return { content: [{ type: 'text', text }] }
    } catch (err) {
      return {
        content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      }
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write(`[mcpspend-mcp-server v${VERSION}] ready — endpoint ${endpoint()}\n`)
}

main().catch((err) => {
  process.stderr.write(`[mcpspend-mcp-server] fatal: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
