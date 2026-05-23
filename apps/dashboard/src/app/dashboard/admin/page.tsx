'use client'
import { useEffect, useState } from 'react'
import { api, ApiError } from '@/lib/api'

interface AdminOverview {
  totals: { users: number; organizations: number }
  planBreakdown: { plan: string; orgs: number; callsThisMonth: number; callsLimitTotal: number }[]
  recentSignups: {
    id: string; email: string; name: string | null
    createdAt: string; emailVerifiedAt: string | null
    memberships: { role: string; organization: { id: string; name: string; plan: string } }[]
  }[]
  topByUsage: {
    id: string; name: string; slug: string; plan: string
    callsThisMonth: number; callsLimit: number; createdAt: string
    stripeSubscriptionId: string | null
    _count: { members: number; projects: number; apiKeys: number }
  }[]
}

interface AdminOrg {
  id: string; name: string; slug: string; plan: string
  callsThisMonth: number; callsLimit: number; createdAt: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  members: { user: { email: string; name: string | null } }[]
  _count: { members: number; projects: number; apiKeys: number }
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'text-gray-400 bg-white/5',
  PRO: 'text-brand-300 bg-brand-500/10',
  TEAM: 'text-emerald-300 bg-emerald-500/10',
  ENTERPRISE: 'text-amber-300 bg-amber-500/10',
}

export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [orgs, setOrgs] = useState<AdminOrg[] | null>(null)
  const [orgTotal, setOrgTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  async function loadOverview() {
    try {
      const data = await api<AdminOverview>('/api/admin/overview')
      setOverview(data)
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 403 ? 'Not authorized — admin access only.' : err.message)
      }
    }
  }

  async function loadOrgs(q = '') {
    try {
      const data = await api<{ items: AdminOrg[]; total: number }>(
        `/api/admin/orgs?limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}`
      )
      setOrgs(data.items)
      setOrgTotal(data.total)
    } catch (err) {
      if (err instanceof ApiError && err.status !== 403) setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadOverview()
    void loadOrgs()
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error) return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 text-red-300 text-sm">
      {error}
    </div>
  )

  if (!overview) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform admin</h1>
        <p className="text-sm text-gray-400 mt-1">
          Read-only view of every customer. Access gated by <code className="text-brand-300">SUPER_ADMIN_EMAILS</code> env var.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total users" value={overview.totals.users.toLocaleString()} />
        <KPI label="Total orgs" value={overview.totals.organizations.toLocaleString()} />
        <KPI label="Paid orgs"
             value={overview.planBreakdown.filter(p => p.plan !== 'FREE').reduce((s, p) => s + p.orgs, 0).toString()} />
        <KPI label="Calls this month"
             value={overview.planBreakdown.reduce((s, p) => s + p.callsThisMonth, 0).toLocaleString()} />
      </div>

      {/* Plan breakdown */}
      <div className="bg-gray-900 border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Plan breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {overview.planBreakdown.map(p => (
            <div key={p.plan} className="bg-gray-950 border border-white/5 rounded-lg p-3">
              <div className={`text-[10px] uppercase tracking-widest font-bold rounded px-1.5 py-0.5 inline-block ${PLAN_COLORS[p.plan] || 'text-gray-400 bg-white/5'}`}>
                {p.plan}
              </div>
              <div className="mt-2 text-2xl font-bold text-white">{p.orgs}</div>
              <div className="text-xs text-gray-500 mt-1">
                {p.callsThisMonth.toLocaleString()} / {p.callsLimitTotal.toLocaleString()} calls
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent signups */}
      <div className="bg-gray-900 border border-white/5 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-gray-300 mb-3">Recent signups</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-white/5">
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Org</th>
                <th className="py-2 pr-4">Plan</th>
                <th className="py-2 pr-4">Verified</th>
                <th className="py-2 pr-4">Signed up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {overview.recentSignups.map(u => {
                const firstOrg = u.memberships[0]?.organization
                return (
                  <tr key={u.id} className="text-gray-300">
                    <td className="py-2 pr-4">{u.email}</td>
                    <td className="py-2 pr-4">{firstOrg?.name || '—'}</td>
                    <td className="py-2 pr-4">
                      {firstOrg && (
                        <span className={`text-[10px] uppercase tracking-widest font-bold rounded px-1.5 py-0.5 ${PLAN_COLORS[firstOrg.plan] || ''}`}>
                          {firstOrg.plan}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{u.emailVerifiedAt ? '✓' : '—'}</td>
                    <td className="py-2 pr-4 text-xs text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* All orgs with search */}
      <div className="bg-gray-900 border border-white/5 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-gray-300">All organizations · {orgTotal} total</h2>
          <input
            type="search"
            placeholder="Search by name, slug, or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void loadOrgs(search) }}
            className="bg-gray-950 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-brand-500 w-64"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-white/5">
                <th className="py-2 pr-4">Org</th>
                <th className="py-2 pr-4">Owner</th>
                <th className="py-2 pr-4">Plan</th>
                <th className="py-2 pr-4">Usage</th>
                <th className="py-2 pr-4">Members</th>
                <th className="py-2 pr-4">Projects</th>
                <th className="py-2 pr-4">Keys</th>
                <th className="py-2 pr-4">Sub</th>
                <th className="py-2 pr-4">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(orgs ?? []).map(o => {
                const owner = o.members[0]?.user
                const pct = (o.callsThisMonth / Math.max(o.callsLimit, 1)) * 100
                return (
                  <tr key={o.id} className="text-gray-300">
                    <td className="py-2 pr-4">
                      <div className="font-medium text-white">{o.name}</div>
                      <div className="text-[11px] text-gray-500">{o.slug}</div>
                    </td>
                    <td className="py-2 pr-4 text-xs">{owner?.email || '—'}</td>
                    <td className="py-2 pr-4">
                      <span className={`text-[10px] uppercase tracking-widest font-bold rounded px-1.5 py-0.5 ${PLAN_COLORS[o.plan] || ''}`}>
                        {o.plan}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      <div>{o.callsThisMonth.toLocaleString()} / {o.callsLimit.toLocaleString()}</div>
                      <div className="h-1 bg-white/5 rounded-full mt-1 w-20">
                        <div
                          className={
                            'h-full rounded-full ' +
                            (pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-brand-500')
                          }
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2 pr-4">{o._count.members}</td>
                    <td className="py-2 pr-4">{o._count.projects}</td>
                    <td className="py-2 pr-4">{o._count.apiKeys}</td>
                    <td className="py-2 pr-4 text-xs">{o.stripeSubscriptionId ? '✓' : '—'}</td>
                    <td className="py-2 pr-4 text-xs text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-white/5 rounded-xl p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-2xl font-bold mt-1 text-white">{value}</p>
    </div>
  )
}
