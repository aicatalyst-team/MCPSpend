import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Footer } from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Press kit — MCPSpend',
  description: 'Logos, screenshots, founder bio, key facts, and quotes for press, podcasts, and reviews of MCPSpend.',
  alternates: { canonical: 'https://mcpspend.com/press' },
}

export default function PressKitPage() {
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
            <Link href="/security" className="hover:text-white">Security</Link>
            <Link href="/customers" className="hover:text-white">Customers</Link>
            <Link href="/register" className="text-white font-semibold">Start free</Link>
          </nav>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-xs uppercase tracking-widest text-brand-400 font-semibold">Press kit</div>
        <h1 className="mt-3 text-4xl sm:text-5xl font-semibold tracking-tight text-white leading-tight">
          MCPSpend press kit
        </h1>
        <p className="mt-5 text-gray-400 text-lg leading-relaxed">
          Everything you need to write about or feature MCPSpend. All assets below are free to use — attribution to <em>mcpspend.com</em> appreciated when relevant.
        </p>

        <h2 className="mt-12 text-2xl font-semibold text-white">One-liner</h2>
        <p className="mt-3 text-gray-300 leading-relaxed">
          MCPSpend is the first cost-observability platform built natively for the Model Context Protocol (MCP). One CLI command wraps every MCP server across Claude Desktop, Cursor, Windsurf, VS Code and Claude Code; the hosted dashboard shows per-tool, per-project, per-end-customer spend in real time. Free tier 25K calls/month forever; EU-hosted, GDPR-ready.
        </p>

        <h2 className="mt-12 text-2xl font-semibold text-white">30-second pitch</h2>
        <p className="mt-3 text-gray-300 leading-relaxed">
          Existing AI observability (Helicone, Langfuse, PostHog) sees the LLM call. None of them see the MCP tool layer where agents spend most of their time and money. MCPSpend fills that gap with zero SDK changes — one CLI command wraps the user&apos;s existing MCP servers, even inside closed IDEs like Cursor and Claude Desktop where SDK-wrap tools can&apos;t reach. Built by a solo Romanian founder, open-source proxy on npm, listed on the official MCP Registry and Smithery, scored #1 of 11 in SEETO AI&apos;s competitive analysis (100/100).
        </p>

        <h2 className="mt-12 text-2xl font-semibold text-white">Key facts</h2>
        <table className="mt-4 w-full text-sm">
          <tbody className="divide-y divide-white/5">
            <tr><td className="py-2 pr-4 text-gray-500 font-medium w-1/3">Founded</td><td className="text-white">May 2026</td></tr>
            <tr><td className="py-2 pr-4 text-gray-500 font-medium">Founder</td><td className="text-white">Andrei Sirbu (solo)</td></tr>
            <tr><td className="py-2 pr-4 text-gray-500 font-medium">Legal entity</td><td className="text-white">NEW RZS SRL · CUI RO48756557 · J2023005851235</td></tr>
            <tr><td className="py-2 pr-4 text-gray-500 font-medium">Headquarters</td><td className="text-white">Bragadiru, Ilfov, Romania 🇷🇴</td></tr>
            <tr><td className="py-2 pr-4 text-gray-500 font-medium">Hosting</td><td className="text-white">EU (Hostinger), GDPR-compliant</td></tr>
            <tr><td className="py-2 pr-4 text-gray-500 font-medium">License</td><td className="text-white">Proxy MIT (open source); dashboard hosted SaaS</td></tr>
            <tr><td className="py-2 pr-4 text-gray-500 font-medium">Free tier</td><td className="text-white">25,000 MCP tool calls/month, no credit card</td></tr>
            <tr><td className="py-2 pr-4 text-gray-500 font-medium">Paid tiers</td><td className="text-white">Pro $29/mo · Team $99/mo · Enterprise $499/mo</td></tr>
            <tr><td className="py-2 pr-4 text-gray-500 font-medium">Pricing</td><td className="text-white"><Link href="/pricing" className="text-brand-400 hover:underline">mcpspend.com/pricing</Link></td></tr>
            <tr><td className="py-2 pr-4 text-gray-500 font-medium">Source</td><td className="text-white"><a href="https://github.com/andreisirbu91-lab/MCPSpend" target="_blank" rel="noopener" className="text-brand-400 hover:underline">github.com/andreisirbu91-lab/MCPSpend</a></td></tr>
            <tr><td className="py-2 pr-4 text-gray-500 font-medium">npm</td><td className="text-white"><a href="https://www.npmjs.com/package/@mcpspend/proxy" target="_blank" rel="noopener" className="text-brand-400 hover:underline">@mcpspend/proxy</a></td></tr>
          </tbody>
        </table>

        <h2 className="mt-12 text-2xl font-semibold text-white">Founder bio (short)</h2>
        <p className="mt-3 text-gray-300 leading-relaxed">
          <strong>Andrei Sirbu</strong> is the solo founder and engineer of MCPSpend. Based in Bucharest, Romania, with a background in software engineering. He built MCPSpend after his own Claude Desktop and Cursor bills kept surprising him — and discovered no existing observability tool could tell him which MCP tool was responsible.
        </p>

        <h2 className="mt-12 text-2xl font-semibold text-white">Logo</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <a href="/logo.png" download className="rounded-xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors text-center">
            <Image src="/logo.png" alt="MCPSpend logo" width={80} height={80} className="mx-auto" />
            <p className="mt-3 text-sm text-white font-semibold">Full color logo</p>
            <p className="text-xs text-gray-500">PNG · 5056×3392 · download</p>
          </a>
          <a href="/android-chrome-512x512.png" download className="rounded-xl border border-white/10 bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors text-center">
            <Image src="/android-chrome-512x512.png" alt="MCPSpend icon" width={80} height={80} className="mx-auto" />
            <p className="mt-3 text-sm text-white font-semibold">Icon (square)</p>
            <p className="text-xs text-gray-500">PNG · 512×512 · download</p>
          </a>
        </div>

        <h2 className="mt-12 text-2xl font-semibold text-white">Brand colors</h2>
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { name: 'Brand 400',  hex: '#38BDF8' },
            { name: 'Brand 500',  hex: '#0EA5E9' },
            { name: 'Brand 700',  hex: '#0369A1' },
            { name: 'Gray 950',   hex: '#030712' },
          ].map((c) => (
            <div key={c.name} className="rounded-xl border border-white/10 overflow-hidden">
              <div style={{ background: c.hex, height: 64 }} />
              <div className="px-3 py-2">
                <div className="text-sm text-white font-semibold">{c.name}</div>
                <div className="text-xs text-gray-500 font-mono">{c.hex}</div>
              </div>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-2xl font-semibold text-white">Ready quotes</h2>

        <blockquote className="mt-4 border-l-4 border-brand-500 pl-4 py-1 text-gray-300 italic">
          “Existing AI cost tools see the LLM call. We see the layer underneath — every MCP tool the agent invoked, what each one cost, which project it belonged to. That&apos;s where most of the money actually goes.”
          <footer className="mt-2 not-italic text-xs text-gray-500">— Andrei Sirbu, founder, on building MCPSpend</footer>
        </blockquote>

        <blockquote className="mt-4 border-l-4 border-brand-500 pl-4 py-1 text-gray-300 italic">
          “One CLI command and the proxy is running across every MCP client you have. Zero SDK changes, zero code edits. It just slots in.”
          <footer className="mt-2 not-italic text-xs text-gray-500">— Andrei Sirbu, on the install flow</footer>
        </blockquote>

        <blockquote className="mt-4 border-l-4 border-brand-500 pl-4 py-1 text-gray-300 italic">
          “We&apos;re an indie team and we don&apos;t hide behind marketing copy. The free tier is 25,000 tool calls — that&apos;s a heavy solo dev for a month. We&apos;d rather have you use it than charge you to try it.”
          <footer className="mt-2 not-italic text-xs text-gray-500">— Andrei Sirbu, on pricing</footer>
        </blockquote>

        <h2 className="mt-12 text-2xl font-semibold text-white">Contact</h2>
        <div className="mt-3 text-sm text-gray-300 space-y-1.5">
          <p><strong className="text-white">Press / podcast:</strong> <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">support@mcpspend.com</a></p>
          <p><strong className="text-white">Founder direct:</strong> X <a href="https://x.com/andreisirbu91" target="_blank" rel="noopener" className="text-brand-400 hover:underline">@andreisirbu91</a></p>
          <p><strong className="text-white">Security disclosures:</strong> <a href="mailto:security@mcpspend.com" className="text-brand-400 hover:underline">security@mcpspend.com</a></p>
        </div>

        <div className="mt-14 rounded-2xl border border-brand-500/20 bg-brand-500/5 p-5 text-sm text-gray-300">
          Need higher-res screenshots, animated demos, custom angles for a story? Email <a href="mailto:support@mcpspend.com" className="text-brand-400 hover:underline">support@mcpspend.com</a> and Andrei will respond within a day.
        </div>
      </section>

      <Footer />
    </div>
  )
}
