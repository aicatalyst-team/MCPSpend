'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'

interface AuditRow {
  id: string
  action: string
  target: string | null
  actorEmail: string | null
  userId: string | null
  ipAddress: string | null
  userAgent: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

// Friendly labels + colors per action namespace. New action names just
// fall through with their raw dotted name.
const ACTION_STYLE: Record<string, { label: string; cls: string }> = {
  'billing.upgrade':    { label: 'Plan upgraded',    cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  'billing.cancel':     { label: 'Subscription cancelled', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  'billing.resume':     { label: 'Subscription resumed',   cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  'key.create':         { label: 'API key created',  cls: 'text-brand-300 bg-brand-500/10 border-brand-500/30' },
  'key.revoke':         { label: 'API key revoked',  cls: 'text-red-300 bg-red-500/10 border-red-500/30' },
  'member.invite':      { label: 'Member invited',   cls: 'text-brand-300 bg-brand-500/10 border-brand-500/30' },
  'member.invite-revoke':{ label: 'Invitation revoked', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  'member.remove':      { label: 'Member removed',   cls: 'text-red-300 bg-red-500/10 border-red-500/30' },
  'member.role-change': { label: 'Role changed',     cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  'org.settings-update':{ label: 'Settings changed', cls: 'text-gray-300 bg-white/5 border-white/10' },
  'project.create':     { label: 'Project created',  cls: 'text-brand-300 bg-brand-500/10 border-brand-500/30' },
  'project.delete':     { label: 'Project deleted',  cls: 'text-red-300 bg-red-500/10 border-red-500/30' },
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null)

  useEffect(() => {
    api<{ items: AuditRow[]; total: number }>('/api/audit?limit=200')
      .then((d) => { setRows(d.items); setTotal(d.total) })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 402) {
          const body = err.payload as { upgradeUrl?: string } | null
          setUpgradeUrl(body?.upgradeUrl || '/dashboard/billing')
          setError('Audit log is a Team+ feature. Upgrade to view organization activity.')
        } else {
          setError(err instanceof ApiError ? err.message : 'Failed to load')
        }
      })
  }, [])

  if (error) {
    return (
      <div className="max-w-2xl">
        <h2 className="text-2xl font-bold text-white">Audit log</h2>
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6">
          <p className="text-amber-200 font-semibold">{error}</p>
          <p className="mt-2 text-sm text-gray-300">
            The audit log is an append-only record of sensitive actions taken on your
            organization — plan changes, member changes, key revocations, settings edits.
            Enterprise procurement teams typically require it.
          </p>
          {upgradeUrl && (
            <Link
              href={upgradeUrl}
              className="mt-4 inline-block bg-white text-gray-950 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-200"
            >
              See Team plan
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (!rows) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Audit log</h2>
        <p className="text-sm text-gray-400 mt-1">
          {total.toLocaleString()} recorded action{total === 1 ? '' : 's'}. Append-only — entries cannot be edited or removed.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-gray-900 p-12 text-center text-gray-500 text-sm">
          No audit entries yet. They&apos;ll appear here as your team takes sensitive actions
          (billing changes, key revocations, member changes, etc.).
        </div>
      ) : (
        <div className="rounded-2xl border border-white/5 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.02] text-xs text-gray-400">
                <th className="text-left px-4 py-2 font-semibold">When</th>
                <th className="text-left px-4 py-2 font-semibold">Action</th>
                <th className="text-left px-4 py-2 font-semibold">Actor</th>
                <th className="text-left px-4 py-2 font-semibold">Target / detail</th>
                <th className="text-left px-4 py-2 font-semibold">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => {
                const style = ACTION_STYLE[r.action] || { label: r.action, cls: 'text-gray-300 bg-white/5 border-white/10' }
                const dt = new Date(r.createdAt)
                return (
                  <tr key={r.id} className="hover:bg-white/[0.02]">
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      <div>{dt.toLocaleDateString()}</div>
                      <div className="text-gray-500">{dt.toLocaleTimeString()}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded border ${style.cls}`}>
                        {style.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-300">
                      {r.actorEmail || (r.userId ? `user:${r.userId.slice(0, 10)}` : 'system')}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 font-mono break-all">
                      {r.target || (r.metadata ? JSON.stringify(r.metadata).slice(0, 80) : '—')}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                      {r.ipAddress || '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
