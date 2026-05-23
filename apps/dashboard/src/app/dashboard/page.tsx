'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { api, auth, ApiError } from '@/lib/api'

interface Overview {
  daily: { date: string; _sum: { costUsd: number | null; callCount: number | null } }[]
  totals: { costUsd: number | null; callCount: number | null; inputTokens: number | null; outputTokens: number | null; errorCount: number | null }
  topTools: { toolName: string; serverName: string | null; _sum: { costUsd: number | null; callCount: number | null } }[]
  topServers: { serverName: string; _sum: { costUsd: number | null; callCount: number | null } }[]
}

interface MeResponse {
  user: { id: string; email: string; name: string | null }
  memberships: {
    role: string
    organization: {
      id: string; name: string; slug: string; plan: string
      callsThisMonth: number; callsLimit: number
    }
  }[]
}

export default function Dashboard() {
  const router = useRouter()
  const [overview, setOverview] = useState<Overview | null>(null)
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth.getToken()) { router.push('/login'); return }

    Promise.all([
      api<MeResponse>('/api/auth/me'),
      api<Overview>('/api/stats/overview?days=30'),
    ])
      .then(([meData, ov]) => {
        setMe(meData)
        if (!auth.getOrganizationId() && meData.memberships[0]) {
          auth.setOrganization(meData.memberships[0].organization.id)
        }
        setOverview(ov)
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          auth.clear()
          router.push('/login')
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const totals = overview?.totals
  const daily = overview?.daily ?? []
  const activeOrg = me?.memberships.find(m => m.organization.id === auth.getOrganizationId())?.organization
  const usagePct = activeOrg?.callsLimit ? Math.min(100, (activeOrg.callsThisMonth / activeOrg.callsLimit) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-950 p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">MCPSpend</h1>
          {activeOrg && (
            <p className="text-xs text-gray-400 mt-0.5">
              {activeOrg.name} · <span className="uppercase font-semibold">{activeOrg.plan}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">{me?.user.email}</span>
          <button
            onClick={() => { auth.clear(); router.push('/login') }}
            className="text-gray-400 hover:text-gray-200"
          >
            Sign out
          </button>
        </div>
      </header>

      {activeOrg && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-300">Plan usage this month</span>
            <span className="text-gray-400 font-mono">
              {activeOrg.callsThisMonth.toLocaleString()} / {activeOrg.callsLimit.toLocaleString()} calls
            </span>
          </div>
          <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={
                'h-full rounded-full ' +
                (usagePct > 90 ? 'bg-red-500' : usagePct > 75 ? 'bg-amber-500' : 'bg-brand-500')
              }
              style={{ width: `${usagePct}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total cost (30d)', value: `$${(totals?.costUsd ?? 0).toFixed(4)}` },
          { label: 'Tool calls (30d)', value: (totals?.callCount ?? 0).toLocaleString() },
          { label: 'Input tokens', value: ((totals?.inputTokens ?? 0) / 1000).toFixed(1) + 'K' },
          { label: 'Error rate', value: totals?.callCount ? `${(((totals.errorCount ?? 0) / totals.callCount) * 100).toFixed(1)}%` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Daily cost — last 30 days</h2>
        {daily.length === 0
          ? <p className="text-gray-500 text-sm py-8 text-center">No data yet — install the proxy and make some tool calls.</p>
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
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
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

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-2">Install the proxy</h2>
        <p className="text-xs text-gray-500 mb-3">
          Create an API key under Settings → API Keys, then wrap your MCP server:
        </p>
        <pre className="bg-gray-950 rounded-lg p-3 text-xs text-brand-400 overflow-x-auto">
{`npm install -g @mcpspend/proxy
mcpspend wrap --key mcps_live_... -- npx @modelcontextprotocol/server-filesystem /path`}
        </pre>
      </div>
    </div>
  )
}
