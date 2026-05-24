'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api, ApiError, auth } from '@/lib/api'
import { useRouter } from 'next/navigation'

interface Insight {
  id: string
  severity: 'positive' | 'neutral' | 'warning' | 'critical'
  category: 'cost' | 'tool' | 'error' | 'project' | 'forecast'
  headline: string
  body: string
  metric?: { label: string; value: string }
}

interface InsightsResp {
  insights: Insight[]
  generatedAt: string
}

const SEVERITY_STYLE: Record<Insight['severity'], { ring: string; bg: string; badge: string; emoji: string }> = {
  positive: { ring: 'border-emerald-500/30', bg: 'bg-emerald-500/5', badge: 'text-emerald-300 bg-emerald-500/15', emoji: '✓' },
  neutral:  { ring: 'border-white/10',       bg: 'bg-white/[0.02]', badge: 'text-gray-300 bg-white/5',           emoji: '·' },
  warning:  { ring: 'border-amber-500/30',   bg: 'bg-amber-500/5',  badge: 'text-amber-300 bg-amber-500/15',     emoji: '!' },
  critical: { ring: 'border-red-500/40',     bg: 'bg-red-500/5',    badge: 'text-red-300 bg-red-500/15',         emoji: '⚠' },
}

const CATEGORY_LABEL: Record<Insight['category'], string> = {
  cost: 'Cost',
  tool: 'Tool',
  error: 'Errors',
  project: 'Project',
  forecast: 'Forecast',
}

export default function InsightsPage() {
  const router = useRouter()
  const [data, setData] = useState<InsightsResp | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<InsightsResp>('/api/stats/insights')
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) { auth.clear(); router.push('/login') }
        else setError(err instanceof ApiError ? err.message : 'Failed to load insights')
      })
  }, [router])

  if (error) {
    return (
      <div className="space-y-4 max-w-3xl">
        <h2 className="text-2xl font-bold text-white">Insights</h2>
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-200">{error}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Weekly insights</h2>
        <p className="text-sm text-gray-400 mt-1">
          What changed in the last 7 days vs the 7 before. Re-generated every 10 minutes.{' '}
          <span className="text-gray-500">Last refresh: {new Date(data.generatedAt).toLocaleString()}.</span>
        </p>
      </div>

      {data.insights.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center">
          <p className="text-gray-400 text-sm">No insights yet — once your agent has run for a few days, this page lights up with cost trends, surging tools, error spikes, and a month-end forecast.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-brand-400 hover:underline">
            Back to dashboard →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data.insights.map((insight) => {
            const s = SEVERITY_STYLE[insight.severity]
            return (
              <div key={insight.id} className={`rounded-2xl border ${s.ring} ${s.bg} p-5`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-widest ${s.badge}`}>
                        <span>{s.emoji}</span>
                        <span>{CATEGORY_LABEL[insight.category]}</span>
                      </span>
                    </div>
                    <h3 className="mt-2 text-base font-semibold text-white leading-snug">
                      {insight.headline}
                    </h3>
                    <p className="mt-1 text-sm text-gray-400 leading-relaxed">
                      {insight.body}
                    </p>
                  </div>
                  {insight.metric && (
                    <div className="text-right shrink-0">
                      <div className="text-[10px] uppercase tracking-widest text-gray-500">{insight.metric.label}</div>
                      <div className="text-lg font-semibold text-white tabular-nums mt-0.5">{insight.metric.value}</div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-5 text-sm text-gray-300">
        <p className="font-semibold text-white">Want this as an email digest?</p>
        <p className="mt-1 text-xs text-gray-400">
          On Pro+ you also get the same weekly summary via email every Monday. Configure recipients in{' '}
          <Link href="/dashboard/members" className="text-brand-400 hover:underline">Members</Link>.
        </p>
      </div>
    </div>
  )
}
