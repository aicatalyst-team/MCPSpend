import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Security & Compliance',
  description: 'How MCPSpend protects your data: encryption, hosting, sub-processors, audit logs, and the compliance roadmap.',
  alternates: { canonical: 'https://mcpspend.com/security' },
}

interface Control {
  title: string
  status: 'done' | 'in-progress' | 'planned'
  detail: string
}

const CONTROLS: { section: string; items: Control[] }[] = [
  {
    section: 'Data protection',
    items: [
      { title: 'Encryption in transit', status: 'done', detail: 'All HTTP/HTTPS traffic uses TLS 1.2+. Cipher suites enforced by Caddy at the edge.' },
      { title: 'Encryption at rest — secrets', status: 'done', detail: 'Sensitive config (Slack webhooks, future PATs) encrypted with AES-256-GCM, keyed by APP_ENCRYPTION_KEY on the API server.' },
      { title: 'Encryption at rest — database', status: 'done', detail: 'Postgres volume on encrypted disk at the hosting provider.' },
      { title: 'API key hashing', status: 'done', detail: 'API keys stored as SHA-256 hashes only. We cannot recover a key — only revoke and reissue.' },
      { title: 'Password hashing', status: 'done', detail: 'bcrypt with cost factor 12.' },
      { title: 'No tool arguments collected', status: 'done', detail: 'Our proxy reports only metadata (tool name, server name, latency, payload size). Tool arguments and responses never leave your machine.' },
    ],
  },
  {
    section: 'Hosting & isolation',
    items: [
      { title: 'EU-hosted infrastructure', status: 'done', detail: 'Servers in Hetzner data centers (Germany). All data — DB, Redis, logs — stays in the EU.' },
      { title: 'Per-organization data isolation', status: 'done', detail: 'Every API endpoint scopes by organizationId. No cross-tenant data leak possible at the query layer.' },
      { title: 'Stripe — no card data on our servers', status: 'done', detail: 'Stripe Checkout collects all card data; we receive only a customer ID. SOC 2 / PCI DSS Level 1 inherited from Stripe.' },
      { title: 'Dedicated single-tenant deployment', status: 'planned', detail: 'Available for Enterprise. Separate VPS + database, your own subdomain.' },
    ],
  },
  {
    section: 'Compliance',
    items: [
      { title: 'GDPR-aligned', status: 'done', detail: 'EU-hosted, anonymous compat telemetry, opt-in cookies, DPIA available on request. Privacy Policy details data subject rights.' },
      { title: 'SOC 2 Type I', status: 'in-progress', detail: 'Audit started Q4 2026 with Vanta. Type II expected Q2 2027.' },
      { title: 'ISO 27001', status: 'planned', detail: 'Roadmap H2 2027 after SOC 2 Type II.' },
      { title: 'DPA (Data Processing Agreement)', status: 'done', detail: 'Available for Enterprise customers on request — signed within 5 business days.' },
      { title: 'HIPAA / PHI', status: 'planned', detail: 'MCPSpend is not currently designed to process PHI. Email support if you need a BAA — we can scope a dedicated deployment.' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { title: 'Daily Postgres backups', status: 'done', detail: 'Encrypted snapshots to S3-compatible storage (R2). 30-day retention. Restore drill quarterly.' },
      { title: 'Public status page', status: 'done', detail: 'mcpspend.com/status — live probes against API, MCP HTTP endpoint, dashboard, npm, Open VSX, Smithery.' },
      { title: 'Audit log', status: 'done', detail: 'Append-only record of sensitive actions (billing changes, member changes, key revoke). Available in the dashboard for Team+ plans.' },
      { title: 'Sub-processors disclosed', status: 'done', detail: 'Full list with purpose and geography below.' },
      { title: 'Incident notification SLA', status: 'done', detail: 'Within 72 hours per GDPR Art. 33 for any data-breach involving personal data.' },
    ],
  },
]

const SUB_PROCESSORS = [
  { name: 'Hetzner Cloud (Germany, EU)', purpose: 'Application + database hosting', data: 'All MCPSpend data' },
  { name: 'Stripe (US/EU, GDPR + DPA in place)', purpose: 'Payment processing', data: 'Customer email, billing address, card via Stripe (we never see card data)' },
  { name: 'Resend (US, GDPR + DPA in place)', purpose: 'Transactional email delivery', data: 'Recipient email and the body of messages we send (magic links, alerts, digests)' },
  { name: 'Cloudflare R2 (EU region)', purpose: 'Encrypted backup storage', data: 'Postgres dumps, encrypted' },
  { name: 'Google Analytics 4 (US)', purpose: 'Marketing-page traffic analytics, opt-in only', data: 'Anonymised IP, page URL, referrer' },
]

const STATUS_BADGE: Record<Control['status'], { label: string; cls: string }> = {
  done:          { label: 'In place',     cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  'in-progress': { label: 'In progress',  cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  planned:       { label: 'On roadmap',   cls: 'text-gray-400 bg-white/5 border-white/10' },
}

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white font-semibold">
            <Image src="/logo.png" alt="MCPSpend" width={32} height={32} className="w-8 h-8 object-contain" />
            MCPSpend
          </Link>
          <nav className="flex items-center gap-5 text-sm text-gray-400">
            <Link href="/pricing" className="hover:text-white">Pricing</Link>
            <Link href="/security" className="text-white">Security</Link>
            <Link href="/register" className="text-white font-semibold">Start free</Link>
          </nav>
        </div>
      </header>

      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">Security & compliance</div>
        <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight text-white leading-tight">
          Honest answers about how we<br />protect your data.
        </h1>
        <p className="mt-5 text-gray-400 text-lg leading-relaxed">
          We&apos;re an indie team and we don&apos;t hide behind marketing copy. Below: every control
          we have in place today, what&apos;s actively being built (SOC 2 Type I in progress with
          Vanta), and what&apos;s on the roadmap. Every entry links back to a real implementation
          choice or a public partner page.
        </p>
        <p className="mt-3 text-gray-400 text-sm">
          For procurement and security questionnaires, email{' '}
          <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">support@mcpspend.com</a>
          {' '}— we typically reply within one business day.
        </p>
      </section>

      <section className="max-w-4xl mx-auto px-6 pb-16">
        {CONTROLS.map((group) => (
          <div key={group.section} className="mb-10">
            <h2 className="text-sm uppercase tracking-widest text-gray-500 font-semibold mb-4">{group.section}</h2>
            <div className="space-y-3">
              {group.items.map((c) => (
                <div key={c.title} className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <h3 className="text-white font-medium">{c.title}</h3>
                    <span className={`text-xs font-semibold px-2 py-1 rounded border ${STATUS_BADGE[c.status].cls}`}>
                      {STATUS_BADGE[c.status].label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-400 leading-relaxed">{c.detail}</p>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Sub-processors table */}
        <div className="mt-12">
          <h2 className="text-sm uppercase tracking-widest text-gray-500 font-semibold mb-4">Sub-processors</h2>
          <p className="text-sm text-gray-400 mb-4">
            Third parties that process data on our behalf. Listed for GDPR transparency
            (Art. 28). Enterprise customers receive notification before we add a new
            sub-processor.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border border-white/5 rounded-2xl overflow-hidden">
              <thead className="bg-white/[0.04]">
                <tr>
                  <th className="text-left text-xs text-gray-400 px-4 py-2 font-semibold">Sub-processor</th>
                  <th className="text-left text-xs text-gray-400 px-4 py-2 font-semibold">Purpose</th>
                  <th className="text-left text-xs text-gray-400 px-4 py-2 font-semibold">Data shared</th>
                </tr>
              </thead>
              <tbody>
                {SUB_PROCESSORS.map((p) => (
                  <tr key={p.name} className="border-t border-white/5">
                    <td className="text-sm text-white px-4 py-3 font-medium">{p.name}</td>
                    <td className="text-sm text-gray-400 px-4 py-3">{p.purpose}</td>
                    <td className="text-sm text-gray-400 px-4 py-3">{p.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vuln reporting */}
        <div className="mt-12 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
          <h2 className="text-white font-semibold">Responsible disclosure</h2>
          <p className="mt-2 text-sm text-gray-300">
            Found a security issue? Email{' '}
            <a href="mailto:security@mcpspend.com" className="text-amber-300 hover:underline">security@mcpspend.com</a>
            {' '}with reproduction steps. We acknowledge within 48 hours and aim to remediate
            critical findings within 7 days. We don&apos;t run a paid bug bounty yet — we&apos;ll
            credit you publicly with permission and gift Pro plan years to thank you.
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
