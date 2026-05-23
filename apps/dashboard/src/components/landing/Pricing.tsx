import Link from 'next/link'

const tiers = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    blurb: 'For solo builders shipping their first agent.',
    cta: 'Start free',
    href: '/register',
    highlighted: false,
    features: [
      '50,000 tool calls / month',
      '1 project, 7-day retention',
      'Real-time dashboard',
      'Community support',
    ],
  },
  {
    name: 'Pro',
    price: '$29',
    cadence: 'per month',
    blurb: 'For small teams running agents in production.',
    cta: 'Start Pro trial',
    href: '/register?plan=pro',
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
    name: 'Team',
    price: '$99',
    cadence: 'per month',
    blurb: 'For multi-team orgs with attribution needs.',
    cta: 'Start Team trial',
    href: '/register?plan=team',
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
    name: 'Enterprise',
    price: '$499',
    cadence: 'per month',
    blurb: 'For regulated industries and large deployments.',
    cta: 'Start Enterprise',
    href: '/register?plan=enterprise',
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
        <div className="mt-14 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map((t) => (
            <div
              key={t.name}
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
              <Link
                href={t.href}
                className={
                  t.highlighted
                    ? 'mt-5 block text-center bg-white text-gray-950 font-semibold px-4 py-2.5 rounded-lg hover:bg-gray-200 transition-colors'
                    : 'mt-5 block text-center bg-white/5 border border-white/10 text-white font-semibold px-4 py-2.5 rounded-lg hover:bg-white/10 transition-colors'
                }
              >
                {t.cta}
              </Link>
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
      </div>
    </section>
  )
}
