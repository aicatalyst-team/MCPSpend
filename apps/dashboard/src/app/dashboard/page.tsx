'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
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
    </div>
  )
}

// Shared layout — fed either by live data (default) or demo data (empty-state
// hero). Extracted so we don't duplicate the chart + table markup.
interface ViewProps {
  overview: {
    totals: { costUsd: number | null; callCount: number | null; inputTokens: number | null; outputTokens: number | null; errorCount: number | null }
    daily: { date: string; _sum: { costUsd: number | null; callCount: number | null } }[]
    topTools: { toolName: string; serverName: string | null; _sum: { costUsd: number | null; callCount: number | null } }[]
    topServers: { serverName: string; _sum: { costUsd: number | null; callCount: number | null } }[]
  }
  demo?: boolean
}

function DashboardView({ overview, demo }: ViewProps) {
  const totals = overview.totals
  const daily = overview.daily
  const callCount = totals.callCount ?? 0
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total cost (30d)', value: `$${(totals.costUsd ?? 0).toFixed(4)}` },
          { label: 'Tool calls (30d)', value: callCount.toLocaleString() },
          { label: 'Input tokens', value: ((totals.inputTokens ?? 0) / 1000).toFixed(1) + 'K' },
          { label: 'Error rate', value: callCount ? `${(((totals.errorCount ?? 0) / callCount) * 100).toFixed(1)}%` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className={'bg-gray-900 border border-white/5 rounded-xl p-4 ' + (demo ? 'opacity-95' : '')}>
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-2xl font-bold mt-1 text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-white/5 rounded-xl p-4 mt-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Daily cost — last 30 days</h2>
        {daily.length === 0
          ? <p className="text-gray-500 text-sm py-8 text-center">No daily totals yet — wait a few more minutes for the worker to aggregate.</p>
          : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={daily}>
                <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={(v: number) => `$${v.toFixed(3)}`} />
                <Tooltip
                  contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                  formatter={(v: number) => [`$${v.toFixed(6)}`, 'Cost']}
                />
                <Bar dataKey="_sum.costUsd" radius={[4, 4, 0, 0]}>
                  {daily.map((_, i) => <Cell key={i} fill="#0ea5e9" />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )
        }
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Top tools by cost</h2>
          <div className="space-y-2">
            {overview.topTools.slice(0, 8).map((t, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-gray-300 truncate">{t.serverName ?? '—'}/{t.toolName}</span>
                <span className="text-brand-400 font-mono ml-2">${(t._sum.costUsd ?? 0).toFixed(5)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Top servers by cost</h2>
          <div className="space-y-2">
            {overview.topServers.slice(0, 8).map((s, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-gray-300">{s.serverName}</span>
                <span className="text-brand-400 font-mono ml-2">${(s._sum.costUsd ?? 0).toFixed(5)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {demo && (
        <p className="text-center text-xs text-gray-500 mt-4">
          Numbers above are illustrative. Your dashboard will show your real MCP usage.
          {' '}
          <Link href="/dashboard/keys" className="text-brand-400 hover:underline">Get your API key →</Link>
        </p>
      )}
    </>
  )
}
