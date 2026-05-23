'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

type CheckStatus = 'operational' | 'degraded' | 'down' | 'checking'

interface Check {
  id: string
  name: string
  description: string
  status: CheckStatus
  latencyMs?: number
  lastChecked?: Date
  detail?: string
}

interface Probe {
  id: string
  name: string
  description: string
  url: string
  method?: 'GET' | 'POST'
  body?: string
  // What HTTP status counts as "operational". Some endpoints (e.g. /api/mcp
  // initialize without auth) return 200 by design.
  expect?: number[]
  // Soft latency threshold for "degraded" before we mark it operational.
  degradedAboveMs?: number
}

// Probes are sent client-side so the live status reflects the user's own
// network reach, not just our internal monitoring. CORS-safe endpoints only.
const PROBES: Probe[] = [
  {
    id: 'api',
    name: 'API',
    description: 'Ingest, dashboard data, and billing endpoints.',
    url: 'https://api.mcpspend.com/health',
    expect: [200],
    degradedAboveMs: 800,
  },
  {
    id: 'mcp-http',
    name: 'MCP HTTP server',
    description: 'The api.mcpspend.com/api/mcp endpoint used by Smithery and any HTTP MCP client.',
    url: 'https://api.mcpspend.com/api/mcp',
    method: 'POST',
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    expect: [200],
    degradedAboveMs: 1500,
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'The web dashboard at mcpspend.com.',
    url: '/',
    expect: [200],
    degradedAboveMs: 1500,
  },
  {
    id: 'npm',
    name: 'npm package',
    description: '@mcpspend/proxy availability on the npm registry.',
    url: 'https://registry.npmjs.org/@mcpspend/proxy/latest',
    expect: [200],
  },
  {
    id: 'openvsx',
    name: 'Open VSX extension',
    description: 'mcpspend-vscode availability on the Open VSX marketplace.',
    url: 'https://open-vsx.org/api/McpSpend/mcpspend-vscode',
    expect: [200],
  },
  {
    id: 'smithery',
    name: 'Smithery server',
    description: '@andreisirbu91-lab/mcpspend listing on the Smithery registry.',
    url: 'https://registry.smithery.ai/servers/@andreisirbu91-lab/mcpspend',
    expect: [200],
  },
]

const STATUS_LABEL: Record<CheckStatus, string> = {
  operational: 'Operational',
  degraded: 'Degraded performance',
  down: 'Down',
  checking: 'Checking…',
}

const STATUS_COLOR: Record<CheckStatus, string> = {
  operational: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  degraded: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  down: 'text-red-400 bg-red-500/10 border-red-500/30',
  checking: 'text-gray-400 bg-white/5 border-white/10',
}

const STATUS_DOT: Record<CheckStatus, string> = {
  operational: 'bg-emerald-400',
  degraded: 'bg-amber-300',
  down: 'bg-red-400',
  checking: 'bg-gray-400 animate-pulse',
}

async function runProbe(probe: Probe): Promise<Check> {
  const start = performance.now()
  try {
    const init: RequestInit = {
      method: probe.method || 'GET',
      // Most probes are simple GETs — use no-cors fallback where the upstream
      // doesn't set CORS headers. We still get a 0-status opaque response
      // that we can interpret as "reachable, but couldn't read body".
      mode: probe.url.startsWith('http') ? 'cors' : 'same-origin',
    }
    if (probe.body) {
      init.body = probe.body
      init.headers = { 'Content-Type': 'application/json' }
    }
    const res = await fetch(probe.url, init).catch((err) => {
      throw err
    })
    const latencyMs = Math.round(performance.now() - start)
    const ok = (probe.expect || [200]).includes(res.status)
    let status: CheckStatus = ok ? 'operational' : 'degraded'
    if (!res.ok && res.status >= 500) status = 'down'
    if (probe.degradedAboveMs && latencyMs > probe.degradedAboveMs && status === 'operational') {
      status = 'degraded'
    }
    return {
      id: probe.id,
      name: probe.name,
      description: probe.description,
      status,
      latencyMs,
      lastChecked: new Date(),
      detail: ok ? `HTTP ${res.status}` : `HTTP ${res.status} — expected ${probe.expect?.join('/')}`,
    }
  } catch (err) {
    return {
      id: probe.id,
      name: probe.name,
      description: probe.description,
      status: 'down',
      latencyMs: Math.round(performance.now() - start),
      lastChecked: new Date(),
      detail: err instanceof Error ? err.message : 'network error',
    }
  }
}

function overallStatus(checks: Check[]): CheckStatus {
  if (checks.some((c) => c.status === 'down')) return 'down'
  if (checks.some((c) => c.status === 'degraded')) return 'degraded'
  if (checks.some((c) => c.status === 'checking')) return 'checking'
  return 'operational'
}

export default function StatusPage() {
  const [checks, setChecks] = useState<Check[]>(
    PROBES.map((p) => ({
      id: p.id, name: p.name, description: p.description, status: 'checking',
    })),
  )
  const [lastRun, setLastRun] = useState<Date | null>(null)

  async function refresh() {
    const results = await Promise.all(PROBES.map(runProbe))
    setChecks(results)
    setLastRun(new Date())
  }

  useEffect(() => {
    void refresh()
    const id = setInterval(() => { void refresh() }, 60_000) // re-check every 60s
    return () => clearInterval(id)
  }, [])

  const overall = overallStatus(checks)

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <Link href="/" className="flex items-center gap-2 text-white font-semibold">
            <Image src="/logo.png" alt="MCPSpend" width={32} height={32} className="w-8 h-8 object-contain" />
            MCPSpend
          </Link>
          <span className="text-gray-500">·</span>
          <span className="text-gray-300">Status</span>
        </div>

        {/* Overall status banner */}
        <div className={`rounded-2xl border px-6 py-5 mb-8 ${STATUS_COLOR[overall]}`}>
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full ${STATUS_DOT[overall]}`} />
            <div>
              <h1 className="text-2xl font-semibold text-white">
                {overall === 'operational' && 'All systems operational'}
                {overall === 'degraded' && 'Some systems are degraded'}
                {overall === 'down' && 'Major outage in progress'}
                {overall === 'checking' && 'Checking systems…'}
              </h1>
              <p className="text-sm opacity-80 mt-1">
                {lastRun ? `Last refreshed ${lastRun.toLocaleTimeString()}` : 'Running first check…'} · re-checks every 60s
              </p>
            </div>
          </div>
        </div>

        {/* Per-component checks */}
        <div className="space-y-3">
          {checks.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/5 bg-gray-900 p-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[c.status]}`} />
                    <h3 className="text-white font-semibold">{c.name}</h3>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">{c.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xs px-2 py-1 rounded font-medium ${STATUS_COLOR[c.status]}`}>
                    {STATUS_LABEL[c.status]}
                  </div>
                  {c.latencyMs !== undefined && (
                    <div className="text-xs text-gray-500 mt-1">{c.latencyMs}ms</div>
                  )}
                </div>
              </div>
              {c.detail && c.status !== 'operational' && (
                <p className="text-xs text-gray-500 mt-2 font-mono">{c.detail}</p>
              )}
            </div>
          ))}
        </div>

        {/* Manual incident notes — none for now */}
        <div className="mt-12">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Recent incidents</h2>
          <div className="rounded-xl border border-white/5 bg-gray-900 p-6 text-center text-sm text-gray-500">
            No incidents reported in the last 30 days.
          </div>
        </div>

        {/* Subscribe-style footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>
            Need help? <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">support@mcpspend.com</a>
          </p>
          <p className="mt-2 text-xs">
            This page runs the checks live in your browser, so the status reflects what you can reach.
          </p>
          <Link href="/" className="inline-block mt-4 text-xs text-gray-500 hover:text-white underline-offset-2 hover:underline">
            ← Back to mcpspend.com
          </Link>
        </div>
      </div>
    </div>
  )
}
