import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Your data rights · MCPSpend',
  description:
    'How to access, export, correct, or delete the personal data MCPSpend holds about you. GDPR Art. 15, 16, 17, 18, 20, 21.',
  robots: { index: true, follow: true },
}

const LAST_UPDATED = '2026-05-24'

const RIGHTS: Array<{
  article: string
  name: string
  what: string
  how: string
}> = [
  {
    article: 'Art. 15',
    name: 'Right of access',
    what: 'See every piece of personal data we hold about you.',
    how: 'Sign in → Account → Privacy → "Download my data". Returns a JSON file with profile, memberships, audit log, recent tool calls.',
  },
  {
    article: 'Art. 16',
    name: 'Right to rectification',
    what: 'Correct inaccurate or incomplete data.',
    how: 'Edit your name / email in the dashboard. For org-level changes ask an OWNER.',
  },
  {
    article: 'Art. 17',
    name: 'Right to erasure ("right to be forgotten")',
    what: 'Have your account and personal data deleted.',
    how: 'Sign in → Account → Privacy → "Delete my account". Anonymises immediately, hard-purges within 30 days. Audit log entries are retained under Art. 17 §3(b) (legal record exemption).',
  },
  {
    article: 'Art. 18',
    name: 'Right to restrict processing',
    what: 'Pause processing without deleting (e.g. during a dispute).',
    how: 'Email privacy@mcpspend.com — we suspend the account and stop all background processing within 72h.',
  },
  {
    article: 'Art. 20',
    name: 'Right to data portability',
    what: 'Receive your data in a structured, machine-readable format you can take to another service.',
    how: 'Same export as Art. 15 — JSON output, documented schema. CSV exports of tool-call history are available on Pro+ via the dashboard.',
  },
  {
    article: 'Art. 21',
    name: 'Right to object',
    what: 'Object to processing based on legitimate interest (e.g. analytics).',
    how: 'Click "Decline" in the cookie banner — Google Analytics never loads. To withdraw any other consent, email privacy@mcpspend.com.',
  },
]

export default function DataRightsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-gray-400 hover:text-white">← Home</Link>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white">
          Your data rights
        </h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <p className="mt-6 text-gray-300 leading-relaxed">
          MCPSpend is run by <strong>NEW RZS SRL</strong> (Romania, EU) and is the
          data controller for everything you submit to us. The GDPR gives you the
          following rights. We honour every request within{' '}
          <strong>30 days</strong> (Art. 12 §3) — usually faster.
        </p>

        <div className="mt-10 space-y-6">
          {RIGHTS.map((r) => (
            <div
              key={r.article}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
            >
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-xs font-mono px-2 py-0.5 rounded border border-brand-500/30 bg-brand-500/10 text-brand-300">
                  GDPR {r.article}
                </span>
                <h2 className="text-lg font-semibold text-white">{r.name}</h2>
              </div>
              <p className="mt-3 text-sm text-gray-300">{r.what}</p>
              <p className="mt-2 text-sm text-gray-400">
                <strong className="text-gray-300">How:</strong> {r.how}
              </p>
            </div>
          ))}
        </div>

        <section className="mt-12 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-xl font-semibold text-white">Contact channels</h2>
          <div className="mt-4 text-sm text-gray-300 space-y-2">
            <p>
              <strong className="text-white">In-app self-serve:</strong>{' '}
              <Link
                href="/dashboard/account/privacy"
                className="text-brand-400 hover:underline"
              >
                /dashboard/account/privacy
              </Link>
            </p>
            <p>
              <strong className="text-white">Privacy email:</strong>{' '}
              <a
                href="mailto:privacy@mcpspend.com"
                className="text-brand-400 hover:underline"
              >
                privacy@mcpspend.com
              </a>{' '}
              — for requests we can&apos;t handle from the UI (Art. 18, complex
              rectifications, third-party access).
            </p>
            <p>
              <strong className="text-white">Security disclosures:</strong>{' '}
              <a
                href="mailto:security@mcpspend.com"
                className="text-brand-400 hover:underline"
              >
                security@mcpspend.com
              </a>
            </p>
            <p>
              <strong className="text-white">Supervisory authority:</strong> if you
              believe we&apos;ve mishandled your data you can lodge a complaint with
              the Romanian DPA (ANSPDCP,{' '}
              <a
                href="https://www.dataprotection.ro"
                target="_blank"
                rel="noopener"
                className="text-brand-400 hover:underline"
              >
                dataprotection.ro
              </a>
              ) or your local EU/EEA authority.
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white">Sub-processors</h2>
          <p className="mt-2 text-sm text-gray-400">
            A current list of every third party that processes personal data on our
            behalf is published on the{' '}
            <Link href="/security" className="text-brand-400 hover:underline">
              security page
            </Link>
            . We notify Enterprise customers at least 30 days before adding a new
            sub-processor.
          </p>
        </section>
      </div>
    </div>
  )
}
