'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, ApiError, apiDownload, auth } from '@/lib/api'
import { useRouter } from 'next/navigation'
import { Onboarding } from '@/components/dashboard/Onboarding'
import { buildDemoOverview } from '@/lib/demoData'

interface Overview {
  daily: { date: string; _sum: { costUsd: number | null; callCount: number | null } }[]
  totals: { costUsd: number | null; callCount: number | null; inputTokens: number | null; outputTokens: number | null; errorCount: number | null }
  topTools: { toolName: string; serverName: string | null; _sum: { costUsd: number | null; callCount: number | null } }[]
  topServers: { serverName: string; _sum: { costUsd: number | null; callCount: number | null } }[]
}

export default function DashboardPage() {
  const router = useRouter()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  // Lets the user toggle between live (empty) and demo data when they have
  // no real calls yet. Default: ON until first real call lands, then off
  // forever for that browser.
  const [showDemo, setShowDemo] = useState(true)

  useEffect(() => {
    api<Overview>('/api/stats/overview?days=30')
      .then(setOverview)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) { auth.clear(); router.push('/login') }
      })
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    // Once we've seen a real call, lock the demo banner off.
    if (overview && (overview.totals.callCount ?? 0) > 0) setShowDemo(false)
  }, [overview])

  async function downloadCsv() {
    setDownloading(true); setDownloadError(null)
    try {
      const stamp = new Date().toISOString().slice(0, 10)
      await apiDownload(`/api/export/tool-calls.csv?days=30`, `mcpspend-${stamp}.csv`)
    } catch (err) {
      if (err instanceof ApiError && err.status === 402) {
        setDownloadError('CSV export requires the Pro plan or higher.')
      } else {
        setDownloadError(err instanceof ApiError ? err.message : 'Download failed')
      }
    } finally {
      setDownloading(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const liveTotals = overview?.totals
  const liveDaily = overview?.daily ?? []
  const liveCallCount = liveTotals?.callCount ?? 0
  const hasRealData = liveCallCount > 0

  // Empty state strategy: instead of showing a blank dashboard or the bare
  // onboarding stepper, we render the FULL dashboard layout pre-populated
  // with demo data and a banner that turns it into a teaser ("here's what
  // your dashboard will look like"). User picks: see the setup steps or
  // explore the demo first. Either path leads to install + first call.
  if (!hasRealData && showDemo) {
    const demo = buildDemoOverview(30)
    return (
      <div className="space-y-6">
        {/* Demo banner — the critical signal that this isn't real */}
        <div className="rounded-2xl border border-brand-500/30 bg-gradient-to-r from-brand-500/10 to-brand-500/5 p-5 flex items-start gap-4 flex-wrap">
          <span className="text-2xl">📺</span>
          <div className="flex-1 min-w-0">
            <p className="text-brand-200 font-semibold">This is demo data — your dashboard will look exactly like this once your agent makes its first MCP call.</p>
            <p className="text-brand-300/80 text-sm mt-1">
              Run <code className="text-xs bg-gray-950 px-1.5 py-0.5 rounded text-brand-200">npx @mcpspend/proxy@latest init --key …</code> in your terminal, then restart your MCP client.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowDemo(false)}
              className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Set me up →
            </button>
          </div>
        </div>

        {/* Empty-state quick-install cards — visual reassurance that the install
            handles the user's existing MCP setup automatically. Each card has a
            concrete config-file path so users without a guide know we know
            where their MCP config lives. Click any card → setup view. */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { icon: '🟠', name: 'Claude Desktop', detail: 'claude_desktop_config.json' },
            { icon: '🌀', name: 'Cursor',         detail: '~/.cursor/mcp.json' },
            { icon: '🌊', name: 'Windsurf',       detail: '~/.codeium/windsurf/' },
            { icon: '🟦', name: 'VS Code',        detail: '.vscode/mcp.json' },
            { icon: '🧠', name: 'Claude Code',    detail: '.claude/settings.json' },
          ].map((ide) => (
            <button
              key={ide.name}
              onClick={() => setShowDemo(false)}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-left hover:bg-white/[0.04] hover:border-white/20 transition-colors"
            >
              <div className="text-xl">{ide.icon}</div>
              <div className="mt-1 text-sm font-semibold text-white truncate">{ide.name}</div>
              <div className="mt-0.5 text-[10px] font-mono text-gray-500 truncate">{ide.detail}</div>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs text-gray-400 flex items-center gap-3 flex-wrap">
          <span className="text-emerald-400">✓</span>
          <span>One command auto-detects every IDE above and wraps every MCP server it finds — no config editing on your side.</span>
          <a href="/docs" className="text-brand-400 hover:underline ml-auto">See API docs →</a>
        </div>

        <DashboardView overview={demo} demo />
      </div>
    )
  }

  if (!hasRealData) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setShowDemo(true)}
          className="text-sm text-brand-400 hover:text-brand-300 inline-flex items-center gap-1.5"
        >
          ← Back to demo dashboard preview
        </button>
        <Onboarding />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Overview</h1>
          <p className="text-sm text-gray-400 mt-1">Last 30 days</p>
        </div>
        <div className="flex items-center gap-2">
          {downloadError && <span className="text-xs text-red-400">{downloadError}</span>}
          <button
            onClick={downloadCsv}
            disabled={downloading}
            className="bg-white/5 border border-white/10 text-white text-sm font-semibold px-3 py-2 rounded-lg hover:bg-white/10 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
          >
            {downloading ? 'Generating…' : '↓ Download CSV'}
          </button>
        </div>
      </div>

      <DashboardView overview={{ totals: liveTotals!, daily: liveDaily, topTools: overview?.topTools ?? [], topServers: overview?.topServers ?? [] }} />

      {/* Top end-customers tile — only renders if any rows have a customerLabel.
          Lets agencies / SaaS-on-MCP see per-tenant breakdown without leaving
          the overview page. */}
      <TopCustomersTile />
    </div>
  )
}

interface TopCustomerRow {
  customerLabel: string
  callCount: number
  costUsd: number
  inputTokens: number
  outputTokens: number
}

function TopCustomersTile() {
  const [data, setData] = useState<TopCustomerRow[] | null>(null)
  useEffect(() => {
    api<{ customers: TopCustomerRow[] }>('/api/stats/customers?days=30&limit=10')
      .then((d) => setData(d.customers))
      .catch(() => setData([]))
  }, [])

  if (!data || data.length === 0) return null

  const max = Math.max(...data.map((c) => c.costUsd), 0.0001)
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-500">Top end-customers (30d)</div>
        <Link href="/dashboard/billing" className="text-xs text-brand-400 hover:underline">
          Set up MCPSPEND_CUSTOMER_LABEL →
        </Link>
      </div>
      <div className="space-y-1.5">
        {data.map((c) => {
          const bar = (c.costUsd / max) * 100
          return (
            <div key={c.customerLabel} className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 items-center text-sm">
              <span className="font-mono text-xs text-gray-300 truncate">{c.customerLabel}</span>
              <span className="font-mono text-xs text-white tabular-nums text-right w-24">${c.costUsd.toFixed(4)}</span>
              <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-brand-500"
                  style={{ width: `${bar}%` }}
                />
              </div>
              <span className="text-xs tabular-nums text-right text-gray-500 w-16">
                {c.callCount.toLocaleString()} calls
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Shared layout — fed either by live data (default) or demo data (empty-state
// hero). Matches the landing /DashboardPreview visual language: KPI cards with
// delta arrows, gradient sparkline for daily cost, horizontal bars + alert
// dots for top tools. The point: client-facing dashboard should feel as
// polished as the marketing preview, no jarring downgrade after signup.
interface ViewProps {
  overview: {
    totals: { costUsd: number | null; callCount: number | null; inputTokens: number | null; outputTokens: number | null; errorCount: number | null }
    daily: { date: string; _sum: { costUsd: number | null; callCount: number | null } }[]
    topTools: { toolName: string; serverName: string | null; _sum: { costUsd: number | null; callCount: number | null } }[]
    topServers: { serverName: string; _sum: { costUsd: number | null; callCount: number | null } }[]
  }
  demo?: boolean
}

function fmtUsd(n: number): string {
  if (n >= 1) return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
  return '$' + n.toFixed(4)
}

// Delta vs first half of the window. Lets us show ▲/▼ arrows on KPI cards
// without a second API call. Returns the % change in cost from the first
// half of the period to the second half.
function computeDelta(daily: ViewProps['overview']['daily'], key: 'costUsd' | 'callCount'): { pct: number; dir: 'up' | 'down' } | null {
  if (daily.length < 4) return null
  const half = Math.floor(daily.length / 2)
  const first = daily.slice(0, half).reduce((acc, d) => acc + (d._sum[key] ?? 0), 0)
  const second = daily.slice(half).reduce((acc, d) => acc + (d._sum[key] ?? 0), 0)
  if (first === 0) return null
  const pct = ((second - first) / first) * 100
  return { pct: Math.round(pct), dir: pct >= 0 ? 'up' : 'down' }
}

function DashboardView({ overview, demo }: ViewProps) {
  const totals = overview.totals
  const daily = overview.daily
  const topTools = overview.topTools
  const topServers = overview.topServers
  const callCount = totals.callCount ?? 0
  const cost = totals.costUsd ?? 0
  const inputTokens = totals.inputTokens ?? 0
  const outputTokens = totals.outputTokens ?? 0
  const avgPerCall = callCount > 0 ? cost / callCount : 0
  const errorPct = callCount > 0 ? ((totals.errorCount ?? 0) / callCount) * 100 : 0

  const costDelta = computeDelta(daily, 'costUsd')
  const callDelta = computeDelta(daily, 'callCount')

  const maxToolCost = Math.max(...topTools.map(t => t._sum.costUsd ?? 0), 0.0001)
  // First 3 expensive tools get the alert treatment — primes the user to
  // look there first. Matches the "3 over budget" callout on the landing
  // preview without inventing a budget the user hasn't set.
  const alertToolNames = new Set(topTools.slice(0, 3).map(t => `${t.serverName ?? ''}/${t.toolName}`))

  const kpis = [
    { label: 'Total cost (30d)', value: fmtUsd(cost), delta: costDelta },
    { label: 'Tool calls (30d)', value: callCount.toLocaleString(), delta: callDelta },
    { label: 'Avg / call', value: callCount ? fmtUsd(avgPerCall) : '—', delta: null },
    { label: 'Error rate', value: callCount ? `${errorPct.toFixed(1)}%` : '—', delta: null },
  ]

  return (
    <div className="grid gap-6">
      {/* KPI row — same shape as landing preview, with delta arrows when we
          have enough daily history to compute them. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
            <div className="text-xs text-gray-500">{k.label}</div>
            <div className="mt-1 text-lg md:text-xl font-semibold text-white tabular-nums">{k.value}</div>
            {k.delta && (
              <div
                className={
                  'mt-0.5 text-xs tabular-nums ' +
                  (k.delta.dir === 'up' ? 'text-amber-400' : 'text-emerald-400')
                }
              >
                {k.delta.dir === 'up' ? '▲' : '▼'} {Math.abs(k.delta.pct)}%
              </div>
            )}
            {!k.delta && (
              <div className="mt-0.5 text-xs text-gray-600">vs prior half</div>
            )}
          </div>
        ))}
      </div>

      {/* Daily-cost sparkline — replaces the heavier recharts BarChart with
          the same SVG gradient line as the landing preview. Same visual,
          much lighter bundle. */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-gray-500">Daily spend · last {daily.length || 30} days</div>
          <div className="text-xs text-gray-500 hidden sm:block">USD</div>
        </div>
        {daily.length === 0
          ? <p className="text-gray-500 text-sm py-12 text-center">No daily totals yet — the worker aggregates every 5 minutes.</p>
          : <SpendChart daily={daily} />
        }
      </div>

      {/* Tokens summary row — secondary KPIs, kept compact under the chart */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="text-xs text-gray-500">Input tokens</div>
          <div className="mt-0.5 text-base font-semibold text-white tabular-nums">{(inputTokens / 1000).toFixed(1)}K</div>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="text-xs text-gray-500">Output tokens</div>
          <div className="mt-0.5 text-base font-semibold text-white tabular-nums">{(outputTokens / 1000).toFixed(1)}K</div>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
          <div className="text-xs text-gray-500">Errors</div>
          <div className="mt-0.5 text-base font-semibold text-white tabular-nums">{(totals.errorCount ?? 0).toLocaleString()}</div>
        </div>
      </div>

      {/* Top tools — gradient bars + alert dots for the top 3, matching the
          landing preview exactly. Visual ranking is the cheapest, fastest way
          for a human to spot the cost outliers. */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-gray-500">Top MCP tools by cost</div>
          {topTools.length > 0 && (
            <div className="text-xs text-amber-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              {Math.min(3, topTools.length)} to watch
            </div>
          )}
        </div>
        {topTools.length === 0 ? (
          <p className="text-gray-500 text-sm py-6 text-center">No tool calls yet.</p>
        ) : (
          <div className="space-y-1.5">
            {topTools.slice(0, 12).map((t, i) => {
              const c = t._sum.costUsd ?? 0
              const bar = (c / maxToolCost) * 100
              const fullName = `${t.serverName ?? ''}/${t.toolName}`
              const alert = alertToolNames.has(fullName) && i < 3
              return (
                <div key={fullName + i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 items-center text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    {alert && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                    <span className={'font-mono text-xs truncate ' + (alert ? 'text-white' : 'text-gray-300')}>
                      {fullName}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-white tabular-nums text-right w-24">
                    {fmtUsd(c)}
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={
                        'h-full rounded-full ' +
                        (alert
                          ? 'bg-gradient-to-r from-amber-500 to-red-500'
                          : 'bg-gradient-to-r from-brand-500 to-brand-700')
                      }
                      style={{ width: `${bar}%` }}
                    />
                  </div>
                  <div className="text-xs tabular-nums text-right text-gray-500 w-16">
                    {(t._sum.callCount ?? 0).toLocaleString()} calls
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Top servers — same bar treatment but one-column for compactness */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-gray-500">Top MCP servers by cost</div>
        </div>
        {topServers.length === 0 ? (
          <p className="text-gray-500 text-sm py-6 text-center">No server data yet.</p>
        ) : (
          <div className="space-y-1.5">
            {topServers.slice(0, 8).map((s, i) => {
              const c = s._sum.costUsd ?? 0
              const maxServer = Math.max(...topServers.map(x => x._sum.costUsd ?? 0), 0.0001)
              const bar = (c / maxServer) * 100
              return (
                <div key={s.serverName + i} className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 items-center text-sm">
                  <div className="font-mono text-xs text-gray-300 truncate">{s.serverName}</div>
                  <div className="font-mono text-xs text-white tabular-nums text-right w-24">{fmtUsd(c)}</div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700"
                      style={{ width: `${bar}%` }}
                    />
                  </div>
                  <div className="text-xs tabular-nums text-right text-gray-500 w-16">
                    {(s._sum.callCount ?? 0).toLocaleString()} calls
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {demo && (
        <p className="text-center text-xs text-gray-500">
          Numbers above are illustrative. Your dashboard will show your real MCP usage.
          {' '}
          <Link href="/dashboard/keys" className="text-brand-400 hover:underline">Get your API key →</Link>
        </p>
      )}
    </div>
  )
}

// Same gradient-fill SVG sparkline as the landing preview. Replaces recharts
// here so dashboard + landing look identical and the bundle stays small.
function SpendChart({ daily }: { daily: ViewProps['overview']['daily'] }) {
  const points = daily.map(d => d._sum.costUsd ?? 0)
  if (points.every(p => p === 0)) {
    return <p className="text-gray-500 text-sm py-12 text-center">No spend recorded in the window yet.</p>
  }
  const max = Math.max(...points)
  const min = Math.min(...points)
  const w = 100
  const h = 24
  const stepX = w / Math.max(1, points.length - 1)
  const scaleY = (v: number) => {
    if (max === min) return h / 2
    return h - ((v - min) / (max - min)) * h * 0.85 - 2
  }
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${(i * stepX).toFixed(2)} ${scaleY(p).toFixed(2)}`).join(' ')
  const area =
    `M 0 ${scaleY(points[0]).toFixed(2)} ` +
    points.map((p, i) => `L ${(i * stepX).toFixed(2)} ${scaleY(p).toFixed(2)}`).join(' ') +
    ` L ${w} ${h} L 0 ${h} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-32">
      <defs>
        <linearGradient id="dash-spend-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="dash-spend-stroke" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#dash-spend-fill)" />
      <path d={path} fill="none" stroke="url(#dash-spend-stroke)" strokeWidth="0.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => (
        <circle key={i} cx={i * stepX} cy={scaleY(p)} r="0.4" fill="#0ea5e9" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}
