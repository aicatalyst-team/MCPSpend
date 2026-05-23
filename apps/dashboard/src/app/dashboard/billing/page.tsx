'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { api, ApiError } from '@/lib/api'

interface Status {
  plan: 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE'
  callsLimit: number
  callsThisMonth: number
  cadence: 'monthly' | 'yearly' | null
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
  hasSubscription: boolean
}

interface Plan {
  id: 'PRO' | 'TEAM' | 'ENTERPRISE'
  name: string
  monthly: number
  yearly: number
  features: string[]
  highlighted?: boolean
}

const PLANS: Plan[] = [
  {
    id: 'PRO',
    name: 'Pro',
    monthly: 29,
    yearly: 290,
    features: ['1M tool calls / month', '30-day retention', 'Budget alerts', 'CSV + S3 export', 'Email support'],
    highlighted: true,
  },
  {
    id: 'TEAM',
    name: 'Team',
    monthly: 99,
    yearly: 990,
    features: ['10M tool calls / month', 'Per-team & per-customer attribution', '90-day retention', 'SAML SSO', 'BigQuery / Snowflake export', 'Priority support'],
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    monthly: 499,
    yearly: 4990,
    features: ['Unlimited calls', 'DPA', 'Dedicated infra', 'Custom SLA', 'Unlimited audit retention'],
  },
]

function BillingContent() {
  const searchParams = useSearchParams()
  const status = searchParams.get('status')
  const [data, setData] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [cadence, setCadence] = useState<'monthly' | 'yearly'>('monthly')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  async function refresh() {
    try {
      const s = await api<Status>('/api/billing/status')
      setData(s)
      if (s.cadence) setCadence(s.cadence)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load billing status')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])

  async function handleCheckout(plan: 'PRO' | 'TEAM' | 'ENTERPRISE') {
    setBusy(plan); setError(''); setInfo('')
    try {
      const res = await api<{ url?: string; updated?: boolean; noChange?: boolean }>('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan, cadence }),
      })
      if (res.updated) {
        setInfo(res.noChange ? 'Already on this plan.' : `Plan changed to ${plan} (${cadence}).`)
        await refresh()
        setBusy(null)
        return
      }
      if (res.url) {
        window.location.href = res.url
        return
      }
      setBusy(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start checkout')
      setBusy(null)
    }
  }

  async function handleCancel() {
    setBusy('cancel'); setError(''); setInfo('')
    try {
      const res = await api<{ scheduled: boolean; cancelAt?: string; alreadyCancelled?: boolean }>('/api/billing/cancel', {
        method: 'POST',
      })
      if (res.alreadyCancelled) {
        setInfo('Subscription was already cancelled — your plan is now Free.')
      } else if (res.scheduled) {
        const when = res.cancelAt ? new Date(res.cancelAt).toLocaleDateString() : 'period end'
        setInfo(`Cancellation scheduled. You keep access until ${when}.`)
      }
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to cancel')
    } finally {
      setBusy(null)
      setShowCancelConfirm(false)
    }
  }

  async function handleResume() {
    setBusy('resume'); setError(''); setInfo('')
    try {
      await api('/api/billing/resume', { method: 'POST' })
      setInfo('Cancellation reverted — your subscription will continue.')
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to resume')
    } finally {
      setBusy(null)
    }
  }

  async function handlePortal() {
    setBusy('portal'); setError('')
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

  const currentPlan = data?.plan || 'FREE'
  const isPaid = currentPlan !== 'FREE'
  const usagePercent = data ? Math.min(100, (data.callsThisMonth / data.callsLimit) * 100) : 0
  const overLimit = data ? data.callsThisMonth >= data.callsLimit : false

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
      {info && <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-300 text-sm">{info}</div>}
      {error && <p className="text-red-400 text-sm">{error}</p>}

      {data && (
        <div className="bg-gray-900 border border-white/5 rounded-xl p-5 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs text-gray-400">Current plan</p>
              <p className="text-xl font-bold text-white mt-1">
                {currentPlan}
                {data.cadence && <span className="ml-2 text-sm font-normal text-gray-400">({data.cadence})</span>}
              </p>
              {data.cancelAtPeriodEnd && data.currentPeriodEnd && (
                <p className="text-sm text-amber-300 mt-1">
                  Cancellation scheduled — access until {new Date(data.currentPeriodEnd).toLocaleDateString()}.
                </p>
              )}
              {overLimit && (
                <p className="text-sm text-red-300 mt-1">
                  Quota exceeded — tool-call tracking is paused until you upgrade or the cycle resets.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {isPaid && !data.cancelAtPeriodEnd && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  disabled={busy === 'cancel'}
                  className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                >
                  Cancel plan
                </button>
              )}
              {isPaid && data.cancelAtPeriodEnd && (
                <button
                  onClick={handleResume}
                  disabled={busy === 'resume'}
                  className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                >
                  {busy === 'resume' ? 'Resuming…' : 'Resume subscription'}
                </button>
              )}
              {isPaid && (
                <button
                  onClick={handlePortal}
                  disabled={busy === 'portal'}
                  className="bg-white/5 border border-white/10 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-white/10 disabled:opacity-50 transition-colors"
                >
                  {busy === 'portal' ? 'Opening…' : 'Manage payment & invoices'}
                </button>
              )}
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span>{data.callsThisMonth.toLocaleString()} / {data.callsLimit.toLocaleString()} calls this month</span>
              <span>{usagePercent.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className={
                  'h-full rounded-full transition-all ' +
                  (overLimit ? 'bg-red-500' : usagePercent > 80 ? 'bg-amber-500' : 'bg-brand-500')
                }
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Monthly/Yearly toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-400">Billing cycle:</span>
        <div className="inline-flex rounded-lg border border-white/10 p-1">
          <button
            type="button"
            onClick={() => setCadence('monthly')}
            className={
              'px-3 py-1 rounded-md text-sm font-semibold transition-colors ' +
              (cadence === 'monthly' ? 'bg-white text-gray-950' : 'text-gray-300 hover:bg-white/5')
            }
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setCadence('yearly')}
            className={
              'px-3 py-1 rounded-md text-sm font-semibold transition-colors flex items-center gap-1.5 ' +
              (cadence === 'yearly' ? 'bg-white text-gray-950' : 'text-gray-300 hover:bg-white/5')
            }
          >
            Yearly
            <span className="text-[9px] uppercase tracking-widest font-bold text-brand-400 bg-brand-500/10 border border-brand-500/30 rounded px-1 py-0.5">
              -17%
            </span>
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {PLANS.map((p) => {
          const isCurrent = currentPlan === p.id && (data?.cadence || 'monthly') === cadence
          const price = cadence === 'yearly' ? p.yearly : p.monthly
          const cadenceLabel = cadence === 'yearly' ? '/ year' : '/ month'
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
                <span className="text-3xl font-semibold text-white">${price}</span>
                <span className="text-sm text-gray-500">{cadenceLabel}</span>
              </div>
              {cadence === 'yearly' && (
                <div className="mt-1 text-xs text-gray-500">≈ ${Math.round(p.yearly / 12)}/mo · billed yearly</div>
              )}
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
                {isCurrent ? 'Current plan' : busy === p.id ? 'Working…' : data?.hasSubscription ? `Switch to ${p.name}` : `Upgrade to ${p.name}`}
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
        Need a custom plan or invoice for your finance team? Email{' '}
        <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">support@mcpspend.com</a>.
      </p>

      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-bold text-white">Cancel your subscription?</h3>
            <p className="mt-2 text-sm text-gray-400">
              Your plan stays active until the end of the current billing period. After that, the org drops to the Free tier (25,000 calls/month) and tracking will stop once you hit the cap.
            </p>
            <p className="mt-2 text-sm text-gray-400">
              You can resume anytime before the period ends.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                disabled={busy === 'cancel'}
                className="bg-white/5 border border-white/10 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-white/10 disabled:opacity-50"
              >
                Keep subscription
              </button>
              <button
                onClick={handleCancel}
                disabled={busy === 'cancel'}
                className="bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-50"
              >
                {busy === 'cancel' ? 'Cancelling…' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
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
