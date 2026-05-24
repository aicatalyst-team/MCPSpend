import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How MCPSpend collects, uses, and protects your data.',
  robots: { index: true, follow: true },
}

const LAST_UPDATED = '2026-05-23'

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-gray-400 hover:text-white">← Home</Link>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-invert mt-10 space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white">Who we are</h2>
            <p className="mt-2">
              MCPSpend is operated by <strong>NEW RZS SRL</strong>, a Romanian limited
              liability company (CUI RO48756557, Trade Register no. J2023005851235,
              EUID ROONRC.J2023005851235), incorporated 2023-09-08 with registered
              office at Str. Gliei 34-38, Corp B, Loc. Bragadiru, Jud. Ilfov, 077025,
              Romania. We&apos;re the data controller for the personal data you provide to us. You can reach us at{' '}
              <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">
                support@mcpspend.com
              </a>{' '}
              for any privacy question or to exercise your GDPR rights.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">What we collect</h2>
            <p className="mt-2">We deliberately collect as little as possible. Specifically:</p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>
                <strong>Account data:</strong> email, optional display name, hashed
                password, organization name, role.
              </li>
              <li>
                <strong>Billing data:</strong> Stripe customer ID and subscription ID. Card
                details are stored by Stripe — we never see or store them.
              </li>
              <li>
                <strong>MCP tool-call metadata:</strong> tool name, server name, model
                name, input/output token estimates (size, not content), latency, success or
                error code, timestamp, the API key that sent the call. We <strong>do not</strong>{' '}
                collect tool arguments or tool responses — those never leave your machine.
              </li>
              <li>
                <strong>Anonymous CLI telemetry:</strong> when you run{' '}
                <code className="text-brand-300">mcpspend init</code>, the CLI sends a
                schema-fingerprint of the configs it patched (the sorted list of top-level
                JSON keys, hashed). No paths, no values, no API keys. Opt out with{' '}
                <code className="text-brand-300">MCPSPEND_NO_TELEMETRY=1</code>.
              </li>
              <li>
                <strong>Server logs:</strong> IP address (hashed), user-agent, route, status
                code. Used only for security and debugging.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">How we use it</h2>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Provide the service you signed up for (the dashboard).</li>
              <li>Send transactional email (magic links, budget alerts, invoices).</li>
              <li>Enforce plan limits and bill the right organisation.</li>
              <li>
                Detect when an MCP client (Cursor, Windsurf, etc.) changes its config
                schema so we can ship a fix before our auto-discovery breaks for you.
              </li>
              <li>Comply with legal obligations (tax, anti-fraud).</li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> sell your data, use it to train any model, or share
              it with advertisers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Sub-processors</h2>
            <p className="mt-2">We use the following sub-processors to run the service:</p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>
                <strong>Stripe</strong> (US/EU) — payment processing. Receives email + name
                + billing address. <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">Stripe Privacy</a>.
              </li>
              <li>
                <strong>Resend</strong> (US) — transactional email delivery. Receives email
                + the contents of the message we send you. <a href="https://resend.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">Resend Privacy</a>.
              </li>
              <li>
                <strong>Coolify on a Hetzner VPS</strong> (Germany, EU) — application
                hosting + Postgres database. No direct user-facing role.
              </li>
            </ul>
            <p className="mt-3">
              An Enterprise customer can request a current list of sub-processors and a
              signed DPA by emailing{' '}
              <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">support@mcpspend.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Retention</h2>
            <p className="mt-2">
              Tool-call rows are retained based on your plan:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Free — 7 days</li>
              <li>Pro — 30 days</li>
              <li>Team — 90 days</li>
              <li>Enterprise — kept until you ask us to delete</li>
            </ul>
            <p className="mt-3">
              Aggregated daily statistics (no PII) are kept indefinitely so historical
              charts continue to work. Account data is kept while your account is active;
              you can delete your account anytime by emailing us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Your GDPR rights</h2>
            <p className="mt-2">
              If you&apos;re in the EU/UK, you have the right to access, correct, export,
              and delete your personal data. Email{' '}
              <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">
                support@mcpspend.com
              </a>{' '}
              and we&apos;ll honour your request within 30 days. You can also complain to
              your local data protection authority (in Romania: ANSPDCP).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Cookies & analytics</h2>
            <p className="mt-2">
              MCPSpend uses a single authentication cookie to keep you signed in.
            </p>
            <p className="mt-3">
              We use <strong>Google Analytics 4</strong> (measurement ID G-R9HSHBNZ8Q)
              <strong> only after you click Accept</strong> on the cookie consent
              banner shown on your first visit. If you click Decline (or never see
              the banner because of a tracker blocker), gtag.js is never requested
              and no analytics events are sent.
            </p>
            <p className="mt-3">
              When loaded, GA4 is configured with{' '}
              <code className="text-xs text-brand-300">anonymize_ip: true</code>{' '}
              and <code className="text-xs text-brand-300">allow_ad_personalization_signals: false</code>,
              so we don&apos;t feed any audience into Google Ads. You can withdraw
              consent any time by clearing the <code className="text-xs text-brand-300">mcpspend_cookie_consent</code>{' '}
              localStorage key in your browser, after which the banner reappears
              on your next visit. Consent automatically expires after 12 months and
              we ask again.
            </p>
            <p className="mt-3">
              No other third-party tracker, advertising pixel, or session-replay tool
              runs on the application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Security</h2>
            <p className="mt-2">
              Passwords are hashed with bcrypt. API keys are stored as SHA-256 hashes — we
              cannot recover them, only revoke. Sensitive configuration values (Slack
              webhook URLs, etc.) are encrypted at rest with AES-256-GCM. All HTTP traffic
              uses TLS 1.2+.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Changes</h2>
            <p className="mt-2">
              We&apos;ll email all account holders if we make a material change to this
              policy. Minor wording edits will be reflected by the &quot;Last updated&quot;
              date above.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
