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

  const header = req.headers.authorization
  if (header && header.startsWith('Bearer ')) {
    token = header.replace('Bearer ', '').trim()
  }
  if (!token) {
    const q = req.query.apiKey
    if (typeof q === 'string') token = q.trim()
  }
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

const TOOLS = [
  {
    name: 'get_today_cost',
    description:
      'Total tool-call cost and call count for the current day (UTC), for the org behind the caller\'s API key.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_usage_this_month',
    description:
      'Calls used this month, plan limit, percentage used, and a projection for the rest of the month.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'list_top_tools',
    description:
      'Top MCP tools by cost over the past N days. Useful for "what is the most expensive thing my agents do".',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'integer', minimum: 1, maximum: 365 },
        limit: { type: 'integer', minimum: 1, maximum: 50 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'list_recent_sessions',
    description:
      'Recent agent sessions with model, total cost, tool-call count, and duration.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 100 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_session_details',
    description:
      'Drill into a single session by ID. Returns the session summary plus every tool call up to 500.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
      },
      required: ['session_id'],
      additionalProperties: false,
    },
  },
]

function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined) return '$0.0000'
  return '$' + n.toFixed(4)
}

async function handleTool(name: string, args: Record<string, unknown>, organizationId: string): Promise<string> {
  switch (name) {
    case 'get_today_cost': {
      const since = new Date()
      since.setUTCHours(0, 0, 0, 0)
      const agg = await prisma.dailyStats.aggregate({
        where: { organizationId, date: { gte: since } },
        _sum: { callCount: true, costUsd: true, inputTokens: true, outputTokens: true, errorCount: true },
      })
      const s = agg._sum
      return [
        `Today (UTC): ${s.callCount ?? 0} calls, total ${fmtUsd(s.costUsd)}.`,
        `Tokens: ${s.inputTokens ?? 0} input / ${s.outputTokens ?? 0} output.`,
        `Errors: ${s.errorCount ?? 0}.`,
      ].join('\n')
    }

    case 'get_usage_this_month': {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, plan: true, callsThisMonth: true, callsLimit: true },
      })
      if (!org) return 'Organization not found.'
      const pct = org.callsLimit > 0 ? (org.callsThisMonth / org.callsLimit) * 100 : 0
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
      const since = new Date()
      since.setUTCDate(since.getUTCDate() - days)
      const tools = await prisma.dailyStats.groupBy({
        by: ['toolName', 'serverName'],
        where: { organizationId, date: { gte: since }, toolName: { not: null } },
        _sum: { callCount: true, costUsd: true },
        orderBy: { _sum: { costUsd: 'desc' } },
        take: limit,
      })
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
      const sessions = await prisma.session.findMany({
        where: { organizationId },
        orderBy: { startedAt: 'desc' },
        take: limit,
        select: {
          id: true, model: true, startedAt: true, endedAt: true,
          toolCallCount: true, totalCostUsd: true,
        },
      })
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

    case 'get_session_details': {
      const id = String(args.session_id || '').trim()
      if (!id) throw new Error('session_id is required')
      const s = await prisma.session.findFirst({
        where: { id, organizationId },
        include: { toolCalls: { orderBy: { calledAt: 'asc' }, take: 500 } },
      })
      if (!s) return `Session ${id} not found.`
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
      return lines.join('\n')
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
        if (!organizationId) {
          reply({ error: { code: -32000, message: 'Authentication required (Bearer API key)' } })
          return
        }
        const params = (rpc.params || {}) as { name?: string; arguments?: Record<string, unknown> }
        const name = params.name
        if (!name) {
          reply({ error: { code: -32602, message: 'tools/call missing name' } })
          return
        }
        try {
          const text = await handleTool(name, params.arguments || {}, organizationId)
          reply({ result: { content: [{ type: 'text', text }] } })
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
