import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Pricing } from '@/components/landing/Pricing'
import { Footer } from '@/components/Footer'

// Dedicated pricing page — SEETO AI's review flagged "Pricing Transparency
// 80/100" because we only had the pricing rail on the homepage. This page
// puts every dimension of the plans next to each other (call limit,
// retention, attribution, export options, support, security) and answers
// the 6 most common pricing questions.

export const metadata: Metadata = {
  title: 'Pricing — Free, Pro, Team, Enterprise',
  description:
    'Plans from $0 to $499/month. 25,000 free tool calls every month, no credit card. Yearly billing saves 2 months. Cancel anytime.',
  alternates: { canonical: 'https://mcpspend.com/pricing' },
}

interface Row {
  feature: string
  detail?: string
  free: string | boolean
  pro: string | boolean
  team: string | boolean
  enterprise: string | boolean
}

const ROWS: { section: string; rows: Row[] }[] = [
  {
    section: 'Limits',
    rows: [
      { feature: 'Tool calls / month', free: '25,000', pro: '1,000,000', team: '10,000,000', enterprise: 'Unlimited' },
      { feature: 'Projects', free: '1', pro: 'Unlimited', team: 'Unlimited', enterprise: 'Unlimited' },
      { feature: 'Team members', free: '5', pro: '10', team: '50', enterprise: 'Unlimited' },
      { feature: 'Retention', detail: 'How long raw tool-call rows are kept', free: '7 days', pro: '30 days', team: '90 days', enterprise: 'Unlimited' },
    ],
  },
  {
    section: 'Cost tracking',
    rows: [
      { feature: 'Real-time dashboard', free: true, pro: true, team: true, enterprise: true },
      { feature: 'Per-tool, per-server breakdown', free: true, pro: true, team: true, enterprise: true },
      { feature: 'Per-project attribution', free: true, pro: true, team: true, enterprise: true },
      { feature: 'Per-team & per-customer attribution', free: false, pro: false, team: true, enterprise: true },
      { feature: 'Monthly $ budget + alerts (50/80/100%)', free: true, pro: true, team: true, enterprise: true },
      { feature: 'Anomaly detection (weekly digest)', free: false, pro: true, team: true, enterprise: true },
    ],
  },
  {
    section: 'Exports & integrations',
    rows: [
      { feature: 'CSV export', free: false, pro: true, team: true, enterprise: true },
      { feature: 'Slack budget alerts', free: false, pro: true, team: true, enterprise: true },
      { feature: 'BigQuery / Snowflake export', free: false, pro: false, team: true, enterprise: true },
      { feature: 'Webhook events', free: false, pro: false, team: true, enterprise: true },
      { feature: 'S3 / R2 raw event sink', free: false, pro: false, team: false, enterprise: true },
    ],
  },
  {
    section: 'Security & compliance',
    rows: [
      { feature: 'Encrypted secrets at rest (AES-256-GCM)', free: true, pro: true, team: true, enterprise: true },
      { feature: 'EU-hosted infrastructure', free: true, pro: true, team: true, enterprise: true },
      { feature: 'Audit log', free: false, pro: false, team: true, enterprise: true },
      { feature: 'SAML SSO', free: false, pro: false, team: true, enterprise: true },
      { feature: 'Custom roles & permissions', free: false, pro: false, team: true, enterprise: true },
      { feature: 'DPA (Data Processing Agreement)', free: false, pro: false, team: false, enterprise: true },
      { feature: 'Dedicated single-tenant infra', free: false, pro: false, team: false, enterprise: true },
    ],
  },
  {
    section: 'Support',
    rows: [
      { feature: 'Community support', free: true, pro: true, team: true, enterprise: true },
      { feature: 'Email support', free: false, pro: true, team: true, enterprise: true },
      { feature: 'Priority support (4h response)', free: false, pro: false, team: true, enterprise: true },
      { feature: 'Dedicated support contact + custom SLA', free: false, pro: false, team: false, enterprise: true },
    ],
  },
]

const FAQ = [
  {
    q: 'Can I switch plans later?',
    a: 'Yes, any time. Upgrades are prorated by Stripe (you pay the difference for the remaining days). Downgrades take effect at the end of the current period.',
  },
  {
    q: 'What happens if I exceed my tool-call quota?',
    a: 'New tool calls return HTTP 429 from our ingest endpoint — your MCP server keeps working normally, we just stop recording until the cycle resets or you upgrade. You\'ll get a budget-alert email at 80% so you can act first.',
  },
  {
    q: 'Is there a yearly discount?',
    a: 'Yes — pay annually and get 2 months free on Pro, Team, and Enterprise. Cancel any time; we don\'t prorate refunds but you keep access until the period ends.',
  },
  {
    q: 'Do you offer discounts?',
    a: 'Yes — 50% off the first year for YC + accelerator companies, students, and open-source maintainers with active public projects. Email support@mcpspend.com with proof.',
  },
  {
    q: 'How does billing work?',
    a: 'Stripe Checkout collects card, charges immediately, and creates a recurring subscription. We never store card data ourselves. Manage everything (payment method, invoices, cancellation) at /dashboard/billing.',
  },
  {
    q: 'Can I self-host MCPSpend?',
    a: 'The proxy and MCP server are MIT-licensed on GitHub. The dashboard backend is closed-source for paid plans, but the proxy works against any compatible /api/ingest endpoint. Enterprise customers can also request a fully self-hosted deployment.',
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Mini-nav. We don't import the full landing nav because /pricing is
          itself reachable from the landing — keep this lean. */}
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white font-semibold">
            <Image src="/logo.png" alt="MCPSpend" width={32} height={32} className="w-8 h-8 object-contain" />
            MCPSpend
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/#how" className="text-gray-400 hover:text-white">How it works</Link>
            <Link href="/register" className="text-white font-semibold">Start free</Link>
          </nav>
        </div>
      </header>

      <Pricing />

      {/* Feature comparison matrix */}
      <section className="py-16 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-white">Compare every feature</h2>
          <p className="mt-2 text-gray-400">Every commitment we make on Pricing is shipped — see the per-plan breakdown.</p>

          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[800px] border border-white/5 rounded-2xl overflow-hidden">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="text-left text-sm font-semibold text-gray-400 px-4 py-3">Feature</th>
                  <th className="text-center text-sm font-semibold text-white px-4 py-3">Free</th>
                  <th className="text-center text-sm font-semibold text-brand-300 px-4 py-3">Pro</th>
                  <th className="text-center text-sm font-semibold text-emerald-300 px-4 py-3">Team</th>
                  <th className="text-center text-sm font-semibold text-amber-300 px-4 py-3">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.flatMap((group, gi) => [
                  <tr key={`g-${gi}`} className="bg-white/[0.04]">
                    <td colSpan={5} className="text-xs uppercase tracking-widest text-gray-400 font-semibold px-4 py-2">
                      {group.section}
                    </td>
                  </tr>,
                  ...group.rows.map((r, ri) => (
                    <tr key={`r-${gi}-${ri}`} className="border-t border-white/5">
                      <td className="text-sm text-white px-4 py-3">
                        {r.feature}
                        {r.detail && <span className="block text-xs text-gray-500 mt-0.5">{r.detail}</span>}
                      </td>
                      {(['free', 'pro', 'team', 'enterprise'] as const).map((plan) => (
                        <td key={plan} className="text-center text-sm text-gray-300 px-4 py-3">
                          {typeof r[plan] === 'boolean'
                            ? r[plan]
                              ? <span className="text-emerald-400" aria-label="included">✓</span>
                              : <span className="text-gray-700" aria-label="not included">—</span>
                            : <span>{r[plan]}</span>}
                        </td>
                      ))}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 border-t border-white/5">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-3xl font-semibold tracking-tight text-white">Pricing FAQ</h2>
          <dl className="mt-10 space-y-3">
            {FAQ.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-white/10 bg-white/[0.02] p-5 open:bg-white/[0.04] transition-colors"
              >
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <dt className="text-white font-medium">{f.q}</dt>
                  <span className="text-gray-500 transition-transform group-open:rotate-45 text-xl leading-none">+</span>
                </summary>
                <dd className="mt-3 text-sm text-gray-400 leading-relaxed">{f.a}</dd>
              </details>
            ))}
          </dl>
        </div>
      </section>

      {/* Compact CTA */}
      <section className="py-16 border-t border-white/5 text-center">
        <h2 className="text-2xl font-semibold text-white">Ready to stop guessing what AI costs you?</h2>
        <p className="mt-3 text-gray-400">25,000 calls / month free, no credit card.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/register"
            className="bg-white text-gray-950 font-semibold px-7 py-3.5 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Start free
          </Link>
          <a
            href="mailto:support@mcpspend.com?subject=Enterprise%20inquiry"
            className="bg-white/5 border border-white/10 text-white font-semibold px-7 py-3.5 rounded-xl hover:bg-white/10 transition-colors"
          >
            Talk to us
          </a>
        </div>
      </section>

      <Footer />
    </div>
  )
}
