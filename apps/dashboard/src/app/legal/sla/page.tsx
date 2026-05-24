import type { Metadata } from 'next'
import Link from 'next/link'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Service Level Agreement — MCPSpend',
  description: 'MCPSpend SLA for Team and Enterprise customers. Uptime commitments, response times, and service credit structure.',
  alternates: { canonical: 'https://mcpspend.com/legal/sla' },
}

const LAST_UPDATED = '2026-05-24'

interface Tier {
  plan: string
  uptime: string
  credit: string
  supportResponse: string
  incidentNotify: string
  details?: string[]
}

const TIERS: Tier[] = [
  {
    plan: 'Free',
    uptime: 'Best-effort',
    credit: 'None',
    supportResponse: 'Community (Discussions / public Discord)',
    incidentNotify: 'Status page only',
    details: ['No formal SLA. Same code, same infrastructure as paid tiers — just no contractual guarantee.'],
  },
  {
    plan: 'Pro ($29/mo)',
    uptime: '99.5% monthly',
    credit: '10% of monthly fee per 0.5% below target',
    supportResponse: '< 2 business days (email)',
    incidentNotify: 'Status page + opt-in email',
    details: [
      'Service credit caps at 100% of the monthly fee per month.',
      'Customer must claim within 30 days of the incident.',
    ],
  },
  {
    plan: 'Team ($99/mo)',
    uptime: '99.9% monthly',
    credit: '15% of monthly fee per 0.1% below target',
    supportResponse: '< 1 business day (email)',
    incidentNotify: 'Status page + automated email + Slack webhook',
    details: [
      'Audit log + per-customer attribution + webhooks included.',
      'DPA signed within 5 business days on request.',
    ],
  },
  {
    plan: 'Enterprise ($499/mo)',
    uptime: '99.95% monthly',
    credit: '25% of monthly fee per 0.1% below target',
    supportResponse: '< 4 hours business hours · < 8 hours weekends',
    incidentNotify: 'Status page + automated email + Slack + named contact',
    details: [
      'Quarterly business review on request.',
      'Custom DPA terms negotiable.',
      'Dedicated single-tenant deploy option (separate VPS + DB).',
      'Audit log streaming to your SIEM (Splunk, Datadog) on request.',
    ],
  },
]

const INCLUDED_FROM_UPTIME: string[] = [
  'Scheduled maintenance announced ≥ 48h in advance via status page',
  'Customer-side issues (revoked API keys, network on customer side, exceeded quota)',
  'Force majeure (natural disasters, regional internet outages, regulatory action)',
  'Issues caused by third parties NOT under our control (npm registry down, etc.)',
  'Brief connection drops < 60 seconds inside a calendar month',
]

export default function SLAPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-gray-400 hover:text-white">← Home</Link>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white">
          Service Level Agreement
        </h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6 text-gray-300 leading-relaxed">
          MCPSpend is operated by <strong>NEW RZS SRL</strong> (CUI RO48756557, Bragadiru, Ilfov, Romania). This SLA applies to paid customers (Pro, Team, Enterprise) and is part of our{' '}
          <Link href="/terms" className="text-brand-400 hover:underline">Terms of Service</Link>. Free-tier usage is best-effort.
        </p>

        <h2 className="mt-12 text-2xl font-semibold text-white">Uptime commitments</h2>
        <p className="mt-3 text-gray-400 text-sm">
          &quot;Uptime&quot; is calculated monthly as the percentage of time during which the production API, dashboard, and ingest endpoint were accessible. Public uptime history is published at <Link href="/status" className="text-brand-400 hover:underline">/status</Link>.
        </p>

        <div className="mt-6 space-y-4">
          {TIERS.map((t) => (
            <div key={t.plan} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h3 className="text-lg font-semibold text-white">{t.plan}</h3>
                <span className="text-xs uppercase tracking-widest px-2 py-0.5 rounded border border-brand-500/30 bg-brand-500/10 text-brand-300">
                  {t.uptime}
                </span>
              </div>
              <div className="mt-4 grid sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">Service credit</div>
                  <div className="mt-0.5 text-white">{t.credit}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">Support response</div>
                  <div className="mt-0.5 text-white">{t.supportResponse}</div>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-[10px] uppercase tracking-widest text-gray-500">Incident notification</div>
                  <div className="mt-0.5 text-white">{t.incidentNotify}</div>
                </div>
              </div>
              {t.details && (
                <ul className="mt-4 pt-4 border-t border-white/5 text-xs text-gray-400 space-y-1">
                  {t.details.map((d) => (
                    <li key={d}>• {d}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-semibold text-white">Service credits</h2>
        <p className="mt-3 text-gray-400 text-sm leading-relaxed">
          When uptime falls below the contracted target in a calendar month, eligible customers receive a credit applied to the following month&apos;s invoice. Credits do not extend the term, are not refunded as cash, and require the customer to email <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">support@mcpspend.com</a> within 30 days of the incident with the relevant time window.
        </p>

        <h2 className="mt-12 text-2xl font-semibold text-white">Excluded from uptime calculation</h2>
        <ul className="mt-3 list-disc list-inside text-sm text-gray-300 space-y-1.5">
          {INCLUDED_FROM_UPTIME.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className="mt-12 text-2xl font-semibold text-white">Severity classification</h2>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-widest">
              <th className="text-left py-2">Severity</th>
              <th className="text-left py-2">Definition</th>
              <th className="text-left py-2">Initial response (Enterprise)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5 text-gray-300">
            <tr>
              <td className="py-3 font-mono text-red-400">S1 / Critical</td>
              <td className="py-3 text-sm">Complete production outage</td>
              <td className="py-3 text-sm">&lt; 1h, 24/7</td>
            </tr>
            <tr>
              <td className="py-3 font-mono text-amber-400">S2 / Major</td>
              <td className="py-3 text-sm">Major feature unavailable, no workaround</td>
              <td className="py-3 text-sm">&lt; 4h business hours</td>
            </tr>
            <tr>
              <td className="py-3 font-mono text-amber-300">S3 / Minor</td>
              <td className="py-3 text-sm">Feature degraded or partial outage with workaround</td>
              <td className="py-3 text-sm">&lt; 1 business day</td>
            </tr>
            <tr>
              <td className="py-3 font-mono text-gray-400">S4 / Question</td>
              <td className="py-3 text-sm">How-to question, feature request</td>
              <td className="py-3 text-sm">&lt; 2 business days</td>
            </tr>
          </tbody>
        </table>

        <h2 className="mt-12 text-2xl font-semibold text-white">Contact</h2>
        <p className="mt-3 text-sm text-gray-400 leading-relaxed">
          For SLA-related questions, contract negotiation, or to file a service credit claim, email{' '}
          <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">support@mcpspend.com</a>.
          For security-only issues, see{' '}
          <Link href="/legal/data-rights" className="text-brand-400 hover:underline">data rights</Link>{' '}or email{' '}
          <a href="mailto:security@mcpspend.com" className="text-brand-400 hover:underline">security@mcpspend.com</a>.
        </p>
      </div>

      <Footer />
    </div>
  )
}
