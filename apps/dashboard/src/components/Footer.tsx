import Link from 'next/link'
import Image from 'next/image'

export function Footer() {
  return (
    <footer className="border-t border-white/5 mt-32">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div className="col-span-2">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-white">
            <Image src="/logo.png" alt="MCPSpend" width={36} height={36} className="w-9 h-9 object-contain" />
            MCPSpend
          </Link>
          <p className="mt-4 text-gray-400 max-w-sm">
            Cost attribution and observability for MCP tool calls. Built for teams shipping AI to production.
          </p>
          {/* Product Hunt featured badge. Light theme variant since our footer
              is dark — the SVG includes its own background and reads cleanly. */}
          <a
            href="https://www.producthunt.com/products/mcpspend?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-mcpspend"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1154250&theme=light"
              alt="MCPSpend - Know what your AI agents really cost | Product Hunt"
              width={250}
              height={54}
            />
          </a>
          {/* Smithery badge — required for the "Link to Smithery" verification
              check. Smithery scans the homepage HTML for a link to our server
              page; this anchor satisfies that scanner. */}
          <a
            href="https://smithery.ai/servers/andreisirbu91-lab/mcpspend"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://smithery.ai/badge/andreisirbu91-lab/mcpspend"
              alt="MCPSpend on Smithery"
              height={20}
            />
          </a>
        </div>
        <div>
          <h4 className="text-white font-medium mb-3">Product</h4>
          <ul className="space-y-2 text-gray-400">
            <li><a href="/#features" className="hover:text-white transition-colors">Features</a></li>
            <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
            <li><a href="/#how" className="hover:text-white transition-colors">How it works</a></li>
            <li><Link href="/compare" className="hover:text-white transition-colors">Compare</Link></li>
            <li><Link href="/security" className="hover:text-white transition-colors">Security</Link></li>
            <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
            <li><Link href="/docs" className="hover:text-white transition-colors">API docs</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-white font-medium mb-3">Company</h4>
          <ul className="space-y-2 text-gray-400">
            <li><a href="mailto:support@mcpspend.com" className="hover:text-white transition-colors">support@mcpspend.com</a></li>
            <li><Link href="/login" className="hover:text-white transition-colors">Sign in</Link></li>
            <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
            <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
            <li><Link href="/legal/data-rights" className="hover:text-white transition-colors">Your data rights</Link></li>
            <li><Link href="/legal/sla" className="hover:text-white transition-colors">SLA</Link></li>
            <li><Link href="/legal/dpa" className="hover:text-white transition-colors">DPA template</Link></li>
            <li>
              <Link href="/status" className="hover:text-white transition-colors inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Status
              </Link>
            </li>
            <li>
              <a
                href="https://buy.stripe.com/00w8wPbUxe1qgK36CRbbG06"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition-colors inline-flex items-center gap-1.5"
              >
                <span aria-hidden="true">💖</span>
                Sponsor
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row justify-between gap-3 text-xs text-gray-500">
          <span>© {new Date().getFullYear()} NEW RZS SRL · CUI RO48756557 · J2023005851235 · Bragadiru, Ilfov, Romania · All rights reserved.</span>
          <span>EU-hosted · GDPR-aware</span>
        </div>
      </div>
    </footer>
  )
}
