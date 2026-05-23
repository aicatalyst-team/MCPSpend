'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { api, ApiError } from '@/lib/api'

interface Me {
  user: { id: string; email: string }
  memberships: {
    role: string
    organization: {
      id: string; name: string; plan: string
      callsThisMonth: number; callsLimit: number
    }
  }[]
}

interface Plan {
  id: 'PRO' | 'TEAM' | 'ENTERPRISE'
  name: string
  price: string
  cadence: string
  features: string[]
  highlighted?: boolean
}

const PLANS: Plan[] = [
  {
    id: 'PRO',
    name: 'Pro',
    price: '$29',
    cadence: '/ month',
    features: ['1M tool calls / month', '30-day retention', 'Budget alerts', 'CSV + S3 export', 'Email support'],
    highlighted: true,
  },
  {
    id: 'TEAM',
    name: 'Team',
    price: '$99',
    cadence: '/ month',
    features: ['10M tool calls / month', 'Per-team & per-customer attribution', '90-day retention', 'SAML SSO', 'BigQuery / Snowflake export', 'Priority support'],
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: '$499',
    cadence: '/ month',
    features: ['Unlimited calls', 'DPA', 'Dedicated infra', 'Custom SLA', 'Unlimited audit retention'],
  },
]

function BillingContent() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<Me>('/api/auth/me')
      .then(setMe)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCheckout(plan: 'PRO' | 'TEAM' | 'ENTERPRISE') {
    setBusy(plan)
    setError('')
    try {
      const res = await api<{ url: string }>('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      })
      window.location.href = res.url
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start checkout')
      setBusy(null)
    }
  }

  async function handlePortal() {
    setBusy('portal')
    setError('')
    try {
      const res = await api<{ url: string }>('/api/billing/portal', { method: 'POST' })
      window.location.href = res.url
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to open portal')
      setBusy(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const activeOrgId = (typeof window !== 'undefined' && window.localStorage.getItem('mcps_org_id')) || ''
  const activeOrg = me?.memberships.find(m => m.organization.id === activeOrgId)?.organization
  const currentPlan = activeOrg?.plan || 'FREE'
  const isPaid = currentPlan !== 'FREE'

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Billing</h2>
        <p className="text-sm text-gray-400 mt-1">
          Manage your plan and invoices. Payments are processed by Stripe on behalf of NewRzs SRL (CUI RO48756557).
        </p>
      </div>

      {status === 'success' && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-300 text-sm">
          Subscription activated — your new quota is applied immediately.
        </div>
      )}
      {status === 'cancelled' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-amber-300 text-sm">
          Checkout cancelled. No charges were made.
        </div>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {activeOrg && (
        <div className="bg-gray-900 border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Current plan</p>
              <p className="text-xl font-bold text-white mt-1">{currentPlan}</p>
              <p className="text-sm text-gray-400 mt-1">
                {activeOrg.callsThisMonth.toLocaleString()} of {activeOrg.callsLimit.toLocaleString()} calls used this month
              </p>
            </div>
            {isPaid && (
              <button
                onClick={handlePortal}
                disabled={busy === 'portal'}
                className="bg-white/5 border border-white/10 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-white/10 disabled:opacity-50 transition-colors"
              >
                {busy === 'portal' ? 'Opening…' : 'Manage subscription'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {PLANS.map((p) => {
          const isCurrent = currentPlan === p.id
          return (
            <div
              key={p.id}
              className={
                p.highlighted
                  ? 'rounded-2xl p-5 bg-gradient-to-b from-brand-500/10 to-transparent border border-brand-500/40 relative'
                  : 'rounded-2xl p-5 border border-white/10 bg-white/[0.02]'
              }
            >
              {p.highlighted && (
                <div className="absolute -top-3 left-5 text-[10px] tracking-widest uppercase font-semibold bg-brand-500 text-white px-2 py-0.5 rounded">
                  Most popular
                </div>
              )}
              <h3 className="text-white font-semibold text-lg">{p.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-white">{p.price}</span>
                <span className="text-sm text-gray-500">{p.cadence}</span>
              </div>
              <button
                onClick={() => handleCheckout(p.id)}
                disabled={busy === p.id || isCurrent}
                className={
                  'mt-4 w-full font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ' +
                  (p.highlighted
                    ? 'bg-white text-gray-950 hover:bg-gray-200'
                    : 'bg-white/5 border border-white/10 text-white hover:bg-white/10')
                }
              >
                {isCurrent ? 'Current plan' : busy === p.id ? 'Opening…' : `Upgrade to ${p.name}`}
              </button>
              <ul className="mt-5 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-gray-300">
                    <span className="text-brand-400 mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-500">
        Need a different plan, annual billing, or an invoice for your finance team? Email{' '}
        <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">support@mcpspend.com</a>.
      </p>
    </div>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BillingContent />
    </Suspense>
  )
}
