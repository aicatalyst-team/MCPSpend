'use client'
import { useState } from 'react'
import Link from 'next/link'
import { api, ApiError } from '@/lib/api'

interface Tier {
  id: 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE'
  name: string
  price: string
  cadence: string
  blurb: string
  cta: string
  highlighted: boolean
  features: string[]
}

const tiers: Tier[] = [
  {
    id: 'FREE',
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    blurb: 'For solo builders shipping their first agent.',
    cta: 'Start free',
    highlighted: false,
    features: [
      '50,000 tool calls / month',
      '1 project, 7-day retention',
      'Real-time dashboard',
      'Community support',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    price: '$29',
    cadence: 'per month',
    blurb: 'For small teams running agents in production.',
    cta: 'Start Pro',
    highlighted: true,
    features: [
      '1M tool calls / month',
      'Unlimited projects',
      '30-day retention',
      'Budget alerts & Slack/email',
      'CSV + S3 export',
      'Email support',
    ],
  },
  {
    id: 'TEAM',
    name: 'Team',
    price: '$99',
    cadence: 'per month',
    blurb: 'For multi-team orgs with attribution needs.',
    cta: 'Start Team',
    highlighted: false,
    features: [
      '10M tool calls / month',
      'Per-team & per-customer attribution',
      '90-day retention',
      'SAML SSO',
      'Priority support',
      'BigQuery / Snowflake export',
    ],
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: '$499',
    cadence: 'per month',
    blurb: 'For regulated industries and large deployments.',
    cta: 'Start Enterprise',
    highlighted: false,
    features: [
      'Unlimited calls',
      'DPA (Data Processing Agreement)',
      'Dedicated infra (single-tenant) available',
      'Audit logs (unlimited retention)',
      'Custom SLA',
      'Dedicated support contact',
    ],
  },
]

export function Pricing() {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function startCheckout(plan: 'PRO' | 'TEAM' | 'ENTERPRISE') {
    setBusy(plan); setError(null)
    try {
      const res = await api<{ url: string }>('/api/billing/start', {
        method: 'POST',
        body: JSON.stringify({ plan }),
      })
      window.location.href = res.url
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start checkout — please try again or email support@mcpspend.com')
      setBusy(null)
    }
  }

  return (
    <section id="pricing" className="py-24 border-t border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">Pricing</div>
          <h2 className="mt-3 text-3xl md:text-5xl font-semibold tracking-tight text-white">
            Pay for what you ship, not for seats.
          </h2>
          <p className="mt-4 text-gray-400 text-lg leading-relaxed">
            Volume-based pricing. No per-user tax. Free tier you can actually run a project on.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((t) => (
            <div
              key={t.id}
              className={
                t.highlighted
                  ? 'rounded-2xl p-6 bg-gradient-to-b from-brand-500/10 to-transparent border border-brand-500/40 relative'
                  : 'rounded-2xl p-6 border border-white/10 bg-white/[0.02]'
              }
            >
              {t.highlighted && (
                <div className="absolute -top-3 left-6 text-[10px] tracking-widest uppercase font-semibold bg-brand-500 text-white px-2 py-0.5 rounded">
                  Most popular
                </div>
              )}
              <h3 className="text-white font-semibold text-lg">{t.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-semibold text-white">{t.price}</span>
                <span className="text-sm text-gray-500">/ {t.cadence}</span>
              </div>
              <p className="mt-2 text-gray-400 text-sm">{t.blurb}</p>

              {t.id === 'FREE' ? (
                <Link
                  href="/register"
                  className="mt-5 block text-center bg-white/5 border border-white/10 text-white font-semibold px-4 py-2.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {t.cta}
                </Link>
              ) : (
                <button
                  onClick={() => startCheckout(t.id as 'PRO' | 'TEAM' | 'ENTERPRISE')}
                  disabled={busy !== null}
                  className={
                    'mt-5 w-full font-semibold px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ' +
                    (t.highlighted
                      ? 'bg-white text-gray-950 hover:bg-gray-200'
                      : 'bg-white/5 border border-white/10 text-white hover:bg-white/10')
                  }
                >
                  {busy === t.id ? 'Opening checkout…' : t.cta}
                </button>
              )}

              <ul className="mt-6 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-gray-300">
                    <span className="text-brand-400 mt-0.5">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-gray-500 text-center">
          All paid plans: payment first → email magic link to set your password → instant dashboard access.
          Billed by NewRzs SRL (CUI RO48756557) · processed securely by Stripe.
        </p>
      </div>
    </section>
  )
}
