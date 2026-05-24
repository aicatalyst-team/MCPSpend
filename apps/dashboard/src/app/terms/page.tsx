import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms under which you may use MCPSpend.',
  robots: { index: true, follow: true },
}

const LAST_UPDATED = '2026-05-23'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-gray-400 hover:text-white">← Home</Link>

        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white">Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-invert mt-10 space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white">Agreement</h2>
            <p className="mt-2">
              These Terms govern your use of MCPSpend, operated by{' '}
              <strong>NEW RZS SRL</strong>, a Romanian limited liability company
              (CUI RO48756557, Trade Register no. J2023005851235, EUID
              ROONRC.J2023005851235), incorporated 2023-09-08, with registered office
              at Str. Gliei 34-38, Corp B, Loc. Bragadiru, Jud. Ilfov, 077025, Romania
              (&quot;we&quot;, &quot;us&quot;). By signing up or using the service you
              agree to be bound by these Terms. If you don&apos;t agree, please don&apos;t
              use the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">What MCPSpend does</h2>
            <p className="mt-2">
              MCPSpend is a hosted observability and cost-attribution service for{' '}
              <a href="https://modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">Model Context Protocol</a>{' '}
              tools. The service includes:
            </p>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>The hosted dashboard at mcpspend.com</li>
              <li>The CLI proxy <code className="text-brand-300">@mcpspend/proxy</code> (MIT-licensed open source on npm)</li>
              <li>The MCP server <code className="text-brand-300">@mcpspend/mcp-server</code> (MIT-licensed)</li>
              <li>The IDE extension <code className="text-brand-300">mcpspend-vscode</code> (MIT-licensed)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Your account</h2>
            <p className="mt-2">
              You need to provide a valid email to sign up. You&apos;re responsible for
              keeping your password and API keys confidential. You may not share your
              account credentials or let anyone outside your organisation use them.
            </p>
            <p className="mt-2">
              You may be removed from the service if you (a) abuse it (spam, attempted DoS,
              attempting to reverse-engineer other customers&apos; data), (b) violate
              applicable law, or (c) fail to pay due invoices for 14 days after notice.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Pricing & payment</h2>
            <p className="mt-2">
              Current plan prices and quotas are listed at{' '}
              <Link href="/#pricing" className="text-brand-400 hover:underline">mcpspend.com/#pricing</Link>.
              Paid subscriptions are billed monthly or annually in advance by Stripe.
              VAT/sales tax is added where required by law.
            </p>
            <p className="mt-2">
              You can cancel anytime from the billing page. Cancellation takes effect at
              the end of the current paid period — we don&apos;t pro-rate cancellations.
              Once cancelled, your organisation drops to the Free tier (25,000 calls/month)
              automatically.
            </p>
            <p className="mt-2">
              If a payment fails, Stripe will retry per its standard schedule. After all
              retries fail your account drops to the Free tier; you can restore it any
              time by adding a working payment method.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Quota</h2>
            <p className="mt-2">
              Each plan has a monthly tool-call quota. Once you exceed it, the ingest
              endpoint returns HTTP 429 and stops accepting calls for the rest of the
              cycle (the wrapped MCP server still works normally — calls just stop being
              recorded). You can upgrade at any time to instantly raise the cap.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Acceptable use</h2>
            <ul className="mt-2 list-disc list-inside space-y-1">
              <li>Don&apos;t send us tool arguments / responses — the proxy is designed not to. If you&apos;re forking the proxy, please preserve this property.</li>
              <li>Don&apos;t use the service to track another organisation&apos;s usage without their knowledge.</li>
              <li>Don&apos;t attempt to enumerate other accounts, scrape the API, or bypass quota controls.</li>
              <li>Don&apos;t use the service to violate any law applicable to you.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Service availability</h2>
            <p className="mt-2">
              We aim for high availability but we don&apos;t offer a formal SLA outside
              the Enterprise plan. The CLI proxy is designed to be{' '}
              <em>fire-and-forget</em>: if our API is unreachable, your MCP server keeps
              working — we just stop receiving telemetry until we come back.
            </p>
            <p className="mt-2">
              Enterprise customers can request a custom SLA by emailing us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Intellectual property</h2>
            <p className="mt-2">
              The MCPSpend brand, dashboard, and hosted service are owned by NewRzs SRL.
              The CLI proxy and IDE extension are open source under the MIT license and
              you are free to use, modify, and self-host them per that license.
            </p>
            <p className="mt-2">
              The tool-call metadata you submit remains your data. You grant us only the
              license needed to operate the service for you.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Disclaimers & liability</h2>
            <p className="mt-2">
              The service is provided <strong>&quot;as is&quot;</strong>. To the extent
              permitted by law, we exclude implied warranties of merchantability and
              fitness for purpose.
            </p>
            <p className="mt-2">
              Our total liability to you for any claim is capped at the fees you paid us
              in the 12 months preceding the claim. We&apos;re not liable for indirect or
              consequential damages.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Governing law</h2>
            <p className="mt-2">
              These Terms are governed by the laws of Romania. Any dispute that cannot be
              resolved between us will be submitted to the competent courts of Bucharest,
              Romania.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Changes</h2>
            <p className="mt-2">
              We may update these Terms. If we make a material change we&apos;ll email all
              active account holders at least 14 days in advance. Continued use after
              the change means you accept the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white">Contact</h2>
            <p className="mt-2">
              NEW RZS SRL · Str. Gliei 34-38, Corp B, Bragadiru, Ilfov, Romania · CUI RO48756557 · J2023005851235 ·{' '}
              <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">
                support@mcpspend.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
