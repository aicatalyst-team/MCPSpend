// Server-side probes for the public /status page. Run from the worker
// every 5 minutes alongside the rest of the maintenance scheduler. Each
// probe writes ONE row to StatusCheck so the front-end can render
// historical uptime bars (90-day) without doing N round-trips per render.

import { prisma } from './prisma'

interface ProbeDef {
  id: string
  name: string
  url: string
  method: 'GET' | 'POST'
  body?: string
  expect: number[]
  /** Latency >= this milliseconds = degraded (still up). */
  degradedAboveMs: number
  /** Bail after this many ms — counts as down. */
  timeoutMs?: number
}

// External-facing probes. Run from the worker on our own VPS so the perspective
// matches what users see. Local probes (e.g. mcpspend-postgres) skipped —
// they're already healthy if the worker is running.
const PROBES: ProbeDef[] = [
  { id: 'api',       name: 'API',           url: 'https://api.mcpspend.com/health',                                                                            method: 'GET',  expect: [200], degradedAboveMs: 800 },
  { id: 'dashboard', name: 'Dashboard',     url: 'https://mcpspend.com/',                                                                                      method: 'GET',  expect: [200], degradedAboveMs: 1500 },
  { id: 'mcp-http',  name: 'MCP HTTP',      url: 'https://api.mcpspend.com/api/mcp',                                                                           method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }), expect: [200], degradedAboveMs: 1500 },
  { id: 'mcp-card',  name: 'MCP server-card', url: 'https://api.mcpspend.com/api/mcp/.well-known/mcp/server-card.json',                                        method: 'GET',  expect: [200], degradedAboveMs: 800 },
  { id: 'stripe',    name: 'Stripe webhooks (egress)', url: 'https://api.stripe.com/v1',                                                                       method: 'GET',  expect: [401], degradedAboveMs: 1500 },
  { id: 'resend',    name: 'Resend email API (egress)', url: 'https://api.resend.com/',                                                                        method: 'GET',  expect: [200, 401, 404], degradedAboveMs: 1500 },
]

interface ProbeResult {
  id: string
  status: 'operational' | 'degraded' | 'down'
  latencyMs: number | null
  httpCode: number | null
  errorMsg: string | null
}

async function runOne(def: ProbeDef): Promise<ProbeResult> {
  const t0 = Date.now()
  const timeout = def.timeoutMs ?? 10_000
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeout)
  try {
    const resp = await fetch(def.url, {
      method: def.method,
      headers: def.body ? { 'Content-Type': 'application/json' } : undefined,
      body: def.body,
      signal: ac.signal,
    })
    const latencyMs = Date.now() - t0
    const ok = def.expect.includes(resp.status)
    if (!ok) {
      return { id: def.id, status: 'down', latencyMs, httpCode: resp.status, errorMsg: `expected ${def.expect.join('/')}` }
    }
    const status: ProbeResult['status'] = latencyMs > def.degradedAboveMs ? 'degraded' : 'operational'
    return { id: def.id, status, latencyMs, httpCode: resp.status, errorMsg: null }
  } catch (err) {
    return {
      id: def.id,
      status: 'down',
      latencyMs: Date.now() - t0,
      httpCode: null,
      errorMsg: err instanceof Error ? err.message.slice(0, 200) : 'unknown',
    }
  } finally {
    clearTimeout(timer)
  }
}

export async function runStatusProbes(): Promise<{ probe: string; status: string; latencyMs: number | null }[]> {
  const results = await Promise.all(PROBES.map(runOne))

  // Best-effort insert. If the DB is down we obviously can't write — that's
  // logged elsewhere and the next tick will catch up.
  await prisma.statusCheck.createMany({
    data: results.map((r) => ({
      probe: r.id,
      status: r.status,
      latencyMs: r.latencyMs ?? undefined,
      httpCode: r.httpCode ?? undefined,
      errorMsg: r.errorMsg ?? undefined,
    })),
  })

  return results.map((r) => ({ probe: r.id, status: r.status, latencyMs: r.latencyMs }))
}

export function probeDefinitions() {
  return PROBES.map((p) => ({ id: p.id, name: p.name }))
}
