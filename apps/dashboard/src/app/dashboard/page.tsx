'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface Overview {
  daily: { date: string; _sum: { costUsd: number; callCount: number } }[]
  totals: { costUsd: number; callCount: number; inputTokens: number; outputTokens: number; errorCount: number }
  topTools: { toolName: string; serverName: string; _sum: { costUsd: number; callCount: number } }[]
  topServers: { serverName: string; _sum: { costUsd: number; callCount: number } }[]
}

export default function Dashboard() {
  const router = useRouter()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { router.push('/login'); return }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stats/overview?days=30`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setOverview)
      .catch(err => { if (err === 401) router.push('/login') })
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const totals = overview?.totals
  const daily = overview?.daily ?? []

  return (
    <div className="min-h-screen bg-gray-950 p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">MCPSpend</h1>
        <button
          onClick={() => { localStorage.removeItem('token'); router.push('/login') }}
          className="text-sm text-gray-400 hover:text-gray-200"
        >
          Sign out
        </button>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total cost (30d)', value: `$${(totals?.costUsd ?? 0).toFixed(4)}` },
          { label: 'Tool calls (30d)', value: (totals?.callCount ?? 0).toLocaleString() },
          { label: 'Input tokens', value: ((totals?.inputTokens ?? 0) / 1000).toFixed(1) + 'K' },
          { label: 'Error rate', value: totals?.callCount ? `${((totals.errorCount / totals.callCount) * 100).toFixed(1)}%` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Cost chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Daily cost — last 30 days</h2>
        {daily.length === 0
          ? <p className="text-gray-500 text-sm py-8 text-center">No data yet — install the proxy and make some tool calls.</p>
          : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={daily}>
                <XAxis dataKey="date" tickFormatter={d => d.slice(5)} tick={{ fill: '#6b7280', fontSize: 11 }} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickFormatter={v => `$${v.toFixed(3)}`} />
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

      {/* Top tools */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-3">Top tools by cost</h2>
          <div className="space-y-2">
            {(overview?.topTools ?? []).slice(0, 8).map((t, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="text-gray-300 truncate">{t.serverName}/{t.toolName}</span>
                <span className="text-brand-400 font-mono ml-2">${(t._sum.costUsd ?? 0).toFixed(5)}</span>
              </div>
            ))}
            {(overview?.topTools ?? []).length === 0 && <p className="text-gray-500 text-sm">No data yet</p>}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
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

      {/* API key box */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-2">Install the proxy</h2>
        <pre className="bg-gray-950 rounded-lg p-3 text-xs text-brand-400 overflow-x-auto">
{`npm install -g @mcpspend/proxy
mcpspend wrap --key YOUR_API_KEY -- npx @modelcontextprotocol/server-filesystem /path`}
        </pre>
      </div>
    </div>
  )
}
