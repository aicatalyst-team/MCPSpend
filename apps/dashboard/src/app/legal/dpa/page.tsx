import type { Metadata } from 'next'
import Link from 'next/link'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Data Processing Agreement — MCPSpend',
  description: 'Self-serve DPA template for MCPSpend Team and Enterprise customers. GDPR Art. 28 compliant, ready to counter-sign.',
  alternates: { canonical: 'https://mcpspend.com/legal/dpa' },
}

const LAST_UPDATED = '2026-05-24'

export default function DPAPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-gray-400 hover:text-white">← Home</Link>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white">
          Data Processing Agreement
        </h1>
        <p className="mt-2 text-sm text-gray-500">Template v1.0 · Last updated {LAST_UPDATED}</p>

        <p className="mt-6 text-gray-300 leading-relaxed">
          This DPA is between <strong>NEW RZS SRL</strong> (CUI RO48756557, EUID ROONRC.J2023005851235, Str. Gliei 34-38, Corp B, Loc. Bragadiru, Jud. Ilfov, 077025, Romania), trading as MCPSpend (the <em>Processor</em>), and the customer organization identified in the MCPSpend account (the <em>Controller</em>). It is incorporated by reference into our{' '}
          <Link href="/terms" className="text-brand-400 hover:underline">Terms of Service</Link>{' '}
          for customers on Team and Enterprise plans.
        </p>

        <div className="mt-8 rounded-2xl border border-brand-500/30 bg-brand-500/5 p-5">
          <p className="text-white font-semibold">Get a counter-signed PDF</p>
          <p className="mt-2 text-sm text-gray-300">
            Email <a href="mailto:support@mcpspend.com?subject=DPA%20request" className="text-brand-400 hover:underline">support@mcpspend.com</a> with your legal entity name + signatory + billing address. We counter-sign and return a PDF within 5 business days. No legal-team back-and-forth — the template below is exactly what we sign.
          </p>
        </div>

        <h2 className="mt-12 text-2xl font-semibold text-white">1. Definitions</h2>
        <p className="mt-3 text-sm text-gray-300 leading-relaxed">
          &quot;<strong>GDPR</strong>&quot; means Regulation (EU) 2016/679. &quot;<strong>Personal Data</strong>&quot;, &quot;<strong>Processing</strong>&quot;, &quot;<strong>Data Subject</strong>&quot; and &quot;<strong>Sub-processor</strong>&quot; have the meanings assigned to them in the GDPR. &quot;<strong>Services</strong>&quot; means the MCPSpend product as described at mcpspend.com.
        </p>

        <h2 className="mt-10 text-2xl font-semibold text-white">2. Subject matter, duration, nature, purpose</h2>
        <p className="mt-3 text-sm text-gray-300 leading-relaxed">
          The Processor processes Personal Data on behalf of the Controller solely to provide the Services. Duration: for as long as the Controller maintains an active MCPSpend account, plus the retention windows defined in clause 8. Nature and purpose: cost tracking, observability, billing, audit log, and other functionality the Controller chooses to use.
        </p>

        <h2 className="mt-10 text-2xl font-semibold text-white">3. Categories of Personal Data</h2>
        <ul className="mt-3 list-disc list-inside text-sm text-gray-300 space-y-1.5">
          <li><strong>Account data</strong>: email, optional name, hashed password, organization affiliation.</li>
          <li><strong>Tool-call metadata</strong>: MCP server name, tool name, model identifier, latency, success/error, payload byte counts. (NOT tool arguments or response bodies.)</li>
          <li><strong>Audit log</strong>: who changed what, when, and from which IP, for sensitive actions on the account.</li>
          <li><strong>Billing data</strong>: Stripe customer ID and subscription ID. We never see or store card data.</li>
        </ul>

        <h2 className="mt-10 text-2xl font-semibold text-white">4. Categories of Data Subjects</h2>
        <p className="mt-3 text-sm text-gray-300 leading-relaxed">
          Employees, contractors, and end-users of the Controller who use the Services, plus end-customer identifiers the Controller chooses to attribute via the <code className="text-xs bg-white/10 rounded px-1.5 py-0.5">customerLabel</code> field.
        </p>

        <h2 className="mt-10 text-2xl font-semibold text-white">5. Processor obligations</h2>
        <ul className="mt-3 list-disc list-inside text-sm text-gray-300 space-y-1.5">
          <li>Process Personal Data only on documented instructions from the Controller (the account configuration constitutes such instruction).</li>
          <li>Ensure persons authorized to process Personal Data are under confidentiality obligations.</li>
          <li>Implement the technical and organisational measures listed in <Link href="/security" className="text-brand-400 hover:underline">/security</Link> (encryption at rest, HTTPS-only, SHA-256 API key hashes, bcrypt cost 12 passwords, per-tenant isolation).</li>
          <li>Notify the Controller without undue delay (and in any case within 72 hours per GDPR Art. 33) of any Personal Data breach affecting their data.</li>
          <li>Assist the Controller with Data Subject rights requests (Art. 15-22), including the self-serve flows at <Link href="/dashboard/account/privacy" className="text-brand-400 hover:underline">/dashboard/account/privacy</Link>.</li>
        </ul>

        <h2 className="mt-10 text-2xl font-semibold text-white">6. Sub-processors</h2>
        <p className="mt-3 text-sm text-gray-300 leading-relaxed">
          The Controller grants general authorization for the Sub-processors listed at{' '}
          <Link href="/security" className="text-brand-400 hover:underline">/security</Link>. The Processor will notify the Controller at least 30 days in advance of any addition or replacement of Sub-processors. The Controller may object on reasonable grounds, in which case the parties will work in good faith to find an alternative or terminate the affected portion of the Services.
        </p>
        <p className="mt-3 text-sm text-gray-300 leading-relaxed">
          Current Sub-processors: Hostinger (EU hosting), Stripe (payment processing), Resend (transactional email), Cloudflare R2 (encrypted backups, EU region), Google Analytics 4 (marketing pages, opt-in only).
        </p>

        <h2 className="mt-10 text-2xl font-semibold text-white">7. International transfers</h2>
        <p className="mt-3 text-sm text-gray-300 leading-relaxed">
          MCPSpend application data is processed in the EU. Some Sub-processors (Stripe, Resend) may transfer Personal Data outside the EU under EU Standard Contractual Clauses (SCCs) included in their respective DPAs, which we have signed.
        </p>

        <h2 className="mt-10 text-2xl font-semibold text-white">8. Retention &amp; deletion</h2>
        <p className="mt-3 text-sm text-gray-300 leading-relaxed">
          Tool-call metadata retention follows the Controller&apos;s plan: Free 7 days, Pro 30 days, Team 90 days, Enterprise unlimited (or as agreed in writing). On account deletion, identifying fields are anonymised within 24 hours and hard-purged within 30 days. Audit-log entries are retained per GDPR Art. 17 §3(b) (legal record exemption).
        </p>

        <h2 className="mt-10 text-2xl font-semibold text-white">9. Audits</h2>
        <p className="mt-3 text-sm text-gray-300 leading-relaxed">
          The Controller has the right to audit the Processor&apos;s compliance once per calendar year with 30 days&apos; written notice. The Processor will make available all information necessary to demonstrate compliance with this DPA and the GDPR, including third-party reports (SOC 2 Type I in progress with Vanta, expected Q4 2026).
        </p>

        <h2 className="mt-10 text-2xl font-semibold text-white">10. Liability &amp; governing law</h2>
        <p className="mt-3 text-sm text-gray-300 leading-relaxed">
          The liability of each Party under this DPA is capped at 12 months of fees paid by the Controller to the Processor under the underlying agreement. Governed by Romanian law; disputes resolved in Bucharest courts.
        </p>

        <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-sm text-gray-300">
          <p className="font-semibold text-white">How to execute</p>
          <ol className="mt-3 list-decimal list-inside space-y-1.5">
            <li>Email <a href="mailto:support@mcpspend.com?subject=DPA%20request" className="text-brand-400 hover:underline">support@mcpspend.com</a> with subject &quot;DPA request&quot; — include legal entity name, signatory name + title, billing address, MCPSpend organization id.</li>
            <li>We send back a PDF of this template populated with your details, signed by us.</li>
            <li>You counter-sign and return. We file both copies.</li>
          </ol>
          <p className="mt-3 text-xs text-gray-500">Turn-around: 5 business days. No legal-team back-and-forth — the template above is exactly what we sign. If your legal needs custom clauses, Enterprise customers can negotiate.</p>
        </div>
      </div>

      <Footer />
    </div>
  )
}
