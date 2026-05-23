'use client'
import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api, ApiError, auth } from '@/lib/api'
import { useRouter } from 'next/navigation'

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

  useEffect(() => {
    api<Overview>('/api/stats/overview?days=30')
      .then(setOverview)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) { auth.clear(); router.push('/login') }
      })
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const totals = overview?.totals
  const daily = overview?.daily ?? []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total cost (30d)', value: `$${(totals?.costUsd ?? 0).toFixed(4)}` },
          { label: 'Tool calls (30d)', value: (totals?.callCount ?? 0).toLocaleString() },
          { label: 'Input tokens', value: ((totals?.inputTokens ?? 0) / 1000).toFixed(1) + 'K' },
          { label: 'Error rate', value: totals?.callCount ? `${(((totals.errorCount ?? 0) / totals.callCount) * 100).toFixed(1)}%` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 border border-white/5 rounded-xl p-4">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-2xl font-bold mt-1 text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Daily cost — last 30 days</h2>
        {daily.length === 0
          ? (
            <div className="text-gray-500 text-sm py-12 text-center space-y-3">
              <p>No data yet — install the proxy and route some MCP calls.</p>
              <a href="/dashboard/keys" className="inline-block text-brand-400 hover:text-brand-300 text-xs">
                Create an API key →
              </a>
            </div>
          )
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

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Top tools by cost</h2>
          <div className="space-y-2">
            {(overview?.topTools ?? []).slice(0, 8).map((t, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-gray-300 truncate">{t.serverName ?? '—'}/{t.toolName}</span>
                <span className="text-brand-400 font-mono ml-2">${(t._sum.costUsd ?? 0).toFixed(5)}</span>
              </div>
            ))}
            {(overview?.topTools ?? []).length === 0 && <p className="text-gray-500 text-sm">No data yet</p>}
          </div>
        </div>
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Top servers by cost</h2>
          <div className="space-y-2">
            {(overview?.topServers ?? []).slice(0, 8).map((s, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-gray-300">{s.serverName}</span>
                <span className="text-brand-400 font-mono ml-2">${(s._sum.costUsd ?? 0).toFixed(5)}</span>
              </div>
            ))}
            {(overview?.topServers ?? []).length === 0 && <p className="text-gray-500 text-sm">No data yet</p>}
          </div>
        </div>
      </div>

      <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-2">Install the proxy</h2>
        <p className="text-xs text-gray-500 mb-3">
          Create an API key, then wrap your MCP server:
        </p>
        <pre className="bg-gray-950 rounded-lg p-3 text-xs text-brand-400 overflow-x-auto">
{`npm install -g @mcpspend/proxy
mcpspend wrap --key mcps_live_... -- npx @modelcontextprotocol/server-filesystem /path`}
        </pre>
      </div>
    </div>
  )
}
